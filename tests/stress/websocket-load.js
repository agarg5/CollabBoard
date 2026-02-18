import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'
import { SUPABASE_URL, WS_URL, BOARD_ID, SUPABASE_ANON_KEY } from './k6-config.js'

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

const cursorLatency = new Trend('cursor_broadcast_latency', true)
const cursorsSent = new Counter('cursors_sent')
const cursorsReceived = new Counter('cursors_received')

export const options = {
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
  const vuId = __VU

  const res = ws.connect(WS_URL, {}, (socket) => {
    const heartbeatInterval = setInterval(() => {
      socket.send(
        JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: null,
        }),
      )
    }, 30000)

    socket.on('open', () => {
      // Join the board channel for broadcast
      socket.send(
        JSON.stringify({
          topic: `realtime:board:${BOARD_ID}`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { self: false },
            },
          },
          ref: '1',
        }),
      )
    })

    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg)
        if (data.event === 'cursor' && data.payload?.ts) {
          cursorsReceived.add(1)
          const latency = Date.now() - data.payload.ts
          if (latency > 0 && latency < 10000) {
            cursorLatency.add(latency)
          }
        }
      } catch {
        // Ignore parse errors
      }
    })

    // Wait for channel join
    sleep(2)

    // Broadcast cursor positions at ~20Hz for 20 seconds
    const iterations = 400
    for (let i = 0; i < iterations; i++) {
      const cursor = {
        user_id: `k6-user-${vuId}`,
        user_name: `k6 User ${vuId}`,
        x: 100 + Math.sin(i / 10) * 300,
        y: 100 + Math.cos(i / 10) * 300,
        color: '#3b82f6',
        ts: Date.now(), // Timestamp for latency measurement
      }

      socket.send(
        JSON.stringify({
          topic: `realtime:board:${BOARD_ID}`,
          event: 'broadcast',
          payload: {
            type: 'broadcast',
            event: 'cursor',
            payload: cursor,
          },
          ref: null,
        }),
      )
      cursorsSent.add(1)

      sleep(0.05) // ~20Hz
    }

    // Drain remaining messages
    sleep(3)

    clearInterval(heartbeatInterval)
    socket.close()
  })

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  })
}
