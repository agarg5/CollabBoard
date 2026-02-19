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

// Keep pan/zoom FPS measurements headed for more stable frame timing.
test.use({
  headless: false,
  launchOptions: { args: ['--disable-gpu-vsync'] },
})

test.describe('FPS performance (pan/zoom)', () => {
  const sb = createSupabaseClient()
  let boardId: string

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-fps-panzoom-${Date.now()}`)
  })

  test.afterEach(async () => {
    await cleanupBoard(sb, boardId)
  })

  test('60 FPS during pan with 100 objects', async ({ browser }) => {
    await seedObjects(sb, boardId, 100, 'sticky_note')

    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      USER_A_ID,
      undefined,
      { waitForRealtime: false },
    )

    try {
      await waitForObjectCount(page, 100, 15000)

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
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(startX - i * 15, startY - i * 10, { steps: 2 })
        await page.waitForTimeout(50)
      }
      await page.mouse.up()

      const fps = await stopFpsMeasurement(page)
      console.log(
        `FPS with 100 objects - avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      savePerfResult({
        test: '100-object-fps-pan',
        timestamp: new Date().toISOString(),
        metrics: { avg: fps.avg, min: fps.min, p95: fps.p95, frameCount: fps.frameCount },
        passed: fps.avg >= 60,
      })

      expect(fps.avg).toBeGreaterThanOrEqual(60)
    } finally {
      await context.close()
    }
  })

  test('usable FPS with 500+ objects during zoom', async ({ browser }) => {
    await seedObjects(sb, boardId, 500, 'sticky_note')

    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      USER_A_ID,
      undefined,
      { waitForRealtime: false },
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

      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 100)
        await page.waitForTimeout(100)
      }
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, -100)
        await page.waitForTimeout(100)
      }

      const fps = await stopFpsMeasurement(page)
      console.log(
        `FPS with 500 objects - avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      savePerfResult({
        test: '500-object-fps-zoom',
        timestamp: new Date().toISOString(),
        metrics: { avg: fps.avg, min: fps.min, p95: fps.p95, frameCount: fps.frameCount },
        passed: fps.avg >= 60,
      })

      expect(fps.avg).toBeGreaterThanOrEqual(60)
    } finally {
      await context.close()
    }
  })
})
