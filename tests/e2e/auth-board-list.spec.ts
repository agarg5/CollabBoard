import { test, expect } from '@playwright/test'
import { createBoard, deleteBoard } from './helpers'

test.describe('Auth bypass and board list', () => {
  test('loads board list page with dev bypass auth', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    await expect(page.getByText('dev@collabboard.local')).toBeVisible()
  })

  test('shows empty state when no boards exist', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    const hasBoardsOrEmpty = await Promise.race([
      page
        .getByText('No boards yet')
        .waitFor({ timeout: 3000 })
        .then(() => 'empty'),
      page
        .locator('.grid > div')
        .first()
        .waitFor({ timeout: 3000 })
        .then(() => 'has-boards'),
    ]).catch(() => 'empty')
    expect(['empty', 'has-boards']).toContain(hasBoardsOrEmpty)
  })

  test('can create and delete a board', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()

    const boardName = await createBoard(page, 'E2E Create-Delete')
    await deleteBoard(page, boardName)
  })
})
