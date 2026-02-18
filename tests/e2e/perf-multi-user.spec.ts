import { test, expect } from '@playwright/test'
import {
  createSupabaseClient,
  createBoard,
  cleanupBoard,
  openTwoUsers,
  openBoardAsUser,
  USER_A_ID,
  getObjectCount,
  waitForObjectCount,
} from './perf-helpers'

test.describe('Multi-user sync (Scenarios 1 & 2)', () => {
  const sb = createSupabaseClient()
  let boardId: string

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-multi-${Date.now()}`)
  })

  test.afterEach(async () => {
    await cleanupBoard(sb, boardId)
  })

  test("two users see each other's object creation within 500ms", async ({
    browser,
  }) => {
    const baseURL = 'http://localhost:5173'
    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
      baseURL,
    )

    try {
      // Ensure both pages start with 0 objects
      expect(await getObjectCount(pageA)).toBe(0)
      expect(await getObjectCount(pageB)).toBe(0)

      // Insert object via Supabase REST (server-side) — triggers postgres_changes
      const startMs = Date.now()
      await sb.from('board_objects').insert({
        id: crypto.randomUUID(),
        board_id: boardId,
        type: 'sticky_note',
        properties: { text: 'Sync test', color: '#fef08a' },
        x: 200,
        y: 200,
        width: 200,
        height: 200,
        z_index: 1,
        created_by: null,
        updated_at: new Date().toISOString(),
      })

      // Wait for both pages to see the object via realtime
      const latencyA = await waitForObjectCount(pageA, 1, 5000)
      const latencyB = await waitForObjectCount(pageB, 1, 5000)

      expect(latencyA).toBeGreaterThan(-1)
      expect(latencyB).toBeGreaterThan(-1)

      const totalA = Date.now() - startMs
      const totalB = Date.now() - startMs
      console.log(`Object sync latency — Page A: ${totalA}ms, Page B: ${totalB}ms`)

      // Relaxed threshold: within 500ms (REST + realtime + render)
      expect(totalA).toBeLessThan(500)
      expect(totalB).toBeLessThan(500)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test("cursor movement appears on other user's screen", async ({
    browser,
  }) => {
    const baseURL = 'http://localhost:5173'
    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
      baseURL,
    )

    try {
      // Move mouse on Page A's canvas to trigger cursor broadcast
      const canvas = pageA.locator('canvas').first()
      await canvas.hover({ position: { x: 300, y: 300 } })
      await pageA.waitForTimeout(200)
      await canvas.hover({ position: { x: 350, y: 350 } })
      await pageA.waitForTimeout(500)

      // Check Page B's presence store for User A's cursor
      const hasCursor = await pageB.evaluate((userAId: string) => {
        const store = (window as Record<string, unknown>).__presenceStore as {
          getState: () => { cursors: Record<string, { x: number; y: number }> }
        }
        const cursors = store.getState().cursors
        return userAId in cursors
      }, USER_A_ID)

      expect(hasCursor).toBe(true)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test('refresh mid-edit preserves all objects', async ({ browser }) => {
    const baseURL = 'http://localhost:5173'
    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      USER_A_ID,
      baseURL,
    )

    try {
      // Create 3 objects directly in DB
      const types = ['sticky_note', 'rectangle', 'circle'] as const
      for (let i = 0; i < 3; i++) {
        await sb.from('board_objects').insert({
          id: crypto.randomUUID(),
          board_id: boardId,
          type: types[i],
          properties:
            types[i] === 'sticky_note'
              ? { text: `Note ${i}`, color: '#fef08a' }
              : { fillColor: '#3b82f6', strokeColor: '#1e293b' },
          x: 100 + i * 250,
          y: 100,
          width: 200,
          height: 200,
          z_index: i + 1,
          created_by: null,
          updated_at: new Date().toISOString(),
        })
      }

      // Wait for objects to appear via realtime
      const arrived = await waitForObjectCount(page, 3, 5000)
      expect(arrived).toBeGreaterThan(-1)

      // Reload the page
      await page.reload()
      await page.getByText('My Boards').waitFor({ timeout: 10000 })

      // Re-navigate to the board
      await page.evaluate((bid: string) => {
        const store = (window as Record<string, unknown>).__boardStore as {
          getState: () => { setBoardId: (id: string) => void }
        }
        store.getState().setBoardId(bid)
      }, boardId)

      await page
        .getByRole('button', { name: /Select/ })
        .waitFor({ timeout: 15000 })

      // Wait for objects to load from DB on reconnect
      const loaded = await waitForObjectCount(page, 3, 5000)
      expect(loaded).toBeGreaterThan(-1)

      const count = await getObjectCount(page)
      expect(count).toBe(3)
    } finally {
      await context.close()
    }
  })
})
