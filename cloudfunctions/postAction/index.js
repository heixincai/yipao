const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const posts = db.collection('posts')
const runners = db.collection('runners')

const TWO_HOURS = 2 * 60 * 60 * 1000
const INTENSITY_LEVELS = ['新手友好', '轻松跑', '节奏跑']
const MILEAGE_BANDS = ['3–5 公里', '5–8 公里', '8–10 公里', '10 公里以上']

async function getRunner(openid) {
  const found = await runners.where({ _openid: openid }).limit(1).get()
  return found.data[0] || null
}

function isComplete(runner) {
  return (
    !!runner &&
    !!runner.nickname &&
    Array.isArray(runner.spotIds) &&
    runner.spotIds.length > 0
  )
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function loadPost(id) {
  if (!id) return null
  const res = await posts.doc(id).get()
  return res.data || null
}

// 订阅消息发送前需要先在公众平台申请模板并填写客户端 config.js。
// 这里保留接入点，避免骨架在无模板 ID 时抛错。
function notify(title, openids) {
  console.log('[notify]', title, openids)
}

async function incRunner(openid, patch) {
  if (!openid) return
  await runners.where({ _openid: openid }).update({ data: patch })
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || ''
  const post = await loadPost(event.id)

  if (!post) {
    return { ok: false, message: '帖子不存在' }
  }

  const isOrganizer = post.organizerOpenid === OPENID
  const active = post.status === 'recruiting' || post.status === 'full'
  const participants = (post.participants || []).filter((x) => x.status === 'joined')
  const joinedOpenids = participants.map((x) => x.openid)
  const absentees = post.absentees || []
  const now = Date.now()

  if (action === 'join') {
    if (!active) return { ok: false, message: '该约跑已结束或取消' }
    if (post.joinClosed) return { ok: false, message: '发起人已停止加入' }
    if (isOrganizer) return { ok: false, message: '不能加入自己发起的约跑' }
    if (joinedOpenids.indexOf(OPENID) >= 0) return { ok: false, message: '你已加入' }
    if (participants.length + 1 >= post.participantsLimit) {
      return { ok: false, message: '已经满员' }
    }

    const runner = await getRunner(OPENID)
    if (!isComplete(runner)) {
      return { ok: false, code: 'PROFILE_INCOMPLETE', message: '请先完善跑者资料' }
    }

    const joiner = {
      openid: OPENID,
      nickname: runner.nickname,
      avatarUrl: runner.avatarUrl || '',
      intro: runner.intro || '',
      joinedAt: now,
      status: 'joined'
    }
    const nextParticipants = participants.concat([joiner])
    const full = nextParticipants.length + 1 >= post.participantsLimit
    const patch = {
      participants: nextParticipants,
      status: full ? 'full' : 'recruiting',
      updatedAt: now
    }
    await posts.doc(post._id).update({ data: patch })
    notify('有人加入了你的约跑', [post.organizerOpenid])
    return { ok: true }
  }

  if (action === 'leave') {
    if (!active) return { ok: false, message: '该约跑已结束或取消' }
    if (isOrganizer) {
      return { ok: false, message: '发起人请使用“取消约跑”' }
    }
    const index = participants.findIndex((x) => x.openid === OPENID)
    if (index < 0) return { ok: false, message: '你还没有加入' }

    const leaver = participants[index]
    const rest = participants.slice()
    rest.splice(index, 1)
    const patch = {
      participants: rest,
      status: rest.length + 1 < post.participantsLimit ? 'recruiting' : post.status,
      updatedAt: now
    }

    const withinTwoHours = now >= post.startTime - TWO_HOURS
    if (!withinTwoHours) {
      await posts.doc(post._id).update({ data: patch })
      notify('有跑者退出了约跑', [post.organizerOpenid])
      return { ok: true, countedAbsence: false }
    }

    // 开跑前 2 小时内退出：移除并记一次爽约。
    absentees.push({
      openid: leaver.openid,
      nickname: leaver.nickname,
      absentAt: now,
      reason: 'late-leave'
    })
    patch.absentees = absentees
    await posts.doc(post._id).update({ data: patch })
    await incRunner(OPENID, { absenceCount: _.inc(1) })
    notify('有跑者在截止后退出', [post.organizerOpenid])
    return { ok: true, countedAbsence: true }
  }

  if (action === 'close') {
    if (!isOrganizer) return { ok: false, message: '只有发起人可以操作' }
    if (!active) return { ok: false, message: '该约跑已结束或取消' }
    await posts.doc(post._id).update({ data: { joinClosed: true, updatedAt: now } })
    return { ok: true }
  }

  if (action === 'reopen') {
    if (!isOrganizer) return { ok: false, message: '只有发起人可以操作' }
    if (!active) return { ok: false, message: '该约跑已结束或取消' }
    if (participants.length + 1 >= post.participantsLimit) {
      return { ok: false, message: '已满员，无法重新开放' }
    }
    await posts.doc(post._id).update({
      data: { joinClosed: false, status: 'recruiting', updatedAt: now }
    })
    return { ok: true }
  }

  if (action === 'cancel') {
    if (!isOrganizer) return { ok: false, message: '只有发起人可以取消' }
    if (!active) return { ok: false, message: '该约跑已结束或取消' }
    await posts.doc(post._id).update({
      data: { status: 'canceled', joinClosed: true, updatedAt: now }
    })
    notify('约跑已被发起人取消，你不算爽约', joinedOpenids)
    return { ok: true }
  }

  if (action === 'update') {
    if (!isOrganizer) return { ok: false, message: '只有发起人可以修改' }
    if (!active) return { ok: false, message: '该约跑已结束或取消' }
    const patch = { updatedAt: now }
    if (typeof event.description === 'string') {
      patch.description = cleanText(event.description, 200)
    }
    if (typeof event.mileageBand === 'string') {
      if (MILEAGE_BANDS.indexOf(event.mileageBand) < 0) {
        return { ok: false, message: '里程档不合法' }
      }
      patch.mileageBand = event.mileageBand
    }
    if (typeof event.intensityLevel === 'string') {
      if (INTENSITY_LEVELS.indexOf(event.intensityLevel) < 0) {
        return { ok: false, message: '强度档不合法' }
      }
      patch.intensityLevel = event.intensityLevel
    }
    if (event.participantsLimit) {
      const limit = Number(event.participantsLimit)
      if (!(limit >= 2 && limit <= 5) || limit < participants.length + 1) {
        return { ok: false, message: '人数上限不能小于当前人数且需在 2–5 之间' }
      }
      patch.participantsLimit = limit
    }
    await posts.doc(post._id).update({ data: patch })
    notify('约跑信息已更新', joinedOpenids)
    return { ok: true }
  }

  if (action === 'comment') {
    if (post.status === 'canceled' || post.status === 'completed') {
      return { ok: false, message: '该约跑已结束，不能留言' }
    }
    if (!isOrganizer && joinedOpenids.indexOf(OPENID) < 0) {
      return { ok: false, message: '加入这场约跑后才能留言' }
    }
    const text = cleanText(event.text, 200)
    if (!text) return { ok: false, message: '留言不能为空' }
    const runner = await getRunner(OPENID)
    const comment = {
      openid: OPENID,
      nickname: runner ? runner.nickname : '',
      avatarUrl: runner ? runner.avatarUrl || '' : '',
      text,
      createdAt: now
    }
    await posts.doc(post._id).update({
      data: { comments: (post.comments || []).concat([comment]), updatedAt: now }
    })
    const others = joinedOpenids.concat(post.organizerOpenid === OPENID ? [] : [post.organizerOpenid])
    notify('约跑帖有新留言', others)
    return { ok: true }
  }

  if (action === 'finish') {
    if (!isOrganizer) return { ok: false, message: '只有发起人可以确认到场' }
    if (!active) return { ok: false, message: '该约跑已结束或取消' }
    if (now < post.startTime) return { ok: false, message: '开跑时间还没到' }

    const requested = Array.isArray(event.attendeeOpenids) ? event.attendeeOpenids : []
    const attendeeSet = {}
    requested.forEach((id) => {
      if (joinedOpenids.indexOf(id) >= 0) attendeeSet[id] = true
    })

    const nextParticipants = participants.map((p) => {
      const attended = !!attendeeSet[p.openid]
      return Object.assign({}, p, { status: attended ? 'attended' : 'absent' })
    })
    const nextAbsentees = absentees.slice()
    participants.forEach((p) => {
      if (attendeeSet[p.openid]) return
      nextAbsentees.push({
        openid: p.openid,
        nickname: p.nickname,
        absentAt: now,
        reason: 'no-show'
      })
    })

    const updates = []
    Object.keys(attendeeSet).forEach((openid) => {
      updates.push(incRunner(openid, { runCount: _.inc(1) }))
    })
    participants.forEach((p) => {
      if (!attendeeSet[p.openid]) {
        updates.push(incRunner(p.openid, { absenceCount: _.inc(1) }))
      }
    })
    // 至少有一名参与者到场才算“约成”，此时发起人也视为到场。
    if (Object.keys(attendeeSet).length > 0) {
      updates.push(incRunner(post.organizerOpenid, { runCount: _.inc(1) }))
    }
    await Promise.all(updates)

    await posts.doc(post._id).update({
      data: {
        participants: nextParticipants,
        absentees: nextAbsentees,
        status: 'completed',
        completedAt: now,
        updatedAt: now
      }
    })
    return { ok: true }
  }

  return { ok: false, message: '未知操作' }
}
