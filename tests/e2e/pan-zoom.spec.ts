import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, getCanvas, getStagePosition, getStageScale } from './helpers'

test.describe('Pan and zoom (infinite canvas)', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E Pan-Zoom')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('pan canvas using hand tool', async ({ page }) => {
    const posBefore = await getStagePosition(page)

    await page.getByRole('button', { name: /Hand/ }).click()

    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 200, startY + 150, { steps: 10 })
    await page.mouse.up()

    // Verify the stage position actually changed after panning
    const posAfter = await getStagePosition(page)
    expect(posAfter.x).not.toBe(posBefore.x)
    expect(posAfter.y).not.toBe(posBefore.y)
    // Should have moved roughly in the drag direction
    expect(posAfter.x - posBefore.x).toBeGreaterThan(100)
    expect(posAfter.y - posBefore.y).toBeGreaterThan(50)
  })

  test('zoom canvas using scroll wheel', async ({ page }) => {
    const scaleBefore = await getStageScale(page)
    expect(scaleBefore).toBe(1) // Default scale

    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    // Zoom in with negative deltaY
    await page.mouse.wheel(0, -300)

    // Wait for scale to actually change (poll instead of fixed timeout)
    await expect(async () => {
      const scale = await getStageScale(page)
      expect(scale).toBeGreaterThan(1)
    }).toPass({ timeout: 2000 })

    const scaleZoomedIn = await getStageScale(page)
    expect(scaleZoomedIn).toBeGreaterThan(scaleBefore)

    // Zoom out with positive deltaY
    await page.mouse.wheel(0, 600)

    await expect(async () => {
      const scale = await getStageScale(page)
      expect(scale).toBeLessThan(scaleZoomedIn)
    }).toPass({ timeout: 2000 })
  })
})
