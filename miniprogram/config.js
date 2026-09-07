module.exports = {
  // 首发城市
  city: '杭州',

  // 留空表示使用当前账号的默认云环境；多个环境时请填入环境 ID。
  envId: '',

  // 订阅消息模板 ID：在微信公众平台申请后填入。
  // joinChange 用于加入/退出提醒，postChange 用于帖子被更新/取消提醒。
  subscribeTemplates: {
    joinChange: '',
    postChange: ''
  }
}
