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

test.describe('FPS performance', () => {
  const sb = createSupabaseClient()
  let boardId: string

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-fps-${Date.now()}`)
  })

  test.afterEach(async () => {
    await cleanupBoard(sb, boardId)
  })

  test('60 FPS during object drag with 50 objects', async ({ browser }) => {

    await seedObjects(sb, boardId, 50, 'sticky_note')

    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      USER_A_ID,
      undefined,
      { waitForRealtime: false },
    )

    try {
      await waitForObjectCount(page, 50, 10000)

      // Select tool should be default
      await page.getByRole('button', { name: /Select/ }).click()
      await page.waitForTimeout(500)

      await startFpsMeasurement(page)

      // Click on an object position to select it, then drag
      const canvas = page.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      // First object should be around (100, 100) on canvas
      // Click near origin area to select an object
      const objX = box.x + 200
      const objY = box.y + 200
      await page.mouse.click(objX, objY)
      await page.waitForTimeout(200)

      // Drag the selected area
      await page.mouse.move(objX, objY)
      await page.mouse.down()
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(objX + i * 10, objY + i * 5, { steps: 2 })
        await page.waitForTimeout(50)
      }
      await page.mouse.up()

      const fps = await stopFpsMeasurement(page)
      console.log(
        `FPS during drag with 50 objects — avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      savePerfResult({
        test: '50-object-fps-drag',
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
