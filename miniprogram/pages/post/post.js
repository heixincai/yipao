const app = getApp()
const config = require('../../config')
const format = require('../../utils/format')
const subscribe = require('../../utils/subscribe')

Page({
  data: {
    id: '',
    post: null,
    profile: null,
    isOrganizer: false,
    isJoined: false,
    canLeaveFreely: false,
    showLeaveWarning: false,
    commentText: '',
    submitting: false,
    attendanceMode: false,
    attendance: []
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  onShow() {
    if (this.data.id) {
      this.load()
    }
  },

  async load() {
    const profile = await app.ensureLogin()
    if (!profile) {
      wx.showToast({ title: '登录失败', icon: 'none' })
      return
    }
    wx.showLoading({ title: '加载中' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'post',
        data: { action: 'get', id: this.data.id }
      })
      const result = res.result || {}
      if (!result.ok || !result.post) {
        throw new Error(result.message || '帖子不存在')
      }
      const decorated = this.decorate(result.post, profile)
      this.setData({ profile, ...decorated })
    } catch (err) {
      console.error('post load failed', err)
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
    wx.hideLoading()
  },

  decorate(post, profile) {
    const participants = (post.participants || []).map((p) => ({
      ...p,
      avatarInitial: (p.nickname || '跑').slice(0, 1)
    }))
    const organizer = post.organizer || {}
    const myOpenid = profile._openid
    const isOrganizer = post.organizerOpenid === myOpenid
    const isJoined = participants.some(
      (p) => p.openid === myOpenid && p.status === 'joined'
    )
    const total = participants.filter((p) => p.status === 'joined').length + 1
    const joinClosed = !!post.joinClosed
    const status = post.status
    const current = participants.length + 1
    const full = status === 'full' || current >= post.participantsLimit
    const now = Date.now()
    const cutoff = post.startTime - 2 * 60 * 60 * 1000
    const comments = (post.comments || [])
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) =>
        Object.assign({}, c, {
          avatarInitial: (c.nickname || '跑').slice(0, 1),
          timeText: format.formatDateTime(c.createdAt)
        })
      )

    return {
      post: Object.assign({}, post, {
        organizer: Object.assign({}, organizer, {
          avatarInitial: (organizer.nickname || '跑').slice(0, 1)
        }),
        participants,
        comments,
        total,
        participantText: total + '/' + post.participantsLimit + '人',
        startText: format.formatDateTime(post.startTime),
        timeLeftText: format.timeLeft(post.startTime),
        statusText: format.postStatusText(status),
        canJoin: (status === 'recruiting' || status === 'full') && !full && !joinClosed && !isOrganizer && !isJoined,
        canLeave: isJoined && status !== 'completed' && status !== 'canceled',
        canManage: isOrganizer && (status === 'recruiting' || status === 'full'),
        canFinish: isOrganizer && (status === 'recruiting' || status === 'full') && now > post.startTime
      }),
      isOrganizer,
      isJoined,
      canLeaveFreely: isJoined && now < cutoff,
      showLeaveWarning: isJoined && !joinClosed && !(now < cutoff) && status !== 'completed' && status !== 'canceled'
    }
  },

  async callAction(action, extra) {
    if (this.data.submitting) return null
    this.setData({ submitting: true })
    wx.showLoading({ title: '处理中' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'postAction',
        data: Object.assign({ action, id: this.data.id }, extra || {})
      })
      const result = res.result || {}
      if (!result.ok) {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' })
        return null
      }
      return result
    } catch (err) {
      console.error(action + ' failed', err)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      return null
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  },

  async join() {
    const profile = this.data.profile
    if (!profile || !profile.nickname || !profile.spotIds || !profile.spotIds.length) {
      const go = await this.confirm('资料不完整', '加入约跑前需要先完善跑者资料，现在去完善吗？')
      if (go) wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
      return
    }
    await subscribe.requestSubscribe(config.subscribeTemplates.postChange)
    const result = await this.callAction('join')
    if (result) {
      wx.showToast({ title: '已加入', icon: 'success' })
      this.load()
    }
  },

  async leave() {
    const warning = this.data.canLeaveFreely
      ? '退出后不会留下爽约记录。'
      : '距离开跑已不足 2 小时，现在退出会记一次爽约。确定退出吗？'
    const ok = await this.confirm('退出约跑', warning)
    if (!ok) return
    const result = await this.callAction('leave')
    if (result) {
      wx.showToast({ title: '已退出', icon: 'success' })
      this.load()
    }
  },

  async cancelPost() {
    const ok = await this.confirm('取消约跑', '取消后所有参与者都无过错，不会记爽约。确定取消吗？')
    if (!ok) return
    const result = await this.callAction('cancel')
    if (result) {
      wx.showToast({ title: '已取消', icon: 'success' })
      this.load()
    }
  },

  async toggleJoinClosed() {
    const action = this.data.post.joinClosed ? 'reopen' : 'close'
    const result = await this.callAction(action)
    if (result) this.load()
  },

  openAttendance() {
    const participants = (this.data.post.participants || []).filter(
      (p) => p.status === 'joined'
    )
    const attendance = participants.map((p) => ({
      openid: p.openid,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      checked: true
    }))
    this.setData({ attendanceMode: true, attendance })
  },

  cancelAttendance() {
    this.setData({ attendanceMode: false, attendance: [] })
  },

  toggleAttendee(e) {
    const index = Number(e.currentTarget.dataset.index)
    const key = 'attendance[' + index + '].checked'
    this.setData({ [key]: !this.data.attendance[index].checked })
  },

  async finish() {
    const attendeeOpenids = this.data.attendance
      .filter((a) => a.checked)
      .map((a) => a.openid)
    const result = await this.callAction('finish', { attendeeOpenids })
    if (result) {
      this.setData({ attendanceMode: false, attendance: [] })
      wx.showToast({ title: '已确认', icon: 'success' })
      this.load()
    }
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  async sendComment() {
    const text = this.data.commentText.trim()
    if (!text) return
    const result = await this.callAction('comment', { text })
    if (result) {
      this.setData({ commentText: '' })
      this.load()
    }
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  confirm(title, content) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        confirmColor: '#12b76a',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false)
      })
    })
  }
})
