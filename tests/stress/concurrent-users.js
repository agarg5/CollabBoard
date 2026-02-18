import http from 'k6/http'
import { WebSocket } from 'k6/experimental/websockets'
import { check } from 'k6'
import { Trend, Counter } from 'k6/metrics'
import {
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
 *  1. Connects to the Supabase Realtime WebSocket
 *  2. Joins the board channel for postgres_changes
 *  3. Creates objects via REST → measures INSERT sync latency
 *  4. Updates an object → measures UPDATE sync latency
 *  5. Deletes an object → verifies DELETE notification
 *
 * Run:
 *   k6 run -e SUPABASE_URL=https://xyz.supabase.co \
 *          -e SUPABASE_ANON_KEY=your-key \
 *          -e BOARD_ID=some-uuid \
 *          tests/stress/concurrent-users.js
 */

const syncLatency = new Trend('object_sync_latency', true)
const deleteLatency = new Trend('delete_sync_latency', true)
const updateLatency = new Trend('update_sync_latency', true)
const objectsCreated = new Counter('objects_created')
const objectsDeleted = new Counter('objects_deleted')
const deletesReceived = new Counter('delete_notifications_received')
const updatesReceived = new Counter('update_notifications_received')
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
    object_sync_latency: ['p(95)<500'],
    http_req_duration: ['p(95)<500'],
  },
}

function safe(obj, key) {
  return obj && obj[key] !== undefined ? obj[key] : undefined
}

export default function () {
  var vuId = __VU
  var pendingOp = null
  var channelReady = false

  return new Promise(function (resolve) {
    var ws = new WebSocket(WS_URL)

    ws.onopen = function () {
      ws.send(JSON.stringify({
        topic: 'realtime:board:' + BOARD_ID,
        event: 'phx_join',
        payload: {
          config: {
            postgres_changes: [{
              event: '*',
              schema: 'public',
              table: 'board_objects',
              filter: 'board_id=eq.' + BOARD_ID,
            }],
          },
        },
        ref: '1',
      }))
    }

    ws.onmessage = function (e) {
      wsMessages.add(1)
      try {
        var data = JSON.parse(e.data)

        // Channel is ready once we get the system confirmation
        if (data.event === 'system' && data.payload && data.payload.status === 'ok') {
          channelReady = true
          startWorkload()
        }

        if (data.event !== 'postgres_changes') return

        // Supabase Realtime wraps changes in payload.data
        var payload = data.payload || {}
        var change = payload.data || payload
        var changeType = change.type || change.eventType
        var record = change.record || change['new']
        var oldRecord = change.old_record || change.old

        if (!pendingOp || pendingOp.time <= 0) return

        if (changeType === 'INSERT' && record && record.id === pendingOp.id && pendingOp.type === 'INSERT') {
          syncLatency.add(Date.now() - pendingOp.time)
          pendingOp = null
        }

        if (changeType === 'UPDATE' && record && record.id === pendingOp.id && pendingOp.type === 'UPDATE') {
          updateLatency.add(Date.now() - pendingOp.time)
          updatesReceived.add(1)
          pendingOp = null
        }

        if (changeType === 'DELETE' && pendingOp && pendingOp.type === 'DELETE') {
          var deletedId = (oldRecord && oldRecord.id) || (record && record.id)
          if (deletedId === pendingOp.id) {
            deleteLatency.add(Date.now() - pendingOp.time)
            deletesReceived.add(1)
            pendingOp = null
          }
        }
      } catch (err) {
        // Ignore parse errors
      }
    }

    ws.onerror = function () {
      resolve()
    }

    ws.onclose = function () {
      resolve()
    }

    function startWorkload() {
      var createdIds = []

      // Phase 1: Create 3 objects with sync latency measurement
      for (var i = 0; i < 3; i++) {
        var note = makeStickyNote(BOARD_ID, vuId * 100 + i)
        createdIds.push(note.id)
        pendingOp = { type: 'INSERT', id: note.id, time: Date.now() }

        var postRes = http.post(REST_URL + '/board_objects', JSON.stringify(note), {
          headers: REST_HEADERS,
        })
        check(postRes, { 'object created': function (r) { return r.status === 201 } })
        objectsCreated.add(1)
      }

      // Phase 2: Update last object (concurrent conflict test)
      setTimeout(function () {
        if (createdIds.length > 0) {
          var targetId = createdIds[createdIds.length - 1]
          pendingOp = { type: 'UPDATE', id: targetId, time: Date.now() }

          var headers = {}
          for (var k in REST_HEADERS) { headers[k] = REST_HEADERS[k] }
          headers['Prefer'] = 'return=minimal'

          var patchRes = http.patch(
            REST_URL + '/board_objects?id=eq.' + targetId,
            JSON.stringify({
              properties: { text: 'k6 Updated by VU ' + vuId, color: '#fef08a' },
              x: 500 + vuId * 10,
              updated_at: new Date().toISOString(),
            }),
            { headers: headers },
          )
          check(patchRes, { 'object updated': function (r) { return r.status === 200 || r.status === 204 } })
        }

        // Phase 3: Delete first object
        setTimeout(function () {
          if (createdIds.length > 0) {
            var deleteId = createdIds[0]
            pendingOp = { type: 'DELETE', id: deleteId, time: Date.now() }

            var delRes = http.del(
              REST_URL + '/board_objects?id=eq.' + deleteId,
              null,
              { headers: REST_HEADERS },
            )
            check(delRes, { 'object deleted': function (r) { return r.status === 200 || r.status === 204 } })
            objectsDeleted.add(1)
          }

          // Close after giving time for final notifications
          setTimeout(function () {
            ws.close()
          }, 3000)
        }, 2000)
      }, 2000)
    }

    // Timeout: close socket if channel never becomes ready
    setTimeout(function () {
      if (!channelReady) {
        console.log('VU' + vuId + ': channel never became ready, closing')
        ws.close()
      }
    }, 10000)
  })
}

export function teardown() {
  var delRes = http.del(
    REST_URL + '/board_objects?board_id=eq.' + BOARD_ID + '&properties->>text=like.k6*',
    null,
    { headers: REST_HEADERS },
  )
  console.log('Cleanup: ' + delRes.status)
}
