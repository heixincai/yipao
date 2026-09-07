const app = getApp()
const config = require('../../config')
const subscribe = require('../../utils/subscribe')

function localDateTime(dateStr, timeStr) {
  const parts = dateStr.split('-').map(Number)
  const timeParts = timeStr.split(':').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]).getTime()
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

Page({
  data: {
    spots: [],
    spotIndex: -1,
    dates: [],
    dateIndex: 0,
    times: [],
    timeIndex: 0,
    mileageBands: ['3–5 公里', '5–8 公里', '8–10 公里', '10 公里以上'],
    mileageIndex: 1,
    intensityLevels: ['新手友好', '轻松跑', '节奏跑'],
    intensityIndex: 0,
    participantsLimit: 3,
    description: '',
    submitting: false,
    profileIncomplete: false
  },

  onShow() {
    this.prepare()
  },

  async prepare() {
    const profile = await app.ensureLogin()
    const incomplete = !profile || !profile.nickname || !profile.spotIds || !profile.spotIds.length
    this.setData({ profileIncomplete: !!incomplete })
    if (incomplete) {
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'spots', data: { action: 'list' } })
      const spots = (res.result && res.result.spots) || []
      this.setData({ spots })
    } catch (err) {
      console.error('prepare spots failed', err)
    }
    const now = new Date()
    const dates = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
      dates.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()))
    }
    const times = []
    for (let h = 5; h <= 22; h++) {
      times.push(pad(h) + ':00')
      times.push(pad(h) + ':30')
    }
    this.setData({ dates, times })
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  onSpotChange(e) {
    this.setData({ spotIndex: Number(e.detail.value) })
  },

  onDateChange(e) {
    this.setData({ dateIndex: Number(e.detail.value) })
  },

  onTimeChange(e) {
    this.setData({ timeIndex: Number(e.detail.value) })
  },

  onMileageChange(e) {
    this.setData({ mileageIndex: Number(e.detail.value) })
  },

  onIntensityChange(e) {
    this.setData({ intensityIndex: Number(e.detail.value) })
  },

  onLimitChange(e) {
    this.setData({ participantsLimit: Number(e.detail.value) })
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value })
  },

  async submit() {
    if (this.data.submitting) return
    if (this.data.spotIndex < 0) {
      wx.showToast({ title: '请选择跑点', icon: 'none' })
      return
    }
    const spot = this.data.spots[this.data.spotIndex]
    const date = this.data.dates[this.data.dateIndex]
    const time = this.data.times[this.data.timeIndex]
    const startTime = localDateTime(date, time)
    if (startTime < Date.now() + 30 * 60 * 1000) {
      wx.showToast({ title: '开跑时间至少要在 30 分钟后', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await subscribe.requestSubscribe(config.subscribeTemplates.joinChange)
      const res = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'create',
          spotId: spot._id,
          startTime,
          participantsLimit: this.data.participantsLimit,
          mileageBand: this.data.mileageBands[this.data.mileageIndex],
          intensityLevel: this.data.intensityLevels[this.data.intensityIndex],
          description: this.data.description.trim()
        }
      })
      const result = res.result || {}
      if (!result.ok) {
        wx.showToast({ title: result.message || '发布失败', icon: 'none' })
        this.setData({ submitting: false })
        return
      }
      wx.showToast({ title: '发布成功', icon: 'success' })
      wx.navigateTo({ url: '/pages/post/post?id=' + result.post._id })
    } catch (err) {
      console.error('publish failed', err)
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
    }
    this.setData({ submitting: false })
  }
})
