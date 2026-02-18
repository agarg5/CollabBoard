import http from 'k6/http'
import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'
import {
  SUPABASE_URL,
  REST_URL,
  WS_URL,
  REST_HEADERS,
  BOARD_ID,
  makeStickyNote,
} from './k6-config.js'

/**
 * Scenario 5: 5+ concurrent users on the same board.
 *
 * Each VU:
 *  1. Connects to the Supabase Realtime WebSocket (Phoenix protocol)
 *  2. Joins the board channel
 *  3. Creates objects via REST
 *  4. Listens for INSERT notifications on the WebSocket
 *  5. Measures sync latency (REST response → WS notification)
 *
 * Run:
 *   k6 run -e SUPABASE_URL=https://xyz.supabase.co \
 *          -e SUPABASE_ANON_KEY=your-key \
 *          -e BOARD_ID=some-uuid \
 *          tests/stress/concurrent-users.js
 */

const syncLatency = new Trend('object_sync_latency', true)
const objectsCreated = new Counter('objects_created')
const wsMessages = new Counter('ws_messages_received')

export const options = {
  scenarios: {
    concurrent_users: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    object_sync_latency: ['p(95)<200'],
    http_req_duration: ['p(95)<500'],
  },
}

export default function () {
  const vuId = __VU
  let lastInsertId = ''
  let lastInsertTime = 0

  // Connect to Realtime WebSocket
  const res = ws.connect(WS_URL, {}, (socket) => {
    // Phoenix heartbeat
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
      // Join the board channel for postgres_changes
      socket.send(
        JSON.stringify({
          topic: `realtime:board:${BOARD_ID}`,
          event: 'phx_join',
          payload: {
            config: {
              postgres_changes: [
                {
                  event: '*',
                  schema: 'public',
                  table: 'board_objects',
                  filter: `board_id=eq.${BOARD_ID}`,
                },
              ],
            },
          },
          ref: '1',
        }),
      )
    })

    socket.on('message', (msg) => {
      wsMessages.add(1)
      try {
        const data = JSON.parse(msg)
        // Check for postgres INSERT notification matching our own insert
        if (
          data.event === 'postgres_changes' &&
          data.payload?.data?.type === 'INSERT'
        ) {
          const record = data.payload.data.record
          if (record && record.id === lastInsertId && lastInsertTime > 0) {
            syncLatency.add(Date.now() - lastInsertTime)
          }
        }
      } catch {
        // Ignore parse errors
      }
    })

    // Wait for channel join confirmation
    sleep(2)

    // Create 5 objects, measuring sync latency for each
    for (let i = 0; i < 5; i++) {
      const note = makeStickyNote(BOARD_ID, vuId * 100 + i)
      lastInsertId = note.id
      lastInsertTime = Date.now()

      const payload = JSON.stringify(note)
      const postRes = http.post(`${REST_URL}/board_objects`, payload, {
        headers: REST_HEADERS,
      })

      check(postRes, {
        'object created': (r) => r.status === 201,
      })
      objectsCreated.add(1)

      // Wait a bit for the WS notification
      sleep(1)
    }

    // Keep connection alive a few more seconds to receive stragglers
    sleep(5)

    clearInterval(heartbeatInterval)
    socket.close()
  })

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  })
}

export function teardown() {
  // Cleanup: delete all k6-created objects
  const delRes = http.del(
    `${REST_URL}/board_objects?board_id=eq.${BOARD_ID}&properties->>text=like.k6*`,
    null,
    { headers: REST_HEADERS },
  )
  console.log(`Cleanup: ${delRes.status}`)
}
