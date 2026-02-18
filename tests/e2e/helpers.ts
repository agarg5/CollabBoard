import { expect, type Page } from '@playwright/test'

/** Create a board from the board list page and return its name. */
export async function createBoard(page: Page, prefix = 'E2E'): Promise<string> {
  const boardName = `${prefix} ${Date.now()}`
  await page.getByRole('button', { name: '+ New Board' }).click()
  await page.getByPlaceholder('Board name').fill(boardName)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(boardName)).toBeVisible({ timeout: 5000 })
  return boardName
}

/** Delete a board by name from the board list page (handles the confirm dialog). */
export async function deleteBoard(page: Page, boardName: string) {
  page.once('dialog', (dialog) => dialog.accept())
  const boardCard = page.locator('.group').filter({ hasText: boardName })
  await boardCard.hover()
  await boardCard.getByTitle('Delete board').click()
  await expect(page.getByText(boardName)).not.toBeVisible({ timeout: 5000 })
}

/** Open a board by clicking its card. Waits for canvas toolbar to appear. */
export async function openBoard(page: Page, boardName: string) {
  await page.getByText(boardName).click()
  await expect(page.getByRole('button', { name: /Select/ })).toBeVisible({ timeout: 5000 })
}

/** Navigate back to the board list from a board view. */
export async function goBackToBoardList(page: Page) {
  await page.getByRole('button', { name: 'Back to boards' }).click()
  await expect(page.getByText('My Boards')).toBeVisible({ timeout: 5000 })
}

/** Get the canvas element on the page. */
export function getCanvas(page: Page) {
  return page.locator('canvas').first()
}

/** Click the center of the canvas to create an object (after selecting a creation tool). */
export async function clickCanvasCenter(page: Page) {
  const canvas = getCanvas(page)
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/** Common beforeEach: go to board list, create a board, open it. Returns board name. */
export async function setupBoard(page: Page, prefix: string): Promise<string> {
  await page.goto('/')
  await expect(page.getByText('My Boards')).toBeVisible()
  const boardName = await createBoard(page, prefix)
  await openBoard(page, boardName)
  return boardName
}

/** Common afterEach: go back to board list if needed and delete the board. */
export async function cleanupBoard(page: Page, boardName: string) {
  const onCanvas = await page
    .getByRole('button', { name: 'Back to boards' })
    .isVisible()
    .catch(() => false)
  if (onCanvas) await goBackToBoardList(page)
  await deleteBoard(page, boardName)
}
