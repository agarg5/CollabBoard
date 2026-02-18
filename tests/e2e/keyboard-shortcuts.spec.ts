import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, clickCanvasCenter, expectObjectCount, MOD } from './helpers'

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
    await expectObjectCount(page, 1)

    await page.keyboard.press(`${MOD}+d`)

    await expectObjectCount(page, 2)
  })

  test('Ctrl+C then Ctrl+V copies and pastes', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    await page.keyboard.press(`${MOD}+c`)
    await expect(page.getByTitle('Paste (Ctrl+V)')).toBeVisible()

    await page.keyboard.press(`${MOD}+v`)
    await expectObjectCount(page, 2)
  })

  test('Backspace deletes selected object', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    await page.keyboard.press('Backspace')

    await expect(page.getByTitle('Delete selected')).not.toBeVisible()
    await expectObjectCount(page, 0)
  })
})
