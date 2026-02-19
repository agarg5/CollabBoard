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
      // Wait for all objects to load via REST fetch
      await waitForObjectCount(page, 100, 15000)

      // Select the Hand tool for panning
      await page.getByRole('button', { name: /Hand/ }).click()
      await page.waitForTimeout(500)

      // Start measuring FPS
      await startFpsMeasurement(page)

      // Simulate a pan gesture (drag across canvas)
      const canvas = page.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      const startX = box.x + box.width / 2
      const startY = box.y + box.height / 2
      await page.mouse.move(startX, startY)
      await page.mouse.down()
      // Pan in 20 steps over ~1 second
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(
          startX - i * 15,
          startY - i * 10,
          { steps: 2 },
        )
        await page.waitForTimeout(50)
      }
      await page.mouse.up()

      const fps = await stopFpsMeasurement(page)
      console.log(
        `FPS with 100 objects — avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      // Expect at least 50 avg FPS (allowing some headroom below 60)
      expect(fps.avg).toBeGreaterThanOrEqual(50)
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
      // Wait for all objects to load via REST fetch (longer timeout for 500 objects)
      await waitForObjectCount(page, 500, 30000)
      await page.waitForTimeout(1000) // Let renderer settle

      await startFpsMeasurement(page)

      // Simulate zoom via mouse wheel on canvas
      const canvas = page.locator('canvas').first()
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas not found')

      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)

      // Zoom out then in (10 scroll events each way)
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 100) // zoom out
        await page.waitForTimeout(100)
      }
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, -100) // zoom in
        await page.waitForTimeout(100)
      }

      const fps = await stopFpsMeasurement(page)
      console.log(
        `FPS with 500 objects — avg: ${fps.avg}, min: ${fps.min}, p95: ${fps.p95}, frames: ${fps.frameCount}`,
      )

      // Relaxed threshold: at least 30 FPS (no virtualization yet)
      expect(fps.avg).toBeGreaterThanOrEqual(30)
    } finally {
      await context.close()
    }
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

      expect(fps.avg).toBeGreaterThanOrEqual(50)
    } finally {
      await context.close()
    }
  })
})
