import { test, expect, type CDPSession } from '@playwright/test'
import {
  createSupabaseClient,
  createAnonClient,
  createBoard,
  cleanupBoard,
  openBoardAsUser,
  openTwoUsers,
  getObjectCount,
  waitForObjectCount,
  createTestUser,
  deleteTestUser,
  type TestSession,
} from './perf-helpers'

test.describe('Network resilience (Scenario 4)', () => {
  const sb = createSupabaseClient()
  const anonSb = createAnonClient()
  let boardId: string
  let userA: TestSession
  let userB: TestSession

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-network-${Date.now()}`)
    userA = await createTestUser(sb, anonSb)
    userB = await createTestUser(sb, anonSb)
  })

  test.afterEach(async () => {
    if (boardId) await cleanupBoard(sb, boardId)
    await Promise.all([
      userA && deleteTestUser(sb, userA.userId).catch(() => {}),
      userB && deleteTestUser(sb, userB.userId).catch(() => {}),
    ])
  })

  test('survives slow 3G network conditions', async ({ browser }) => {

    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      userA.userId,
      undefined,
      { session: userA },
    )

    try {
      // Insert 2 objects at normal speed
      for (let i = 0; i < 2; i++) {
        await sb.from('board_objects').insert({
          id: crypto.randomUUID(),
          board_id: boardId,
          type: 'sticky_note',
          properties: { text: `Pre-throttle ${i}`, color: '#fef08a' },
          x: 100 + i * 250,
          y: 100,
          width: 200,
          height: 200,
          z_index: i + 1,
          created_by: null,
          updated_at: new Date().toISOString(),
        })
      }
      await waitForObjectCount(page, 2, 5000)

      // Enable network throttling (slow 3G: ~400ms latency, ~50KB/s)
      const cdp: CDPSession = await page.context().newCDPSession(page)
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024,
        uploadThroughput: 50 * 1024,
        latency: 400,
      })

      // Insert 2 more objects under throttled conditions
      for (let i = 2; i < 4; i++) {
        await sb.from('board_objects').insert({
          id: crypto.randomUUID(),
          board_id: boardId,
          type: 'rectangle',
          properties: { fillColor: '#3b82f6', strokeColor: '#1e293b' },
          x: 100 + i * 250,
          y: 100,
          width: 200,
          height: 200,
          z_index: i + 1,
          created_by: null,
          updated_at: new Date().toISOString(),
        })
      }

      // Wait longer due to throttle
      const arrived = await waitForObjectCount(page, 4, 15000)
      expect(arrived).toBeGreaterThan(-1)

      // Disable throttle
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0,
      })

      // Reload to verify persistence
      await page.reload()
      await page.getByText('My Boards').waitFor({ timeout: 10000 })
      await page.evaluate((bid: string) => {
        const store = (window as Record<string, unknown>).__boardStore as {
          getState: () => { setBoardId: (id: string) => void }
        }
        store.getState().setBoardId(bid)
      }, boardId)
      await page
        .getByRole('button', { name: /Select/ })
        .waitFor({ timeout: 15000 })

      // Wait for objects to load from DB after reload
      const loaded = await waitForObjectCount(page, 4, 10000)
      expect(loaded).toBeGreaterThan(-1)

      const count = await getObjectCount(page)
      expect(count).toBe(4)
    } finally {
      await context.close()
    }
  })

  test('disconnect and reconnect restores state', async ({ browser }) => {

    const { page, context } = await openBoardAsUser(
      browser,
      boardId,
      userA.userId,
      undefined,
      { session: userA },
    )

    try {
      // Create objects
      for (let i = 0; i < 3; i++) {
        await sb.from('board_objects').insert({
          id: crypto.randomUUID(),
          board_id: boardId,
          type: 'sticky_note',
          properties: { text: `Offline test ${i}`, color: '#fef08a' },
          x: 100 + i * 250,
          y: 100,
          width: 200,
          height: 200,
          z_index: i + 1,
          created_by: null,
          updated_at: new Date().toISOString(),
        })
      }
      await waitForObjectCount(page, 3, 5000)

      // Go offline
      await context.setOffline(true)
      await page.waitForTimeout(2000)

      // Come back online
      await context.setOffline(false)
      await page.waitForTimeout(3000)

      // Objects should still be present (from store memory + reconnect refetch)
      const count = await getObjectCount(page)
      expect(count).toBe(3)
    } finally {
      await context.close()
    }
  })

  test('objects created during disconnect appear after reconnect', async ({
    browser,
  }) => {

    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
      undefined,
      { sessionA: userA, sessionB: userB },
    )

    try {
      // Seed initial object so both pages are subscribed
      await sb.from('board_objects').insert({
        id: crypto.randomUUID(),
        board_id: boardId,
        type: 'sticky_note',
        properties: { text: 'Initial', color: '#fef08a' },
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        z_index: 1,
        created_by: null,
        updated_at: new Date().toISOString(),
      })
      await waitForObjectCount(pageA, 1, 5000)
      await waitForObjectCount(pageB, 1, 5000)

      // Page A goes offline
      await contextA.setOffline(true)
      await pageA.waitForTimeout(1000)

      // Page B creates 3 objects while A is offline
      for (let i = 0; i < 3; i++) {
        await sb.from('board_objects').insert({
          id: crypto.randomUUID(),
          board_id: boardId,
          type: 'rectangle',
          properties: { fillColor: '#ef4444', strokeColor: '#1e293b' },
          x: 300 + i * 250,
          y: 300,
          width: 200,
          height: 200,
          z_index: i + 10,
          created_by: null,
          updated_at: new Date().toISOString(),
        })
      }
      // Page B should see them
      await waitForObjectCount(pageB, 4, 5000)

      // Page A comes back online — reconnect should refetch
      await contextA.setOffline(false)

      // Give time for reconnect + refetch
      const arrived = await waitForObjectCount(pageA, 4, 10000)
      expect(arrived).toBeGreaterThan(-1)

      const countA = await getObjectCount(pageA)
      expect(countA).toBe(4)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})
