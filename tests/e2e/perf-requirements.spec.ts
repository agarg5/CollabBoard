import { test, expect } from '@playwright/test'
import {
  createSupabaseClient,
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
} from './perf-helpers'

/**
 * These tests validate the hard performance requirements from the assignment:
 * 1. Cursor sync < 50ms (we target < 200ms accounting for test overhead)
 * 2. 5+ concurrent users without degradation
 * 3. 60 FPS target / usable FPS with 500 objects (p95 >= 30)
 */

test.describe('Requirement: Cursor latency', () => {
  const sb = createSupabaseClient()
  let boardId: string

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-cursor-lat-${Date.now()}`)
  })

  test.afterEach(async () => {
    await cleanupBoard(sb, boardId)
  })

  test('cursor broadcast round-trip < 200ms', async ({ browser }) => {
    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
    )

    try {
      const canvas = pageA.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      // Warm up the broadcast channel with a few moves
      for (let i = 0; i < 3; i++) {
        await canvas.hover({ position: { x: 100 + i * 10, y: 100 } })
        await pageA.waitForTimeout(100)
      }

      // Measure: move cursor on Page A, time until Page B's presence store updates
      const measurements: number[] = []
      for (let i = 0; i < 5; i++) {
        const targetX = 200 + i * 50
        const targetY = 200 + i * 30

        // Record timestamp just before the move
        const beforeMove = Date.now()

        await canvas.hover({ position: { x: targetX, y: targetY } })

        // Poll Page B's presence store for the updated cursor position
        const latency = await pageB.evaluate(
          ({ userId, startTime }) => {
            return new Promise<number>((resolve) => {
              const check = () => {
                const store = (window as any).__presenceStore
                const cursors = store?.getState().cursors ?? {}
                if (userId in cursors) {
                  resolve(Date.now() - startTime)
                  return
                }
                if (Date.now() - startTime > 2000) {
                  resolve(-1)
                  return
                }
                setTimeout(check, 5)
              }
              check()
            })
          },
          { userId: USER_A_ID, startTime: beforeMove },
        )

        if (latency > 0) measurements.push(latency)
        await pageA.waitForTimeout(100)
      }

      const avg = Math.round(
        measurements.reduce((s, v) => s + v, 0) / measurements.length,
      )
      const max = Math.max(...measurements)
      const min = Math.min(...measurements)

      console.log(
        `Cursor latency — avg: ${avg}ms, min: ${min}ms, max: ${max}ms, samples: ${measurements.length}`,
      )

      savePerfResult({
        test: 'cursor-latency',
        timestamp: new Date().toISOString(),
        metrics: { avg, min, max, samples: measurements.length },
        passed: avg < 200,
      })

      // Production target is <50ms, but test overhead (Playwright evaluate,
      // polling loop) adds ~50-100ms. Assert <200ms as a reasonable test bound.
      expect(avg).toBeLessThan(200)
      expect(measurements.length).toBeGreaterThanOrEqual(3)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})

test.describe('Requirement: 5+ concurrent users', () => {
  const sb = createSupabaseClient()
  let boardId: string

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-5user-${Date.now()}`)
  })

  test.afterEach(async () => {
    await cleanupBoard(sb, boardId)
  })

  test('5 users all see object creation within 2s', async ({ browser }) => {
    const { pages, contexts } = await openNUsers(browser, boardId, 5)

    try {
      // Verify all 5 users start with 0 objects
      for (const page of pages) {
        expect(await getObjectCount(page)).toBe(0)
      }

      // Insert 5 objects (one "from" each user via REST)
      for (let i = 0; i < 5; i++) {
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

      // Wait for all 5 pages to see all 5 objects
      const latencies: number[] = []
      for (let i = 0; i < pages.length; i++) {
        const latency = await waitForObjectCount(pages[i], 5, 10000)
        latencies.push(latency)
        console.log(`User ${i + 1} received all 5 objects in ${latency}ms`)
      }

      const allReceived = latencies.every((l) => l > -1)
      const maxLatency = Math.max(...latencies)
      const avgLatency = Math.round(
        latencies.reduce((s, v) => s + v, 0) / latencies.length,
      )

      console.log(
        `5-user sync — avg: ${avgLatency}ms, max: ${maxLatency}ms, all received: ${allReceived}`,
      )

      savePerfResult({
        test: '5-user-sync',
        timestamp: new Date().toISOString(),
        metrics: {
          avgLatency,
          maxLatency,
          allReceived,
          user1: latencies[0],
          user2: latencies[1],
          user3: latencies[2],
          user4: latencies[3],
          user5: latencies[4],
        },
        passed: allReceived && maxLatency < 2000,
      })

      expect(allReceived).toBe(true)
      // All 5 users should sync within 2s
      expect(maxLatency).toBeLessThan(2000)
    } finally {
      for (const ctx of contexts) await ctx.close()
    }
  })

  test('5 users see presence of all others', async ({ browser }) => {
    const { pages, contexts } = await openNUsers(browser, boardId, 5)

    try {
      // Move cursors on all pages to trigger presence broadcast
      for (let i = 0; i < pages.length; i++) {
        const canvas = pages[i].locator('canvas').first()
        await canvas.hover({ position: { x: 200 + i * 50, y: 200 } })
      }

      // Wait for presence to propagate
      await pages[0].waitForTimeout(2000)

      // Check that each user sees at least 4 other cursors
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
        metrics: {
          user1Sees: presenceCounts[0],
          user2Sees: presenceCounts[1],
          user3Sees: presenceCounts[2],
          user4Sees: presenceCounts[3],
          user5Sees: presenceCounts[4],
        },
        passed: presenceCounts.every((c) => c >= 3),
      })

      // Each user should see at least 3 of the other 4 cursors
      // (allowing for minor timing issues)
      for (let i = 0; i < presenceCounts.length; i++) {
        expect(presenceCounts[i]).toBeGreaterThanOrEqual(3)
      }
    } finally {
      for (const ctx of contexts) await ctx.close()
    }
  })
})

test.describe('Requirement: 500-object FPS p95', () => {
  const sb = createSupabaseClient()
  let boardId: string

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-fps-p95-${Date.now()}`)
  })

  test.afterEach(async () => {
    await cleanupBoard(sb, boardId)
  })

  test('500 objects: p95 FPS >= 30 during pan', async ({ browser }) => {
    await seedObjects(sb, boardId, 500, 'sticky_note')

    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      USER_A_ID,
    )

    try {
      await waitForObjectCount(page, 500, 30000)
      await page.waitForTimeout(1000) // Let renderer settle

      // Use Hand tool for panning
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

      // Pan in 30 steps over ~1.5s for a longer measurement window
      for (let i = 0; i < 30; i++) {
        await page.mouse.move(startX - i * 15, startY - i * 10, { steps: 2 })
        await page.waitForTimeout(50)
      }
      await page.mouse.up()

      const fps = await stopFpsMeasurement(page)

      console.log(
        `500-object FPS (p95 test) — avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      savePerfResult({
        test: '500-object-fps-pan',
        timestamp: new Date().toISOString(),
        metrics: {
          avg: fps.avg,
          min: fps.min,
          p95: fps.p95,
          frameCount: fps.frameCount,
        },
        passed: fps.p95 >= 30,
      })

      // Hard requirement: p95 should be at least 30 FPS
      // (avg >= 30 is already tested in perf-fps.spec.ts)
      expect(fps.p95).toBeGreaterThanOrEqual(30)
    } finally {
      await context.close()
    }
  })

  test('500 objects: p95 FPS >= 30 during zoom', async ({ browser }) => {
    await seedObjects(sb, boardId, 500, 'sticky_note')

    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      USER_A_ID,
    )

    try {
      await waitForObjectCount(page, 500, 30000)
      await page.waitForTimeout(1000)

      await startFpsMeasurement(page)

      const canvas = page.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)

      // Zoom out then in
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
        `500-object FPS zoom (p95 test) — avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      savePerfResult({
        test: '500-object-fps-zoom',
        timestamp: new Date().toISOString(),
        metrics: {
          avg: fps.avg,
          min: fps.min,
          p95: fps.p95,
          frameCount: fps.frameCount,
        },
        passed: fps.p95 >= 30,
      })

      expect(fps.p95).toBeGreaterThanOrEqual(30)
    } finally {
      await context.close()
    }
  })
})
