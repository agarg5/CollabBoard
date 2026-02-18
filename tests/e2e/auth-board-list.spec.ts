import { test, expect } from '@playwright/test'
import { createBoard, deleteBoard } from './helpers'

test.describe('Auth bypass and board list', () => {
  test('loads board list page with dev bypass auth', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    await expect(page.getByText(/@collabboard\.local/)).toBeVisible()
  })

  test('can create and delete a board', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()

    // Count existing boards
    const countBefore = await page.getByTestId('board-card').count()

    // Create a board
    const boardName = await createBoard(page, 'E2E Create-Delete')
    expect(await page.getByTestId('board-card').count()).toBe(countBefore + 1)

    // Delete the board
    await deleteBoard(page, boardName)
    expect(await page.getByTestId('board-card').count()).toBe(countBefore)
  })
})
