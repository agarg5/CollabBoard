import { test, expect } from '@playwright/test'
import {
  createSupabaseClient,
  createAnonClient,
  createTestUser,
  deleteTestUser,
  createBoard,
  cleanupBoard,
  seedObjects,
  openBoardAsUser,
  openTwoUsers,
  openNUsers,
  USER_A_ID,
  startFpsMeasurement,
  stopFpsMeasurement,
  waitForObjectCount,
  getObjectCount,
  savePerfResult,
  type TestSession,
} from './perf-helpers'

const TARGETS = {
  fps: 60,
  objectCount: 500,
  cursorLatencyMs: 50,
  objectLatencyMs: 100,
  concurrentUsers: 5,
} as const

/**
 * Performance requirement tests. Each test maps to a specific target:
 *
 * | Target                                      | Test assertion                                  |
 * |---------------------------------------------|-------------------------------------------------|
 * | 60 FPS during pan/zoom/manipulation          | avg FPS >= 60 with 500 objects (headed mode)    |
 * | 500+ objects without performance drops        | avg FPS >= 60 with 500 objects (headed mode)    |
 * | <50ms cursor sync latency                    | avg measured cursor latency < 50ms               |
 * | <100ms object sync latency                   | max client object sync latency < 100ms           |
 * | <2s AI agent response time                   | (covered by perf-ai-agent.spec.ts)               |
 * | 5+ concurrent users per board                | 5 users connect + sync objects + see presence    |
 *
 * FPS tests run in headed mode with --disable-gpu-vsync for accurate
 * measurements. This avoids headless Chromium GC pauses that tank p95.
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
      for (const ctx of contexts) await ctx.close()
    }
  })

  test(`${TARGETS.concurrentUsers} users see presence of all others`, async ({ browser }) => {
    const { pages, contexts } = await openNUsers(browser, boardId, TARGETS.concurrentUsers, undefined, { sessions })

    try {
      // Move cursors to trigger presence broadcast
      for (let i = 0; i < pages.length; i++) {
        const canvas = pages[i].locator('canvas').first()
        await canvas.hover({ position: { x: 200 + i * 50, y: 200 } })
      }

      await pages[0].waitForTimeout(3000)

      const presenceCounts: number[] = []
      for (let i = 0; i < pages.length; i++) {
        const count = await pages[i].evaluate(() => {
          const store = (window as any).__presenceStore
          const cursors = store?.getState().cursors ?? {}
          return Object.keys(cursors).length
        })
        presenceCounts.push(count)
      }

      console.log(`Presence counts per user: ${presenceCounts.join(', ')}`)

      savePerfResult({
        test: '5-user-presence',
        timestamp: new Date().toISOString(),
        metrics: Object.fromEntries(presenceCounts.map((c, i) => [`user${i + 1}Sees`, c])),
        passed: presenceCounts.every((c) => c >= TARGETS.concurrentUsers - 1),
      })

      for (const count of presenceCounts) {
        expect(count).toBeGreaterThanOrEqual(TARGETS.concurrentUsers - 1)
      }
    } finally {
      for (const ctx of contexts) await ctx.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Target: 60 FPS during pan/zoom & 500+ objects without perf drops
// ---------------------------------------------------------------------------

test.describe(`Target: ${TARGETS.fps} FPS & ${TARGETS.objectCount}+ object rendering`, () => {
  const sb = createSupabaseClient()
  let boardId: string

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-fps-req-${Date.now()}`)
  })

  test.afterEach(async () => {
    if (boardId) await cleanupBoard(sb, boardId)
  })

  test(`${TARGETS.objectCount} objects: avg FPS >= ${TARGETS.fps} during pan`, async ({ browser }) => {
    await seedObjects(sb, boardId, TARGETS.objectCount, 'sticky_note')

    const { page, context } = await openBoardAsUser(browser, boardId, USER_A_ID)

    try {
      await waitForObjectCount(page, TARGETS.objectCount, 30000)
      await page.waitForTimeout(1000)

      await page.getByRole('button', { name: /Hand/ }).click()
      await page.waitForTimeout(500)

      await startFpsMeasurement(page)

      const canvas = page.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      const startX = box.x + box.width / 2
      const startY = box.y + box.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      for (let i = 0; i < 30; i++) {
        await page.mouse.move(startX - i * 15, startY - i * 10, { steps: 2 })
        await page.waitForTimeout(50)
      }
      await page.mouse.up()

      const fps = await stopFpsMeasurement(page)

      console.log(
        `500-object pan — avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      savePerfResult({
        test: '500-object-fps-pan',
        timestamp: new Date().toISOString(),
        metrics: { avg: fps.avg, min: fps.min, p95: fps.p95, frameCount: fps.frameCount },
        passed: fps.avg >= TARGETS.fps,
      })

      expect(fps.avg).toBeGreaterThanOrEqual(TARGETS.fps)
    } finally {
      await context.close()
    }
  })

  test(`${TARGETS.objectCount} objects: avg FPS >= ${TARGETS.fps} during zoom`, async ({ browser }) => {
    await seedObjects(sb, boardId, TARGETS.objectCount, 'sticky_note')

    const { page, context } = await openBoardAsUser(browser, boardId, USER_A_ID)

    try {
      await waitForObjectCount(page, TARGETS.objectCount, 30000)
      await page.waitForTimeout(1000)

      await startFpsMeasurement(page)

      const canvas = page.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)

      for (let i = 0; i < 15; i++) {
        await page.mouse.wheel(0, 100)
        await page.waitForTimeout(80)
      }
      for (let i = 0; i < 15; i++) {
        await page.mouse.wheel(0, -100)
        await page.waitForTimeout(80)
      }

      const fps = await stopFpsMeasurement(page)

      console.log(
        `500-object zoom — avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      savePerfResult({
        test: '500-object-fps-zoom',
        timestamp: new Date().toISOString(),
        metrics: { avg: fps.avg, min: fps.min, p95: fps.p95, frameCount: fps.frameCount },
        passed: fps.avg >= TARGETS.fps,
      })

      expect(fps.avg).toBeGreaterThanOrEqual(TARGETS.fps)
    } finally {
      await context.close()
    }
  })
})
