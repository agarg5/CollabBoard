import { test, expect } from '@playwright/test'
import { openBoard, getCanvas } from './helpers'

test.describe('Fun Board Demo Video', () => {
  test('record fun board demo video', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Wait for page to load - check for either board list or canvas
    try {
      await expect(page.getByText('My Boards')).toBeVisible({ timeout: 15000 })
      // Wait for page to fully load
      await page.waitForTimeout(1000)

      // Try to find the fun board
      const funBoardText = page.getByText('Fun Board 🎉').first()
      
      if (await funBoardText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await funBoardText.click()
      } else {
        // Navigate directly to the fun board
        await page.goto(`/board/11111111-1111-1111-1111-111111111111`)
      }
    } catch {
      // If board list doesn't load, try going directly to the board
      console.log('Board list not found, navigating directly to fun board')
      await page.goto(`/board/11111111-1111-1111-1111-111111111111`)
    }

    // Wait for canvas to load
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000) // Give time for objects to render

    // Get canvas for interactions
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    // Pan to show the board better
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 100, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(500)

    // Zoom in
    await page.keyboard.press('Control+=')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+=')
    await page.waitForTimeout(1000)

    // Pan to center content
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(1000)

    // Click on a sticky note
    await page.mouse.click(box.x + box.width / 2 - 100, box.y + box.height / 2 - 150)
    await page.waitForTimeout(500)

    // Click elsewhere to deselect
    await page.mouse.click(box.x + box.width / 2 + 200, box.y + box.height / 2 + 200)
    await page.waitForTimeout(500)

    // Pan to show more
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2, { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(1000)

    // Final pause
    await page.waitForTimeout(2000)
  })
})
