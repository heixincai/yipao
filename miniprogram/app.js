const config = require('./config')

App({
  globalData: {
    profile: null,
    profileLoaded: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前微信基础库过低，无法使用云能力，请升级后使用')
      return
    }
    const initOptions = { traceUser: true }
    if (config.envId) {
      initOptions.env = config.envId
    }
    wx.cloud.init(initOptions)
    this.login()
  },

  login() {
    return wx.cloud
      .callFunction({ name: 'login' })
      .then((res) => {
        const result = res.result || {}
        if (!result.ok) {
          throw new Error(result.message || '登录失败')
        }
        this.globalData.profile = result.profile
        this.globalData.profileLoaded = true
        return result.profile
      })
      .catch((err) => {
        console.error('login failed', err)
        this.globalData.profileLoaded = false
        return null
      })
  },

  ensureLogin() {
    if (this.globalData.profileLoaded) {
      return Promise.resolve(this.globalData.profile)
    }
    return this.login()
  }
})
