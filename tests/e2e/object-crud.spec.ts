import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, clickCanvasCenter, getCanvas } from './helpers'

test.describe('Object CRUD', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E CRUD')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('create a sticky note by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    // Tool should switch back to Select after creation
    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    // Delete button should appear (object is auto-selected after creation)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('create a rectangle by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('create a circle by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Circle/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('create a line by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Line/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('delete an object using toolbar button', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    const deleteBtn = page.getByTitle('Delete selected')
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    await expect(deleteBtn).not.toBeVisible()
  })

  test('delete an object using keyboard Delete key', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)
    await expect(page.getByTitle('Delete selected')).toBeVisible()

    await page.keyboard.press('Delete')

    await expect(page.getByTitle('Delete selected')).not.toBeVisible()
  })

  test('duplicate an object using toolbar button', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    const dupBtn = page.getByTitle('Duplicate (Ctrl+D)')
    await expect(dupBtn).toBeVisible()
    await dupBtn.click()

    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('copy and paste an object', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    const copyBtn = page.getByTitle('Copy (Ctrl+C)')
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()

    const pasteBtn = page.getByTitle('Paste (Ctrl+V)')
    await expect(pasteBtn).toBeVisible()
    await pasteBtn.click()

    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('deselect by clicking empty canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)
    await expect(page.getByTitle('Delete selected')).toBeVisible()

    // Click on empty area (top-left corner, away from center object)
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    await page.mouse.click(box.x + 20, box.y + 20)

    await expect(page.getByTitle('Delete selected')).not.toBeVisible()
  })

  test('change sticky note color', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    const pinkColor = page.getByTitle('Pink')
    await expect(pinkColor).toBeVisible()
    await pinkColor.click()

    await expect(pinkColor).toHaveClass(/border-gray-600/)
  })

  test('change shape color', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)

    // Wait for toolbar to stabilize after selection state change
    await expect(page.getByTitle('Red')).toBeVisible()
    await page.waitForTimeout(100)
    await page.getByTitle('Red').click({ force: true })

    await expect(page.getByTitle('Red')).toHaveClass(/border-gray-600/)
  })
})
