import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, goBackToBoardList } from './helpers'

test.describe('Canvas interactions', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E Canvas')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('toolbar shows all tools', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Select/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Hand/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sticky Note/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Rectangle/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Circle/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Line/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Connector/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Text/ })).toBeVisible()
  })

  test('can switch tools', async ({ page }) => {
    const rectButton = page.getByRole('button', { name: /Rectangle/ })
    await rectButton.click()
    await expect(rectButton).toHaveClass(/bg-blue-100/)

    const circleButton = page.getByRole('button', { name: /Circle/ })
    await circleButton.click()
    await expect(circleButton).toHaveClass(/bg-blue-100/)
    await expect(rectButton).not.toHaveClass(/bg-blue-100/)
  })

  test('can navigate back to board list', async ({ page }) => {
    await goBackToBoardList(page)
    // afterEach will handle cleanup from board list
  })

  test('shows user email in header', async ({ page }) => {
    await expect(page.getByText('dev@collabboard.local')).toBeVisible()
  })
})
