const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, message: '无法获取用户身份' }
  }

  const runners = db.collection('runners')
  const found = await runners.where({ _openid: OPENID }).limit(1).get()

  if (found.data.length) {
    return { ok: true, profile: found.data[0] }
  }

  const now = Date.now()
  const profile = {
    _openid: OPENID,
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
  return { ok: true, profile }
}
