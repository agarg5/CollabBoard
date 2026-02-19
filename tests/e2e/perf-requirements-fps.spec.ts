import { test, expect } from '@playwright/test'
import {
  createSupabaseClient,
  createBoard,
  cleanupBoard,
  seedObjects,
  openBoardAsUser,
  USER_A_ID,
  startFpsMeasurement,
  stopFpsMeasurement,
  waitForObjectCount,
  savePerfResult,
} from './perf-helpers'

const TARGETS = {
  fps: 60,
  objectCount: 500,
} as const

// Keep FPS measurements headed for more stable frame timing.
test.use({
  headless: false,
  launchOptions: { args: ['--disable-gpu-vsync'] },
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
        `500-object pan - avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
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
        `500-object zoom - avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
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
