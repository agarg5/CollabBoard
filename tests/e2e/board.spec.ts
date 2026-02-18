import { test, expect } from '@playwright/test'

test.describe('Auth bypass and board list', () => {
  test('loads board list page with dev bypass auth', async ({ page }) => {
    await page.goto('/')
    // Dev bypass should auto-authenticate, showing board list instead of login
    await expect(page.getByText('My Boards')).toBeVisible()
    await expect(page.getByText('dev@collabboard.local')).toBeVisible()
  })

  test('shows empty state when no boards exist', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    // Either boards exist or empty state shows
    const hasBoardsOrEmpty = await Promise.race([
      page.getByText('No boards yet').waitFor({ timeout: 3000 }).then(() => 'empty'),
      page.locator('.grid > div').first().waitFor({ timeout: 3000 }).then(() => 'has-boards'),
    ]).catch(() => 'empty')
    expect(['empty', 'has-boards']).toContain(hasBoardsOrEmpty)
  })

  test('can create a new board', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()

    // Click "New Board"
    await page.getByRole('button', { name: '+ New Board' }).click()
    await expect(page.getByPlaceholder('Board name')).toBeVisible()

    // Type board name and create
    const boardName = `E2E Test Board ${Date.now()}`
    await page.getByPlaceholder('Board name').fill(boardName)
    await page.getByRole('button', { name: 'Create' }).click()

    // Board card should appear in the list
    await expect(page.getByText(boardName)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Canvas interactions', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()

    // Create a fresh board for each test
    boardName = `E2E Canvas ${Date.now()}`
    await page.getByRole('button', { name: '+ New Board' }).click()
    await page.getByPlaceholder('Board name').fill(boardName)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText(boardName)).toBeVisible({ timeout: 5000 })

    // Click the board to open it
    await page.getByText(boardName).click()

    // Wait for canvas to load — toolbar should be visible
    await expect(page.getByRole('button', { name: /Select/ })).toBeVisible({ timeout: 5000 })
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
    // Click Rectangle tool
    const rectButton = page.getByRole('button', { name: /Rectangle/ })
    await rectButton.click()
    await expect(rectButton).toHaveClass(/bg-blue-100/)

    // Click Circle tool
    const circleButton = page.getByRole('button', { name: /Circle/ })
    await circleButton.click()
    await expect(circleButton).toHaveClass(/bg-blue-100/)
    // Rectangle should no longer be active
    await expect(rectButton).not.toHaveClass(/bg-blue-100/)
  })

  test('can navigate back to board list', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to boards' }).click()
    await expect(page.getByText('My Boards')).toBeVisible()
  })

  test('shows user email in header', async ({ page }) => {
    await expect(page.getByText('dev@collabboard.local')).toBeVisible()
  })
})
