const app = getApp()
const format = require('../../utils/format')

Page({
  data: {
    profile: null,
    loading: true,
    incomplete: false,
    spotMap: {},
    myPosts: []
  },

  onShow() {
    this.load()
  },

  async load() {
    await app.ensureLogin()
    this.setData({ loading: true })
    try {
      const [runnerRes, spotsRes, postsRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'runner', data: { action: 'getSelf' } }),
        wx.cloud.callFunction({ name: 'spots', data: { action: 'list' } }),
        wx.cloud.callFunction({ name: 'post', data: { action: 'mine' } })
      ])
      const profile = (runnerRes.result && runnerRes.result.profile) || null
      const spots = (spotsRes.result && spotsRes.result.spots) || []
      const spotMap = {}
      spots.forEach((s) => {
        spotMap[s._id] = s.name
      })
      const rawPosts = (postsRes.result && postsRes.result.posts) || []
      const myPosts = rawPosts
        .sort((a, b) => b.startTime - a.startTime)
        .map((post) =>
          Object.assign({}, post, {
            startText: format.formatDateTime(post.startTime),
            statusText: format.postStatusText(post.status),
            spotName: spotMap[post.spotId] || (post.spot && post.spot.name) || '未知跑点'
          })
        )
      const incomplete =
        !profile || !profile.nickname || !profile.spotIds || !profile.spotIds.length
      const decoratedProfile = profile
        ? Object.assign({}, profile, {
            avatarInitial: (profile.nickname || '跑').slice(0, 1)
          })
        : null
      this.setData({
        profile: decoratedProfile,
        spotMap,
        myPosts,
        incomplete: !!incomplete,
        loading: false
      })
      app.globalData.profile = decoratedProfile
    } catch (err) {
      console.error('profile load failed', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  requestSpot() {
    wx.showModal({
      title: '申请新跑点',
      editable: true,
      placeholderText: '请输入跑点名称和位置，例如：湘湖环湖绿道（越王路段）',
      confirmColor: '#12b76a',
      success: async (res) => {
        if (!res.confirm || !res.content) return
        try {
          const r = await wx.cloud.callFunction({
            name: 'spots',
            data: { action: 'request', name: res.content }
          })
          const result = r.result || {}
          if (result.ok) {
            wx.showToast({ title: '已提交，等待管理员审核', icon: 'none' })
          } else {
            wx.showToast({ title: result.message || '提交失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '提交失败', icon: 'none' })
        }
      }
    })
  },

  openPost(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/post/post?id=' + id })
  }
})
