import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, getCanvas } from './helpers'

test.describe('Multiple object types on one board', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E Multi-Obj')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('create sticky note, rectangle, and circle on the same board', async ({ page }) => {
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    // Create sticky note at top-left area
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.3)

    // Deselect
    await page.mouse.click(box.x + 10, box.y + 10)
    await expect(page.getByTitle('Delete selected')).not.toBeVisible()

    // Create rectangle at center
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)

    // Deselect
    await page.mouse.click(box.x + 10, box.y + 10)

    // Create circle at bottom-right area
    await page.getByRole('button', { name: /Circle/ }).click()
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.7)

    // After creating all three, tool should be back to Select
    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
  })

  test('select all objects with Ctrl+A', async ({ page }) => {
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    // Create two objects
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3)

    await page.getByRole('button', { name: /Rectangle/ }).click()
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.7)

    // Deselect
    await page.mouse.click(box.x + 10, box.y + 10)
    await expect(page.getByTitle('Delete selected')).not.toBeVisible()

    // Select all with Ctrl+A
    await page.keyboard.press('Meta+a')

    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })
})
