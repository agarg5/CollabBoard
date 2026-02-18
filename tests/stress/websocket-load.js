import { WebSocket } from 'k6/experimental/websockets'
import { check } from 'k6'
import { Trend, Counter } from 'k6/metrics'
import { BOARD_ID, WS_URL } from './k6-config.js'

/**
 * WebSocket cursor broadcast stress test.
 *
 * Simulates 5→20 VUs ramping over 2 minutes, each broadcasting cursor
 * positions at ~20Hz and measuring broadcast delivery latency.
 *
 * Run:
 *   k6 run -e SUPABASE_URL=https://xyz.supabase.co \
 *          -e SUPABASE_ANON_KEY=your-key \
 *          -e BOARD_ID=some-uuid \
 *          tests/stress/websocket-load.js
 */

var cursorLatency = new Trend('cursor_broadcast_latency', true)
var cursorsSent = new Counter('cursors_sent')
var cursorsReceived = new Counter('cursors_received')

export var options = {
  scenarios: {
    cursor_load: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    cursor_broadcast_latency: ['p(95)<100'],
  },
}

export default function () {
  var vuId = __VU
  var connected = false

  return new Promise(function (resolve) {
    var ws = new WebSocket(WS_URL)

    ws.onopen = function () {
      connected = true
      ws.send(JSON.stringify({
        topic: 'realtime:board:' + BOARD_ID,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { self: false },
          },
        },
        ref: '1',
      }))
    }

    ws.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data)

        // Wait for phx_reply to start broadcasting
        if (data.event === 'phx_reply' && data.payload && data.payload.status === 'ok') {
          startBroadcasting()
        }

        // Cursor events may arrive as direct event name or broadcast envelope
        if (data.event === 'cursor' && data.payload && data.payload.ts) {
          cursorsReceived.add(1)
          var lat = Date.now() - data.payload.ts
          if (lat > 0 && lat < 10000) {
            cursorLatency.add(lat)
          }
        }

        // Also handle broadcast envelope format
        if (data.event === 'broadcast' && data.payload && data.payload.event === 'cursor') {
          var inner = data.payload.payload
          if (inner && inner.ts) {
            cursorsReceived.add(1)
            var lat2 = Date.now() - inner.ts
            if (lat2 > 0 && lat2 < 10000) {
              cursorLatency.add(lat2)
            }
          }
        }
      } catch (err) {
        // Ignore
      }
    }

    ws.onerror = function () { resolve() }
    ws.onclose = function () {
      check(null, { 'WebSocket connected': function () { return connected } })
      resolve()
    }

    var broadcastStarted = false
    function startBroadcasting() {
      if (broadcastStarted) return
      broadcastStarted = true

      var i = 0
      var interval = setInterval(function () {
        if (i >= 400) {
          clearInterval(interval)
          setTimeout(function () { ws.close() }, 3000)
          return
        }

        var cursor = {
          user_id: 'k6-user-' + vuId,
          user_name: 'k6 User ' + vuId,
          x: 100 + Math.sin(i / 10) * 300,
          y: 100 + Math.cos(i / 10) * 300,
          color: '#3b82f6',
          ts: Date.now(),
        }

        ws.send(JSON.stringify({
          topic: 'realtime:board:' + BOARD_ID,
          event: 'broadcast',
          payload: {
            type: 'broadcast',
            event: 'cursor',
            payload: cursor,
          },
          ref: null,
        }))
        cursorsSent.add(1)
        i++
      }, 50) // ~20Hz
    }

    // Timeout safety
    setTimeout(function () {
      ws.close()
    }, 30000)
  })
}
