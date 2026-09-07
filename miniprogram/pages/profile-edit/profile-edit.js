const app = getApp()

const PACE_LEVELS = ['新手友好', '轻松跑', '节奏跑']

Page({
  data: {
    nickname: '',
    avatarUrl: '',
    avatarTemp: '',
    intro: '',
    paceLevels: PACE_LEVELS,
    paceIndex: 0,
    spots: [],
    selectedSpotIds: [],
    saving: false
  },

  async onLoad() {
    const profile = await app.ensureLogin()
    if (!profile) return
    this.setData({
      nickname: profile.nickname || '',
      avatarUrl: profile.avatarUrl || '',
      intro: profile.intro || '',
      paceIndex: Math.max(0, PACE_LEVELS.indexOf(profile.paceLevel)),
      selectedSpotIds: (profile.spotIds || []).slice(0, 5)
    })
    try {
      const res = await wx.cloud.callFunction({ name: 'spots', data: { action: 'list' } })
      const spots = (res.result && res.result.spots) || []
      const decorated = spots.map((s) => ({
        ...s,
        selected: this.data.selectedSpotIds.indexOf(s._id) >= 0
      }))
      this.setData({ spots: decorated })
    } catch (err) {
      wx.showToast({ title: '跑点加载失败', icon: 'none' })
    }
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onChooseAvatar(e) {
    const temp = e.detail.avatarUrl
    this.setData({ avatarTemp: temp, avatarUrl: temp })
  },

  onIntroInput(e) {
    this.setData({ intro: e.detail.value })
  },

  onPaceChange(e) {
    this.setData({ paceIndex: Number(e.detail.value) })
  },

  toggleSpot(e) {
    const id = e.currentTarget.dataset.id
    const selected = this.data.selectedSpotIds.slice()
    const idx = selected.indexOf(id)
    if (idx >= 0) {
      selected.splice(idx, 1)
    } else {
      if (selected.length >= 5) {
        wx.showToast({ title: '最多选择 5 个常跑点', icon: 'none' })
        return
      }
      selected.push(id)
    }
    const spots = this.data.spots.map((s) => ({
      ...s,
      selected: selected.indexOf(s._id) >= 0
    }))
    this.setData({ selectedSpotIds: selected, spots })
  },

  async save() {
    if (this.data.saving) return
    const nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    if (!this.data.selectedSpotIds.length) {
      wx.showToast({ title: '至少选择一个常跑点', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    wx.showLoading({ title: '保存中' })
    let avatarUrl = this.data.avatarUrl
    if (this.data.avatarTemp) {
      try {
        avatarUrl = await this.uploadAvatar(this.data.avatarTemp)
      } catch (err) {
        console.error('avatar upload failed', err)
        wx.hideLoading()
        this.setData({ saving: false })
        wx.showModal({
          title: '头像上传失败',
          content: '云存储不可用。可以先保存资料，稍后再补头像吗？',
          confirmColor: '#12b76a',
          success: async (res) => {
            if (res.confirm) {
              await this.saveCore(avatarUrl)
            }
          }
        })
        return
      }
    }
    await this.saveCore(avatarUrl)
  },

  uploadAvatar(tempPath) {
    const cloudPath = 'avatars/' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '.png'
    return wx.cloud
      .uploadFile({ cloudPath, filePath: tempPath })
      .then((res) => wx.cloud.getTempFileURL({ fileList: [res.fileID] }))
      .then((res) => (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) || '')
  },

  async saveCore(avatarUrl) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'runner',
        data: {
          action: 'update',
          nickname: this.data.nickname.trim(),
          avatarUrl,
          intro: this.data.intro.trim(),
          paceLevel: PACE_LEVELS[this.data.paceIndex],
          spotIds: this.data.selectedSpotIds
        }
      })
      const result = res.result || {}
      if (!result.ok) {
        wx.showToast({ title: result.message || '保存失败', icon: 'none' })
        return
      }
      app.globalData.profile = result.profile
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      console.error('save profile failed', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  }
})
