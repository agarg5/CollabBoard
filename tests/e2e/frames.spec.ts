import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, clickCanvasCenter, expectObjectCount } from './helpers'

test.describe('Frames', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E Frames')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('create a frame by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Frame/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
    await expectObjectCount(page, 1)
  })

  test('frame is created with correct default properties', async ({ page }) => {
    await page.getByRole('button', { name: /Frame/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    const frameObj = await page.evaluate(() => {
      const store = (window as unknown as Record<string, { getState: () => { objects: Array<{ type: string; width: number; height: number; properties: Record<string, unknown> }> } }>).__boardStore
      const objects = store.getState().objects
      return objects.find((o) => o.type === 'frame')
    })

    expect(frameObj).toBeTruthy()
    expect(frameObj!.width).toBe(400)
    expect(frameObj!.height).toBe(300)
    expect(frameObj!.properties.label).toBe('Frame')
    expect(frameObj!.properties.strokeColor).toBe('#94a3b8')
  })

  test('delete a frame using toolbar button', async ({ page }) => {
    await page.getByRole('button', { name: /Frame/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    const deleteBtn = page.getByTitle('Delete selected')
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    await expect(deleteBtn).not.toBeVisible()
    await expectObjectCount(page, 0)
  })

  test('edit frame label by double-clicking', async ({ page }) => {
    await page.getByRole('button', { name: /Frame/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    // Double-click on canvas center to trigger label edit
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)

    // Wait for the textarea to appear (TextEditor)
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible({ timeout: 3000 })

    // Clear and type new label
    await textarea.fill('My Custom Frame')
    await textarea.blur()

    // Verify the label was updated in the store
    const label = await page.evaluate(() => {
      const store = (window as unknown as Record<string, { getState: () => { objects: Array<{ type: string; properties: Record<string, unknown> }> } }>).__boardStore
      const objects = store.getState().objects
      const frame = objects.find((o) => o.type === 'frame')
      return frame?.properties.label
    })
    expect(label).toBe('My Custom Frame')
  })
})
