function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatDateTime(input) {
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  return (
    d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) +
    ':' + pad(d.getMinutes())
  )
}

function formatDate(input) {
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function formatTime(input) {
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function timeLeft(input) {
  const diff = new Date(input).getTime() - Date.now()
  if (diff <= 0) return '已开始'
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return days + '天后'
  }
  if (hours > 0) return hours + '小时后'
  if (minutes > 0) return minutes + '分钟后'
  return '即将开始'
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function postStatusText(status) {
  const map = {
    recruiting: '招募中',
    full: '已满员',
    canceled: '已取消',
    completed: '已完成'
  }
  return map[status] || status
}

module.exports = {
  formatDateTime,
  formatDate,
  formatTime,
  timeLeft,
  haversineDistance,
  postStatusText
}
