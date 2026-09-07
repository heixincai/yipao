const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const spots = db.collection('runSpots')
const requests = db.collection('spotRequests')

// 示例种子数据：上线前请人工核对坐标与名称。
const SEED_SPOTS = [
  { name: '西湖环湖绿道（断桥—雷峰塔）', district: '西湖区', lat: 30.2551, lng: 120.1516 },
  { name: '钱塘江绿道（城市阳台段）', district: '上城区', lat: 30.2369, lng: 120.2113 },
  { name: '运河绿道（拱宸桥段）', district: '拱墅区', lat: 30.3224, lng: 120.1395 },
  { name: '闻涛路“最美跑道”（滨江段）', district: '滨江区', lat: 30.2047, lng: 120.2115 },
  { name: '西溪湿地外围绿道', district: '西湖区', lat: 30.2691, lng: 120.0741 },
  { name: '黄龙体育中心周边跑道', district: '西湖区', lat: 30.2727, lng: 120.1285 }
]

async function ensureSeed() {
  const countRes = await spots.where({ status: 'active' }).count()
  if (countRes.total > 0) return
  const now = Date.now()
  const tasks = SEED_SPOTS.map((spot, index) =>
    spots.add({
      data: Object.assign({}, spot, {
        city: '杭州',
        address: spot.name,
        status: 'active',
        sort: index,
        createdAt: now,
        updatedAt: now
      })
    })
  )
  await Promise.all(tasks)
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'list'

  if (action === 'list') {
    await ensureSeed()
    const city = event.city || '杭州'
    const res = await spots
      .where({ city, status: 'active' })
      .orderBy('sort', 'asc')
      .limit(100)
      .get()
    return { ok: true, spots: res.data }
  }

  if (action === 'request') {
    const name = typeof event.name === 'string' ? event.name.trim().slice(0, 60) : ''
    if (!name) {
      return { ok: false, message: '请填写跑点名称' }
    }
    const runners = db.collection('runners')
    const found = await runners.where({ _openid: OPENID }).limit(1).get()
    const runner = found.data[0] || {}
    await requests.add({
      data: {
        name,
        city: event.city || '杭州',
        requesterOpenid: OPENID,
        requesterNickname: runner.nickname || '',
        status: 'pending',
        createdAt: Date.now()
      }
    })
    return { ok: true }
  }

  return { ok: false, message: '未知操作' }
}
