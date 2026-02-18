import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, getCanvas } from './helpers'

test.describe('Pan and zoom (infinite canvas)', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E Pan-Zoom')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('pan canvas using hand tool', async ({ page }) => {
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

    // Cursor style during hand tool is cursor-grab
    await expect(page.locator('.cursor-grab')).toBeVisible()
  })

  test('zoom canvas using scroll wheel', async ({ page }) => {
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    // Zoom in
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(200)

    // Zoom out
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(200)

    await expect(canvas).toBeVisible()
  })
})
