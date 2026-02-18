import { WebSocket } from 'k6/experimental/websockets'
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import { BOARD_ID, WS_URL } from './k6-config.js'

/**
 * Presence join/leave stress test.
 *
 * Verifies that Supabase Realtime presence tracks users joining and leaving
 * the board channel. Each VU joins with a unique presence key, verifies it
 * receives presence_state and presence_diff events, then leaves.
 *
 * Run:
 *   k6 run -e SUPABASE_URL=https://xyz.supabase.co \
 *          -e SUPABASE_ANON_KEY=your-key \
 *          -e BOARD_ID=some-uuid \
 *          tests/stress/presence.js
 */

var presenceJoins = new Counter('presence_joins_received')
var presenceLeaves = new Counter('presence_leaves_received')
var presenceStates = new Counter('presence_states_received')

export var options = {
  scenarios: {
    presence_test: {
      executor: 'constant-vus',
      vus: 5,
      duration: '20s',
    },
  },
  thresholds: {
    checks: ['rate>0.90'],
  },
}

export default function () {
  var vuId = __VU
  var iter = __ITER
  var presenceKey = 'k6-user-' + vuId + '-' + iter
  var connected = false
  var gotPresenceState = false
  var gotPresenceDiff = false

  return new Promise(function (resolve) {
    var ws = new WebSocket(WS_URL)

    ws.onopen = function () {
      connected = true
      ws.send(JSON.stringify({
        topic: 'realtime:board:' + BOARD_ID,
        event: 'phx_join',
        payload: {
          config: {
            presence: { key: presenceKey },
          },
        },
        ref: '1',
      }))
    }

    ws.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data)

        if (data.event === 'phx_reply' && data.payload && data.payload.status === 'ok') {
          // Track presence after join confirmed
          ws.send(JSON.stringify({
            topic: 'realtime:board:' + BOARD_ID,
            event: 'presence',
            payload: {
              type: 'presence',
              event: 'track',
              payload: {
                user_id: presenceKey,
                user_name: 'k6 User ' + vuId,
                online_at: new Date().toISOString(),
              },
            },
            ref: '2',
          }))
        }

        if (data.event === 'presence_state') {
          gotPresenceState = true
          presenceStates.add(1)
        }

        if (data.event === 'presence_diff') {
          var joins = (data.payload && data.payload.joins) || {}
          var leaves = (data.payload && data.payload.leaves) || {}
          if (Object.keys(joins).length > 0) presenceJoins.add(1)
          if (Object.keys(leaves).length > 0) presenceLeaves.add(1)
          gotPresenceDiff = true
        }
      } catch (err) {
        // Ignore
      }
    }

    ws.onerror = function () { resolve() }
    ws.onclose = function () {
      check(null, {
        'WebSocket connected': function () { return connected },
        'received presence_state': function () { return gotPresenceState },
        'received presence_diff': function () { return gotPresenceDiff },
      })
      resolve()
    }

    // Stay connected 5 seconds, then untrack and close
    setTimeout(function () {
      ws.send(JSON.stringify({
        topic: 'realtime:board:' + BOARD_ID,
        event: 'presence',
        payload: {
          type: 'presence',
          event: 'untrack',
          payload: {},
        },
        ref: '3',
      }))
      setTimeout(function () { ws.close() }, 1000)
    }, 5000)
  })
}
