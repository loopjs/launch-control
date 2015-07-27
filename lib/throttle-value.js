var Observ = require('observ')
var watch = require('observ/watch')

module.exports = function (value, delay) {
  var throttling = false
  var lastValueAt = 0

  // default delay is 20ms
  delay = delay || 20

  var obs = Observ()

  watch(value, function(v) {
    if (!throttling) {
      if (Date.now() - lastValueAt < delay) {
        refresh()
      } else {
        throttling = true
        setTimeout(refresh, delay)
      }
    }
  })

  return obs

  function refresh() {
    throttling = false
    lastValueAt = Date.now()
    obs.set(value())
  }
}