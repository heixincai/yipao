const app = getApp()
const format = require('../../utils/format')

Page({
  data: {
    scope: 'city',
    spots: [],
    posts: [],
    loading: true,
    profileIncomplete: false
  },

  onShow() {
    this.load()
  },

  async load() {
    const profile = await app.ensureLogin()
    if (!profile) {
      this.setData({ loading: false })
      return
    }
    const profileIncomplete = !this.isProfileComplete(profile)
    const scope = profileIncomplete ? 'city' : 'spots'
    this.setData({
      profileIncomplete,
      scope,
      loading: true
    })
    await this.loadSpots()
    await this.loadPosts()
  },

  isProfileComplete(profile) {
    return (
      profile &&
      !!(profile.nickname && profile.nickname.trim()) &&
      Array.isArray(profile.spotIds) &&
      profile.spotIds.length > 0
    )
  },

  async loadSpots() {
    try {
      const res = await wx.cloud.callFunction({ name: 'spots', data: { action: 'list' } })
      const spots = (res.result && res.result.spots) || []
      this.setData({ spots })
    } catch (err) {
      console.error('loadSpots failed', err)
    }
  },

  async loadPosts() {
    const profile = app.globalData.profile
    const spotIds = this.data.scope === 'spots' && profile && profile.spotIds ? profile.spotIds : []
    try {
      const res = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'list',
          scope: spotIds.length ? 'spots' : 'city',
          spotIds
        }
      })
      const posts = ((res.result && res.result.posts) || []).map((post) =>
        this.decoratePost(post)
      )
      this.setData({ posts, loading: false })
    } catch (err) {
      console.error('loadPosts failed', err)
      this.setData({ posts: [], loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  decoratePost(post) {
    const total = (post.participants || []).length + 1
    const organizer = post.organizer || {}
    return Object.assign({}, post, {
      organizer: Object.assign({}, organizer, {
        avatarInitial: (organizer.nickname || '跑').slice(0, 1)
      }),
      startText: format.formatDateTime(post.startTime),
      timeLeftText: format.timeLeft(post.startTime),
      statusText: format.postStatusText(post.status),
      participantText: total + '/' + post.participantsLimit + '人',
      full: post.status === 'full' || total >= post.participantsLimit
    })
  },

  onScopeChange(e) {
    const scope = e.currentTarget.dataset.scope
    this.setData({ scope }, () => this.loadPosts())
  },

  async locateNearby() {
    try {
      const loc = await this.getLocation()
      const sorted = this.data.spots
        .filter((spot) => spot.lat && spot.lng)
        .slice()
        .sort(
          (a, b) =>
            format.haversineDistance(loc.latitude, loc.longitude, a.lat, a.lng) -
            format.haversineDistance(loc.latitude, loc.longitude, b.lat, b.lng)
        )
      if (!sorted.length) {
        wx.showToast({ title: '附近暂无跑点', icon: 'none' })
        return
      }
      const nearest = sorted.slice(0, 3)
      this.setData({
        scope: 'spots',
        userLocation: { latitude: loc.latitude, longitude: loc.longitude },
        nearby: true
      })
      app.globalData.profile = Object.assign({}, app.globalData.profile, {
        spotIds: nearest.map((s) => s._id)
      })
      await this.loadPosts()
      wx.showToast({ title: '已按离你最近的跑点筛选', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: '定位不可用，已按跑点浏览', icon: 'none' })
      this.setData({ scope: 'spots' })
      this.loadPosts()
    }
  },

  getLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: resolve,
        fail: reject
      })
    })
  },

  openPost(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/post/post?id=' + id })
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  }
})
