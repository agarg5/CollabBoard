import { test, expect } from '@playwright/test'
import { setupBoard, cleanupBoard, clickCanvasCenter, expectObjectCount, getCanvas } from './helpers'

test.describe('Object rotation', () => {
  let boardName: string

  test.beforeEach(async ({ page }) => {
    boardName = await setupBoard(page, 'E2E Rotation')
  })

  test.afterEach(async ({ page }) => {
    await cleanupBoard(page, boardName)
  })

  test('rotation handle is visible when object is selected', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    // The Transformer adds a rotation anchor — check it exists on the canvas
    const rotateAnchor = await page.evaluate(() => {
      const stage = (window as unknown as { Konva?: { stages?: Array<{ findOne: (s: string) => unknown }> } }).Konva?.stages?.[0]
      if (!stage) return false
      // Transformer creates an anchor with name '_rotater'
      const rotater = stage.findOne('._rotater')
      return !!rotater
    })
    expect(rotateAnchor).toBe(true)
  })

  test('new objects have rotation 0 by default', async ({ page }) => {
    await page.getByRole('button', { name: /Sticky note/i }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    const rotation = await page.evaluate(() => {
      const store = (window as unknown as Record<string, { getState: () => { objects: Array<{ rotation: number }> } }>).__boardStore
      return store.getState().objects[0]?.rotation
    })
    expect(rotation).toBe(0)
  })

  test('rotating an object persists the rotation value', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    // Simulate rotation by directly setting it via the store (since mouse-based rotation
    // on canvas is hard to control precisely in E2E tests)
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, { getState: () => { objects: Array<{ id: string }>, updateObject: (id: string, changes: Record<string, unknown>) => void } }>).__boardStore
      const obj = store.getState().objects[0]
      if (obj) store.getState().updateObject(obj.id, { rotation: 45 })
    })

    const rotation = await page.evaluate(() => {
      const store = (window as unknown as Record<string, { getState: () => { objects: Array<{ rotation: number }> } }>).__boardStore
      return store.getState().objects[0]?.rotation
    })
    expect(rotation).toBe(45)
  })

  test('duplicated object preserves rotation', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/ }).click()
    await clickCanvasCenter(page)
    await expectObjectCount(page, 1)

    // Set rotation on the object
    await page.evaluate(() => {
      const store = (window as unknown as Record<string, { getState: () => { objects: Array<{ id: string }>, updateObject: (id: string, changes: Record<string, unknown>) => void } }>).__boardStore
      const obj = store.getState().objects[0]
      if (obj) store.getState().updateObject(obj.id, { rotation: 90 })
    })

    // Duplicate using toolbar
    const dupBtn = page.getByRole('button', { name: /Duplicate selected/ })
    await expect(dupBtn).toBeVisible()
    await dupBtn.click()
    await expectObjectCount(page, 2)

    const rotations = await page.evaluate(() => {
      const store = (window as unknown as Record<string, { getState: () => { objects: Array<{ rotation: number }> } }>).__boardStore
      return store.getState().objects.map((o) => o.rotation)
    })
    expect(rotations).toContain(90)
    expect(rotations.filter((r) => r === 90)).toHaveLength(2)
  })
})
