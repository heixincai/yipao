const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const posts = db.collection('posts')
const runners = db.collection('runners')
const spots = db.collection('runSpots')

const CITY = '杭州'
const MILEAGE_BANDS = ['3–5 公里', '5–8 公里', '8–10 公里', '10 公里以上']
const INTENSITY_LEVELS = ['新手友好', '轻松跑', '节奏跑']

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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'list'

  if (action === 'list') {
    const scope = event.scope || 'city'
    const spotIds = Array.isArray(event.spotIds) ? event.spotIds : []
    const cond = {
      city: CITY,
      status: _.in(['recruiting', 'full']),
      startTime: _.gte(Date.now() - 2 * 60 * 60 * 1000)
    }
    if (scope === 'spots' && spotIds.length) {
      cond.spotId = _.in(spotIds)
    }
    const res = await posts.where(cond).orderBy('startTime', 'asc').limit(100).get()
    return { ok: true, posts: res.data }
  }

  if (action === 'mine') {
    // MVP 规模下直接拉取后过滤；帖子量上来后应改造成索引查询。
    const res = await posts.orderBy('startTime', 'desc').limit(200).get()
    const mine = res.data.filter(
      (p) =>
        p.organizerOpenid === OPENID ||
        ((p.participants || []).some((x) => x.openid === OPENID) ||
          (p.absentees || []).some((x) => x.openid === OPENID))
    )
    return { ok: true, posts: mine }
  }

  if (action === 'get') {
    const id = typeof event.id === 'string' ? event.id : ''
    if (!id) return { ok: false, message: '缺少帖子 ID' }
    const res = await posts.doc(id).get()
    return { ok: true, post: res.data }
  }

  if (action === 'create') {
    const runner = await getRunner(OPENID)
    if (!isComplete(runner)) {
      return { ok: false, code: 'PROFILE_INCOMPLETE', message: '请先完善跑者资料' }
    }

    const spotId = typeof event.spotId === 'string' ? event.spotId : ''
    const spotRes = await spots.doc(spotId).get()
    const spot = spotRes.data
    if (!spot || spot.city !== CITY || spot.status !== 'active') {
      return { ok: false, message: '跑点不存在或不在首发城市' }
    }

    const startTime = Number(event.startTime)
    const participantsLimit = Number(event.participantsLimit)
    const mileageBand = cleanText(event.mileageBand, 20)
    const intensityLevel = cleanText(event.intensityLevel, 20)
    const description = cleanText(event.description, 200)

    if (!startTime || startTime < Date.now() + 30 * 60 * 1000) {
      return { ok: false, message: '开跑时间至少要在 30 分钟后' }
    }
    if (!(participantsLimit >= 2 && participantsLimit <= 5)) {
      return { ok: false, message: '人数上限需在 2–5 之间' }
    }
    if (MILEAGE_BANDS.indexOf(mileageBand) < 0) {
      return { ok: false, message: '里程档不合法' }
    }
    if (INTENSITY_LEVELS.indexOf(intensityLevel) < 0) {
      return { ok: false, message: '强度档不合法' }
    }

    const now = Date.now()
    const data = {
      city: CITY,
      spotId: spot._id,
      spot: {
        _id: spot._id,
        name: spot.name,
        district: spot.district || '',
        address: spot.address || spot.name,
        lat: spot.lat || 0,
        lng: spot.lng || 0
      },
      organizerOpenid: OPENID,
      organizer: {
        nickname: runner.nickname,
        avatarUrl: runner.avatarUrl || '',
        intro: runner.intro || ''
      },
      startTime,
      participantsLimit,
      mileageBand,
      intensityLevel,
      description,
      status: 'recruiting',
      joinClosed: false,
      participants: [],
      absentees: [],
      comments: [],
      createdAt: now,
      updatedAt: now
    }
    const addRes = await posts.add({ data })
    return { ok: true, post: Object.assign({ _id: addRes._id }, data) }
  }

  return { ok: false, message: '未知操作' }
}
