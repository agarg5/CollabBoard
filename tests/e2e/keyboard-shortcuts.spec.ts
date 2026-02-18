import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, clickCanvasCenter } from './helpers'

test.describe('Keyboard shortcuts', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E Shortcuts')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('Ctrl+D duplicates selected object', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    await page.keyboard.press('Meta+d')

    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('Ctrl+C then Ctrl+V copies and pastes', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    await page.keyboard.press('Meta+c')
    await expect(page.getByTitle('Paste (Ctrl+V)')).toBeVisible()

    await page.keyboard.press('Meta+v')
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('Backspace deletes selected object', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)
    await expect(page.getByTitle('Delete selected')).toBeVisible()

    await page.keyboard.press('Backspace')

    await expect(page.getByTitle('Delete selected')).not.toBeVisible()
  })
})
