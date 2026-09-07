function requestSubscribe(templateId) {
  if (!templateId) {
    return Promise.resolve({ requested: false })
  }
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(res) {
        const accepted = res && res[templateId] === 'accept'
        resolve({ requested: true, accepted: !!accepted })
      },
      fail() {
        resolve({ requested: true, accepted: false })
      }
    })
  })
}

module.exports = { requestSubscribe }
