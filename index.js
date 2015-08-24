var MidiStream = require('midi-stream')
var ObservStruct = require('observ-struct')
var ObservMidi = require('observ-midi')
var Observ = require('observ')
var computed = require('observ/computed')

var ArrayStack = require('./lib/array-stack')
var FlashArray = require('./lib/flash-array')
var AnyTrigger = require('./lib/on-trigger')
var LightStack = require('observ-midi/light-stack')
var MidiParam = require('./lib/midi-to-param')

var watchThrottle = require('throttle-observ/watch')
var throttle = require('throttle-observ')

module.exports = LaunchControl

function LaunchControl (context, state) {

  var port = MidiStream('Launch Control', {
    normalizeNotes: true
  })

  var onTrigger = AnyTrigger(state.items)
  var obs = ObservStruct({})
  
  // FIRST ROW OF KNOBS:
  var knobs = ObservMidi(port, {
    tempo: '184/21',
    param2: '184/22',
    param3: '184/23',
    param4: '184/24',
    param5: '184/25',
    param6: '184/26',
    param7: '184/27',
    param8: '184/28'
  })

  watchThrottle(knobs.tempo, 20, function(value) {
    if (value != null) {
      state.tempo.set(value+60)
    }
  })

  var params = [
    MidiParam(context, 'Launch Control > 2', throttle(knobs.param2)),
    MidiParam(context, 'Launch Control > 3', throttle(knobs.param3)),
    MidiParam(context, 'Launch Control > 4', throttle(knobs.param4)),
    MidiParam(context, 'Launch Control > 5', throttle(knobs.param5)),
    MidiParam(context, 'Launch Control > 6', throttle(knobs.param6)),
    MidiParam(context, 'Launch Control > 7', throttle(knobs.param7)),
    MidiParam(context, 'Launch Control > 8', throttle(knobs.param8)),
  ]

  params.forEach(function(param) {
    context.paramLookup.put(param.id(), param)
  })
  //////



  // SECOND ROW OF KNOBS:
  var volumes = ObservMidi(port, [
    '184/41', 
    '184/42',
    '184/43',
    '184/44',
    '184/45',
    '184/46',
    '184/47',
    '184/48',
  ])

  volumes(function (values) {
    values.forEach(function (val, i) {
      var item = state.items.get(i)
      if (item && item.node.output) {

        if (val == null) {
          val = 64
        }

        item.node.output.gain.value = (val / 64)
      }
      
    })
  })
  ////////


  // CONTROL BUTTONS:
  var offset = Observ(0)

  var controlButtons = LightStack(port, {
    clearOthers: '184/115',
    suppressOthers: '184/114'
  })

  controlButtons.clearOthers.light(0)

  controlButtons.clearOthers(function (value) {
    if (value) {
      suppressOthers(true)
    }
  })

  var lastSuppress = null
  var turnOffSuppressLight = null

  controlButtons.suppressOthers(function (value) {
    if (value) {
      lastSuppress = suppressOthers()
      turnOffSuppressLight = this.light(127)
    } else if (lastSuppress) {
      lastSuppress()
      turnOffSuppressLight()
      lastSuppress = null
    }
  })
  ///


  // SELECT BUTTONS:
  var selectedButton = null
  var buttonBase = computed([offset, state.items, state.selected], function(offset, items, selected) {
    var result = []
    for (var i=0;i<8;i++) {
      var item = state.items.get(i)
      if (item) {
        if (item.path === selected) {
          result.push(light(2, 3))
          selectedButton = i
        } else {
          result.push(light(1, 0))
        }
      } else {
        result.push(0)
      }
    }
    return result
  })

  var buttonFlash = FlashArray()
  onTrigger(function(i) {

    if (i === selectedButton) {
      buttonFlash.flash(i, light(3, 3), 40)
    } else {
      buttonFlash.flash(i, light(3, 0), 40)
      controlButtons.clearOthers.flash(127, 100)
    }
  })

  var buttons = ObservMidi(port, [
    '152/9',
    '152/10',
    '152/11',
    '152/12',
    '152/25',
    '152/26',
    '152/27',
    '152/28'
  ], ArrayStack([
    buttonBase, 
    buttonFlash
  ]))


  buttons(function (values) {
    var result = null

    values.forEach(function(val, i) {
      if (val) {
        result = i
      }
    })

    if (result != null) {
      var item = state.items.get(result)
      if (item) {
        state.selected.set(item.path)
      }
    }
  })

  return obs

  // scoped

  function suppressOthers (flatten) {
    var releases = []

    state.items.forEach(function (item) {
      if (item.path !== state.selected()) {
        if (item.node && item.node.controllers) {
          item.node.controllers.forEach(function (controller) {
            if (controller.looper) {
              releases.push(controller.looper.transform(function (grid) {
                grid.data = []
                return grid
              }))

              if (flatten) {
                controller.looper.flatten()
              }
            }
          })
        }
      }
    })

    return function () {
      releases.forEach(invoke)
    }
  }
}

function invoke (fn) {
  fn()
}

function light(r, g, flag){
  if (!r || r < 0)  r = 0
  if (r > 3)        r = 3
  if (!g || g < 0)  g = 0
  if (g > 3)        g = 3
  if (flag == 'flash') {
    flag = 8
  } else if (flag == 'buffer') {
    flag = 0
  } else {
    flag = 12
  }
  
  return ((16 * g) + r) + flag
}