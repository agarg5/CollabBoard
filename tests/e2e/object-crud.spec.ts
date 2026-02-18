import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, clickCanvasCenter, getCanvas, expectObjectCount } from './helpers'

test.describe('Object CRUD', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E CRUD')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('create a sticky note by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByRole('button', { name: 'Delete selected' })).toBeVisible()
    await expectObjectCount(page, 1)
  })

  test('create a rectangle by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByRole('button', { name: 'Delete selected' })).toBeVisible()
    await expectObjectCount(page, 1)
  })

  test('create a circle by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Circle/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByRole('button', { name: 'Delete selected' })).toBeVisible()
    await expectObjectCount(page, 1)
  })

  test('create a line by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Line/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByRole('button', { name: 'Delete selected' })).toBeVisible()
    await expectObjectCount(page, 1)
  })

  test('delete an object using toolbar button', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    const deleteBtn = page.getByRole('button', { name: 'Delete selected' })
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    await expect(deleteBtn).not.toBeVisible()
    await expectObjectCount(page, 0)
  })

  test('delete an object using keyboard Delete key', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    await page.keyboard.press('Delete')

    await expect(page.getByRole('button', { name: 'Delete selected' })).not.toBeVisible()
    await expectObjectCount(page, 0)
  })

  test('duplicate an object using toolbar button', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    const dupBtn = page.getByRole('button', { name: /Duplicate selected/ })
    await expect(dupBtn).toBeVisible()
    await dupBtn.click()

    await expectObjectCount(page, 2)
  })

  test('copy and paste an object', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    const copyBtn = page.getByRole('button', { name: /Copy selected/ })
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()

    const pasteBtn = page.getByRole('button', { name: /Paste/ })
    await expect(pasteBtn).toBeVisible()
    await pasteBtn.click()

    await expectObjectCount(page, 2)
  })

  test('deselect by clicking empty canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)
    await expect(page.getByRole('button', { name: 'Delete selected' })).toBeVisible()

    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    await page.mouse.click(box.x + 20, box.y + 20)

    await expect(page.getByRole('button', { name: 'Delete selected' })).not.toBeVisible()
  })

  test('change sticky note color', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)

    const pinkColor = page.getByRole('button', { name: /Pink/ })
    await expect(pinkColor).toHaveClass(/border-gray-300/)
    await pinkColor.click()

    await expect(pinkColor).toHaveClass(/border-gray-600/)
  })

  test('change shape color', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)

    const redColor = page.getByRole('button', { name: /Red/ })
    await expect(redColor).toHaveClass(/border-gray-300/)
    await redColor.click()

    await expect(page.getByRole('button', { name: /Red/ })).toHaveClass(/border-gray-600/)
  })
})
