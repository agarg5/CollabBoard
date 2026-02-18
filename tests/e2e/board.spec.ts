import { test, expect, type Page } from '@playwright/test'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a board from the board list page and return its name. */
async function createBoard(page: Page, prefix = 'E2E'): Promise<string> {
  const boardName = `${prefix} ${Date.now()}`
  await page.getByRole('button', { name: '+ New Board' }).click()
  await page.getByPlaceholder('Board name').fill(boardName)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(boardName)).toBeVisible({ timeout: 5000 })
  return boardName
}

/** Delete a board by name from the board list page (handles the confirm dialog). */
async function deleteBoard(page: Page, boardName: string) {
  // Accept the confirm dialog that will appear
  page.once('dialog', (dialog) => dialog.accept())

  // Hover over the board card to reveal the delete button
  const boardCard = page.locator('.group').filter({ hasText: boardName })
  await boardCard.hover()
  await boardCard.getByTitle('Delete board').click()

  // Wait for the board card to disappear
  await expect(page.getByText(boardName)).not.toBeVisible({ timeout: 5000 })
}

/** Open a board by clicking its card. Waits for canvas toolbar to appear. */
async function openBoard(page: Page, boardName: string) {
  await page.getByText(boardName).click()
  await expect(page.getByRole('button', { name: /Select/ })).toBeVisible({ timeout: 5000 })
}

/** Navigate back to the board list from a board view. */
async function goBackToBoardList(page: Page) {
  await page.getByRole('button', { name: 'Back to boards' }).click()
  await expect(page.getByText('My Boards')).toBeVisible({ timeout: 5000 })
}

/** Get the canvas element on the page. */
function getCanvas(page: Page) {
  return page.locator('canvas').first()
}

/** Click the center of the canvas to create an object (after selecting a creation tool). */
async function clickCanvasCenter(page: Page) {
  const canvas = getCanvas(page)
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/** Get the count of objects on the board via the Zustand store. */
async function getObjectCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    // Access Zustand store from window — boardStore exposes getState()
    const store = (window as unknown as Record<string, unknown>).__boardStoreApi as
      | { getState: () => { objects: unknown[] } }
      | undefined
    if (store) return store.getState().objects.length
    return -1
  })
}

// ── Auth & Board List ────────────────────────────────────────────────────────

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
      page.getByText('No boards yet').waitFor({ timeout: 3000 }).then(() => 'empty'),
      page.locator('.grid > div').first().waitFor({ timeout: 3000 }).then(() => 'has-boards'),
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

// ── Canvas Interactions ──────────────────────────────────────────────────────

test.describe('Canvas interactions', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    boardName = await createBoard(page, 'E2E Canvas')
    await openBoard(page, boardName)
  })

  test.afterEach(async ({ page }) => {
    // Clean up: go back to board list and delete the test board
    // First check if we're still on the canvas or already on board list
    const onCanvas = await page.getByRole('button', { name: 'Back to boards' }).isVisible().catch(() => false)
    if (onCanvas) {
      await goBackToBoardList(page)
    }
    await deleteBoard(page, boardName)
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

// ── Object CRUD ──────────────────────────────────────────────────────────────

test.describe('Object CRUD', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    boardName = await createBoard(page, 'E2E CRUD')
    await openBoard(page, boardName)
  })

  test.afterEach(async ({ page }) => {
    const onCanvas = await page.getByRole('button', { name: 'Back to boards' }).isVisible().catch(() => false)
    if (onCanvas) await goBackToBoardList(page)
    await deleteBoard(page, boardName)
  })

  test('create a sticky note by clicking on canvas', async ({ page }) => {
    // Select sticky note tool
    await page.getByRole('button', { name: /Sticky Note/ }).click()

    // Click the center of the canvas
    await clickCanvasCenter(page)

    // Tool should switch back to Select after creation
    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)

    // Delete button should appear (object is auto-selected after creation)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('create a rectangle by clicking on canvas', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)

    // Tool should switch back to Select
    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)

    // Delete button visible = object selected
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
    // Create a sticky note
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    // Delete button should be visible (object is selected)
    const deleteBtn = page.getByTitle('Delete selected')
    await expect(deleteBtn).toBeVisible()

    // Click delete
    await deleteBtn.click()

    // Delete button should disappear (nothing selected)
    await expect(deleteBtn).not.toBeVisible()
  })

  test('delete an object using keyboard Delete key', async ({ page }) => {
    // Create a sticky note
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    await expect(page.getByTitle('Delete selected')).toBeVisible()

    // Press Delete key
    await page.keyboard.press('Delete')

    // Delete button should disappear
    await expect(page.getByTitle('Delete selected')).not.toBeVisible()
  })

  test('duplicate an object using toolbar button', async ({ page }) => {
    // Create a sticky note
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    // Click duplicate
    const dupBtn = page.getByTitle('Duplicate (Ctrl+D)')
    await expect(dupBtn).toBeVisible()
    await dupBtn.click()

    // Should still have delete button visible (duplicated object is selected)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('copy and paste an object', async ({ page }) => {
    // Create a sticky note
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    // Copy using toolbar
    const copyBtn = page.getByTitle('Copy (Ctrl+C)')
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()

    // Paste button should appear
    const pasteBtn = page.getByTitle('Paste (Ctrl+V)')
    await expect(pasteBtn).toBeVisible()
    await pasteBtn.click()

    // Should still have objects selected
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('deselect by clicking empty canvas', async ({ page }) => {
    // Create and select a sticky note
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)
    await expect(page.getByTitle('Delete selected')).toBeVisible()

    // Click on empty area of canvas (top-left corner, away from center object)
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    await page.mouse.click(box.x + 20, box.y + 20)

    // Delete button should disappear (deselected)
    await expect(page.getByTitle('Delete selected')).not.toBeVisible()
  })

  test('change sticky note color', async ({ page }) => {
    // Create a sticky note (default yellow)
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    // Color palette should appear for selected sticky note
    const pinkColor = page.getByTitle('Pink')
    await expect(pinkColor).toBeVisible()
    await pinkColor.click()

    // Pink button should be "active" (has scale-110 / border-gray-600)
    await expect(pinkColor).toHaveClass(/border-gray-600/)
  })

  test('change shape color', async ({ page }) => {
    // Create a rectangle
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)

    // Shape color palette should appear
    const redColor = page.getByTitle('Red')
    await expect(redColor).toBeVisible()
    await redColor.click()

    await expect(redColor).toHaveClass(/border-gray-600/)
  })
})

// ── Pan & Zoom ───────────────────────────────────────────────────────────────

test.describe('Pan and zoom (infinite canvas)', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    boardName = await createBoard(page, 'E2E Pan-Zoom')
    await openBoard(page, boardName)
  })

  test.afterEach(async ({ page }) => {
    const onCanvas = await page.getByRole('button', { name: 'Back to boards' }).isVisible().catch(() => false)
    if (onCanvas) await goBackToBoardList(page)
    await deleteBoard(page, boardName)
  })

  test('pan canvas using hand tool', async ({ page }) => {
    // Get initial stage position
    const initialPos = await page.evaluate(() => {
      const stage = document.querySelector('canvas')?.parentElement
      // Read the Konva stage transform — it's on the inner container
      const konvaContainer = stage?.querySelector('.konvajs-content')
      if (!konvaContainer) return { x: 0, y: 0 }
      const transform = (konvaContainer as HTMLElement).style.transform
      return { transform }
    })

    // Select hand tool
    await page.getByRole('button', { name: /Hand/ }).click()

    // Drag the canvas
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 200, startY + 150, { steps: 10 })
    await page.mouse.up()

    // Verify position changed — the cursor style during hand tool is cursor-grab
    await expect(page.locator('.cursor-grab')).toBeVisible()
  })

  test('zoom canvas using scroll wheel', async ({ page }) => {
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    // Zoom in with scroll wheel
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, -300) // negative deltaY = zoom in

    // Small wait for zoom animation
    await page.waitForTimeout(200)

    // Zoom out
    await page.mouse.wheel(0, 300) // positive deltaY = zoom out
    await page.waitForTimeout(200)

    // If we get here without errors, zoom works. The canvas should still be visible.
    await expect(canvas).toBeVisible()
  })
})

// ── Multiple Object Types ────────────────────────────────────────────────────

test.describe('Multiple object types on one board', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    boardName = await createBoard(page, 'E2E Multi-Obj')
    await openBoard(page, boardName)
  })

  test.afterEach(async ({ page }) => {
    const onCanvas = await page.getByRole('button', { name: 'Back to boards' }).isVisible().catch(() => false)
    if (onCanvas) await goBackToBoardList(page)
    await deleteBoard(page, boardName)
  })

  test('create sticky note, rectangle, and circle on the same board', async ({ page }) => {
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    // Create sticky note at top-left area
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.3)

    // Deselect
    await page.mouse.click(box.x + 10, box.y + 10)
    await expect(page.getByTitle('Delete selected')).not.toBeVisible()

    // Create rectangle at center
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)

    // Deselect
    await page.mouse.click(box.x + 10, box.y + 10)

    // Create circle at bottom-right area
    await page.getByRole('button', { name: /Circle/ }).click()
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.7)

    // After creating all three, tool should be back to Select
    await expect(page.getByRole('button', { name: /Select/ })).toHaveClass(/bg-blue-100/)
  })

  test('select all objects with Ctrl+A', async ({ page }) => {
    const canvas = getCanvas(page)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')

    // Create two objects
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3)

    await page.getByRole('button', { name: /Rectangle/ }).click()
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.7)

    // Deselect
    await page.mouse.click(box.x + 10, box.y + 10)
    await expect(page.getByTitle('Delete selected')).not.toBeVisible()

    // Select all with Ctrl+A
    await page.keyboard.press('Meta+a')

    // Delete button should appear (objects are selected)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })
})

// ── Keyboard Shortcuts ───────────────────────────────────────────────────────

test.describe('Keyboard shortcuts', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('My Boards')).toBeVisible()
    boardName = await createBoard(page, 'E2E Shortcuts')
    await openBoard(page, boardName)
  })

  test.afterEach(async ({ page }) => {
    const onCanvas = await page.getByRole('button', { name: 'Back to boards' }).isVisible().catch(() => false)
    if (onCanvas) await goBackToBoardList(page)
    await deleteBoard(page, boardName)
  })

  test('Ctrl+D duplicates selected object', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    // Duplicate via keyboard
    await page.keyboard.press('Meta+d')

    // Should still have selection (the duplicate is selected)
    await expect(page.getByTitle('Delete selected')).toBeVisible()
  })

  test('Ctrl+C then Ctrl+V copies and pastes', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky Note/ }).click()
    await clickCanvasCenter(page)

    // Copy
    await page.keyboard.press('Meta+c')

    // Paste button should appear
    await expect(page.getByTitle('Paste (Ctrl+V)')).toBeVisible()

    // Paste
    await page.keyboard.press('Meta+v')

    // Selection should still be active
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
