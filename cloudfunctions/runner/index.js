const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const runners = db.collection('runners')

const PACE_LEVELS = ['新手友好', '轻松跑', '节奏跑']

async function getRunner(openid) {
  const found = await runners.where({ _openid: openid }).limit(1).get()
  if (found.data.length) return found.data[0]
  const now = Date.now()
  const profile = {
    _openid: openid,
    nickname: '',
    avatarUrl: '',
    intro: '',
    paceLevel: '',
    spotIds: [],
    runCount: 0,
    absenceCount: 0,
    createdAt: now,
    updatedAt: now
  }
  await runners.add({ data: profile })
  return profile
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'getSelf'
  const profile = await getRunner(OPENID)

  if (action === 'getSelf') {
    return { ok: true, profile }
  }

  if (action === 'update') {
    const nickname = cleanText(event.nickname, 20)
    const intro = cleanText(event.intro, 100)
    const paceLevel = cleanText(event.paceLevel, 20)
    const spotIds = Array.isArray(event.spotIds)
      ? event.spotIds.filter((x) => typeof x === 'string').slice(0, 5)
      : []

    if (!nickname) {
      return { ok: false, message: '昵称不能为空' }
    }
    if (!spotIds.length) {
      return { ok: false, message: '至少选择一个常跑点' }
    }
    if (paceLevel && PACE_LEVELS.indexOf(paceLevel) < 0) {
      return { ok: false, message: '强度档不合法' }
    }

    const avatarUrl =
      typeof event.avatarUrl === 'string' ? event.avatarUrl.slice(0, 500) : profile.avatarUrl || ''
    const patch = {
      nickname,
      avatarUrl,
      intro,
      paceLevel,
      spotIds,
      updatedAt: Date.now()
    }
    await runners.where({ _openid: OPENID }).update({ data: patch })
    const updated = Object.assign({}, profile, patch)
    return { ok: true, profile: updated }
  }

  return { ok: false, message: '未知操作' }
}
