import { test, expect } from '@playwright/test'
import {
  createSupabaseClient,
  createAnonClient,
  createBoard,
  cleanupBoard,
  seedObjects,
  openTwoUsers,
  getObjectCount,
  waitForObjectCount,
  createTestUser,
  deleteTestUser,
  savePerfResult,
  type TestSession,
} from './perf-helpers'

test.describe('Rapid sync (Scenario 3)', () => {
  const sb = createSupabaseClient()
  const anonSb = createAnonClient()
  let boardId: string
  let userA: TestSession
  let userB: TestSession

  test.beforeEach(async () => {
    boardId = await createBoard(sb, `perf-rapid-${Date.now()}`)
    ;[userA, userB] = await Promise.all([
      createTestUser(sb, anonSb),
      createTestUser(sb, anonSb),
    ])
  })

  test.afterEach(async () => {
    await cleanupBoard(sb, boardId)
    await Promise.all([
      deleteTestUser(sb, userA.userId),
      deleteTestUser(sb, userB.userId),
    ])
  })

  test('20 rapid object creations all sync to second user', async ({
    browser,
  }) => {

    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
      undefined,
      { sessionA: userA, sessionB: userB },
    )

    try {
      // Rapidly insert 20 objects with 50ms spacing via REST
      const insertCount = 20
      for (let i = 0; i < insertCount; i++) {
        await sb.from('board_objects').insert({
          id: crypto.randomUUID(),
          board_id: boardId,
          type: 'sticky_note',
          properties: { text: `Rapid ${i}`, color: '#fef08a' },
          x: 100 + (i % 5) * 220,
          y: 100 + Math.floor(i / 5) * 220,
          width: 200,
          height: 200,
          z_index: i + 1,
          created_by: null,
          updated_at: new Date().toISOString(),
        })
        // Small delay between inserts to simulate rapid creation
        await new Promise((r) => setTimeout(r, 50))
      }

      // Wait for both pages to have all 20 objects (generous timeout)
      const latencyA = await waitForObjectCount(pageA, insertCount, 10000)
      const latencyB = await waitForObjectCount(pageB, insertCount, 10000)

      expect(latencyA).toBeGreaterThan(-1)
      expect(latencyB).toBeGreaterThan(-1)

      const countA = await getObjectCount(pageA)
      const countB = await getObjectCount(pageB)
      expect(countA).toBe(insertCount)
      expect(countB).toBe(insertCount)

      console.log(
        `Rapid sync: Page A got ${countA} objects, Page B got ${countB} objects`,
      )

      savePerfResult({
        test: 'rapid-sync-20-objects',
        timestamp: new Date().toISOString(),
        metrics: { countA, countB, latencyA, latencyB },
        passed: countA === insertCount && countB === insertCount,
      })
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test('rapid object updates converge within 2s', async ({ browser }) => {

    // Seed one object first
    const [objId] = await seedObjects(sb, boardId, 1, 'sticky_note')

    const { pageA, pageB, contextA, contextB } = await openTwoUsers(
      browser,
      boardId,
      undefined,
      { sessionA: userA, sessionB: userB },
    )

    try {
      // Wait for both pages to see the seeded object
      await waitForObjectCount(pageA, 1, 5000)
      await waitForObjectCount(pageB, 1, 5000)

      // Rapidly update the object's position 20 times (simulating drag)
      for (let i = 0; i < 20; i++) {
        await sb
          .from('board_objects')
          .update({
            x: 100 + i * 15,
            y: 100 + i * 10,
            updated_at: new Date().toISOString(),
          })
          .eq('id', objId)
        await new Promise((r) => setTimeout(r, 50))
      }

      // Final position: x=385, y=290
      const finalX = 100 + 19 * 15
      const finalY = 100 + 19 * 10

      // Wait for Page B to converge to the final position
      const start = Date.now()
      let converged = false
      while (Date.now() - start < 5000) {
        const pos = await pageB.evaluate((oid: string) => {
          const store = (window as Record<string, unknown>).__boardStore as {
            getState: () => {
              objects: Array<{ id: string; x: number; y: number }>
            }
          }
          const obj = store.getState().objects.find((o) => o.id === oid)
          return obj ? { x: obj.x, y: obj.y } : null
        }, objId)

        if (pos && Math.abs(pos.x - finalX) < 20 && Math.abs(pos.y - finalY) < 20) {
          converged = true
          break
        }
        await pageB.waitForTimeout(100)
      }

      const convergenceTime = Date.now() - start
      console.log(`Position convergence time: ${convergenceTime}ms`)

      savePerfResult({
        test: 'rapid-update-convergence',
        timestamp: new Date().toISOString(),
        metrics: { convergenceTime, converged },
        passed: converged && convergenceTime < 2000,
      })

      expect(converged).toBe(true)
      expect(convergenceTime).toBeLessThan(2000)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})
