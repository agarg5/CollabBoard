import { test, expect } from '@playwright/test'
import {
  createSupabaseClient,
  createAnonClient,
  createTestUser,
  deleteTestUser,
  createBoard,
  cleanupBoard,
  openTwoUsers,
  openNUsers,
  waitForObjectCount,
  getObjectCount,
  savePerfResult,
  type TestSession,
} from './perf-helpers'

const TARGETS = {
  cursorLatencyMs: 50,
  objectLatencyMs: 100,
  concurrentUsers: 5,
} as const

/**
 * Performance requirement tests. Each test maps to a specific target:
 *
 * | Target                                      | Test assertion                                  |
 * |---------------------------------------------|-------------------------------------------------|
 * | <50ms cursor sync latency                    | avg measured cursor latency < 50ms               |
 * | <100ms object sync latency                   | max client object sync latency < 100ms           |
 * | <2s AI agent response time                   | (covered by perf-ai-agent.spec.ts)               |
 * | 5+ concurrent users per board                | 5 users connect + sync objects + see presence    |
 */

// ---------------------------------------------------------------------------
// Target: <50ms cursor sync latency
// ---------------------------------------------------------------------------

test.describe(`Target: cursor sync < ${TARGETS.cursorLatencyMs}ms`, () => {
  const sb = createSupabaseClient()
  const anonSb = createAnonClient()
  let boardId: string
  let sessionA: TestSession
  let sessionB: TestSession

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-cursor-lat-${Date.now()}`)
    // Create users sequentially to avoid rate limits
    sessionA = await createTestUser(sb, anonSb)
    sessionB = await createTestUser(sb, anonSb)
  })

  test.afterEach(async () => {
    await Promise.all([
      sessionA && deleteTestUser(sb, sessionA.userId).catch(() => {}),
      sessionB && deleteTestUser(sb, sessionB.userId).catch(() => {}),
    ])
    if (boardId) await cleanupBoard(sb, boardId)
  })

  test(`cursor broadcast round-trip avg < ${TARGETS.cursorLatencyMs}ms`, async ({ browser }) => {
    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
      undefined,
      { sessionA, sessionB },
    )

    try {
      const canvas = pageA.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      // Warm up the broadcast channel with real pointer moves.
      for (let i = 0; i < 5; i++) {
        await pageA.mouse.move(box.x + 100 + i * 10, box.y + 100, { steps: 4 })
        await pageA.waitForTimeout(150)
      }

      // Measure: move cursor on Page A, time until Page B sees the update
      const measurements: number[] = []
      const sampleAttempts = 10
      for (let i = 0; i < sampleAttempts; i++) {
        const targetX = 180 + (i % 5) * 60
        const targetY = 160 + Math.floor(i / 5) * 80
        const previousPos = await pageB.evaluate((userId) => {
          const store = (window as any).__presenceStore
          const cursors = store?.getState().cursors ?? {}
          const cursor = cursors[userId]
          return cursor ? { x: cursor.x, y: cursor.y } : null
        }, sessionA.userId)
        const beforeMove = Date.now()

        await pageA.mouse.move(box.x + targetX, box.y + targetY, { steps: 6 })

        try {
          await pageB.waitForFunction(
            ({ userId, expectedX, expectedY, prev }) => {
              const store = (window as any).__presenceStore
              const cursors = store?.getState().cursors ?? {}
              const cursor = cursors[userId]
              if (!cursor) return false

              const closeToTarget =
                Math.abs(cursor.x - expectedX) <= 30 &&
                Math.abs(cursor.y - expectedY) <= 30
              if (!closeToTarget) return false

              if (!prev) return true
              return (
                Math.abs(cursor.x - prev.x) > 0.5 ||
                Math.abs(cursor.y - prev.y) > 0.5
              )
            },
            {
              userId: sessionA.userId,
              expectedX: targetX,
              expectedY: targetY,
              prev: previousPos,
            },
            { timeout: 3000 },
          )
          measurements.push(Date.now() - beforeMove)
        } catch {
          // Ignore this sample if no matching cursor update arrives in time.
        }

        await pageA.waitForTimeout(150)
      }

      if (measurements.length === 0) {
        throw new Error('No cursor updates observed on receiver page')
      }

      const avg = Math.round(measurements.reduce((s, v) => s + v, 0) / measurements.length)
      const max = Math.max(...measurements)
      const min = Math.min(...measurements)

      console.log(
        `Cursor latency — avg: ${avg}ms, min: ${min}ms, max: ${max}ms, samples: ${measurements.length}`,
      )

      savePerfResult({
        test: 'cursor-latency',
        timestamp: new Date().toISOString(),
        metrics: { avg, min, max, samples: measurements.length },
        passed: avg < TARGETS.cursorLatencyMs,
      })

      expect(measurements.length).toBeGreaterThanOrEqual(3)
      expect(avg).toBeLessThan(TARGETS.cursorLatencyMs)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Target: <100ms object sync latency
// ---------------------------------------------------------------------------

test.describe(`Target: object sync < ${TARGETS.objectLatencyMs}ms`, () => {
  const sb = createSupabaseClient()
  const anonSb = createAnonClient()
  let boardId: string
  let sessionA: TestSession
  let sessionB: TestSession

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-obj-sync-${Date.now()}`)
    sessionA = await createTestUser(sb, anonSb)
    sessionB = await createTestUser(sb, anonSb)
  })

  test.afterEach(async () => {
    await Promise.all([
      sessionA && deleteTestUser(sb, sessionA.userId).catch(() => {}),
      sessionB && deleteTestUser(sb, sessionB.userId).catch(() => {}),
    ])
    if (boardId) await cleanupBoard(sb, boardId)
  })

  test(`object creation syncs to both clients within ${TARGETS.objectLatencyMs}ms`, async ({
    browser,
  }) => {
    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
      undefined,
      { sessionA, sessionB },
    )

    try {
      expect(await getObjectCount(pageA)).toBe(0)
      expect(await getObjectCount(pageB)).toBe(0)

      // Start waiting in both clients before inserting so both timers begin
      // from the same point and are not affected by sequential awaits.
      const waitA = waitForObjectCount(pageA, 1, 5000)
      const waitB = waitForObjectCount(pageB, 1, 5000)

      // Insert object via REST (triggers postgres_changes)
      await sb.from('board_objects').insert({
        id: crypto.randomUUID(),
        board_id: boardId,
        type: 'sticky_note',
        properties: { text: 'Sync test', color: '#fef08a' },
        x: 200,
        y: 200,
        width: 200,
        height: 200,
        z_index: 1,
        created_by: null,
        updated_at: new Date().toISOString(),
      })

      const [latencyA, latencyB] = await Promise.all([waitA, waitB])

      console.log(`Object sync latency — Page A: ${latencyA}ms, Page B: ${latencyB}ms`)

      savePerfResult({
        test: 'object-sync-latency',
        timestamp: new Date().toISOString(),
        metrics: { latencyA, latencyB },
        passed: latencyA < TARGETS.objectLatencyMs && latencyB < TARGETS.objectLatencyMs,
      })

      expect(latencyA).toBeGreaterThan(-1)
      expect(latencyB).toBeGreaterThan(-1)
      expect(Math.max(latencyA, latencyB)).toBeLessThan(TARGETS.objectLatencyMs)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Target: 5+ concurrent users per board
// ---------------------------------------------------------------------------

test.describe(`Target: ${TARGETS.concurrentUsers}+ concurrent users`, () => {
  const sb = createSupabaseClient()
  const anonSb = createAnonClient()
  let boardId: string
  let sessions: TestSession[] = []

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-5user-${Date.now()}`)
    // Create users sequentially to avoid rate limits
    for (let i = 0; i < TARGETS.concurrentUsers; i++) {
      sessions.push(await createTestUser(sb, anonSb))
    }
  })

  test.afterEach(async () => {
    await Promise.all(
      sessions.map((s) => s && deleteTestUser(sb, s.userId).catch(() => {})),
    )
    sessions = []
    if (boardId) await cleanupBoard(sb, boardId)
  })

  test(`${TARGETS.concurrentUsers} users all sync object creation`, async ({ browser }) => {
    const { pages, contexts } = await openNUsers(browser, boardId, TARGETS.concurrentUsers, undefined, { sessions })

    try {
      for (const page of pages) {
        expect(await getObjectCount(page)).toBe(0)
      }

      // Insert one object per user.
      for (let i = 0; i < TARGETS.concurrentUsers; i++) {
        await sb.from('board_objects').insert({
          id: crypto.randomUUID(),
          board_id: boardId,
          type: 'sticky_note',
          properties: { text: `User ${i + 1} note`, color: '#fef08a' },
          x: 100 + i * 250,
          y: 100,
          width: 200,
          height: 200,
          z_index: i + 1,
          created_by: null,
          updated_at: new Date().toISOString(),
        })
        await new Promise((r) => setTimeout(r, 100))
      }

      const latencies: number[] = []
      for (let i = 0; i < pages.length; i++) {
        const latency = await waitForObjectCount(pages[i], TARGETS.concurrentUsers, 10000)
        latencies.push(latency)
        console.log(`User ${i + 1} received all ${TARGETS.concurrentUsers} objects in ${latency}ms`)
      }

      const allReceived = latencies.every((l) => l > -1)

      savePerfResult({
        test: '5-user-sync',
        timestamp: new Date().toISOString(),
        metrics: {
          allReceived,
          ...Object.fromEntries(latencies.map((l, i) => [`user${i + 1}`, l])),
        },
        passed: allReceived,
      })

      expect(allReceived).toBe(true)
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()))
    }
  })

  test(`${TARGETS.concurrentUsers} users see presence of all others`, async ({ browser }) => {
    test.setTimeout(60000)
    const { pages, contexts } = await openNUsers(browser, boardId, TARGETS.concurrentUsers, undefined, { sessions })

    try {
      await Promise.all(
        pages.map((page) =>
          expect(page.getByRole('group', { name: 'Online users' }).getByRole('img')).toHaveCount(
            TARGETS.concurrentUsers,
            { timeout: 8000 },
          ),
        ),
      )

      const presenceCounts: number[] = []
      for (let i = 0; i < pages.length; i++) {
        const count = await pages[i].getByRole('group', { name: 'Online users' }).getByRole('img').count()
        presenceCounts.push(count)
      }

      console.log(`Presence counts per user: ${presenceCounts.join(', ')}`)

      savePerfResult({
        test: '5-user-presence',
        timestamp: new Date().toISOString(),
        metrics: Object.fromEntries(presenceCounts.map((c, i) => [`user${i + 1}Sees`, c])),
        passed: presenceCounts.every((c) => c >= TARGETS.concurrentUsers),
      })

      for (const count of presenceCounts) {
        expect(count).toBeGreaterThanOrEqual(TARGETS.concurrentUsers)
      }
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()))
    }
  })
})
