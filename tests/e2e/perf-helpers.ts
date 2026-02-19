import { type Page, type Browser, type BrowserContext } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Supabase REST client (for seeding/cleanup outside the browser)
// ---------------------------------------------------------------------------

export function createSupabaseClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) env vars are required',
    )
  }
  return createClient(url, key)
}

export function createAnonClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars are required')
  }
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Test user management
// ---------------------------------------------------------------------------

export interface TestSession {
  userId: string
  email: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export async function createTestUser(
  adminSb: SupabaseClient,
  anonSb: SupabaseClient,
): Promise<TestSession> {
  const email = `test-${crypto.randomUUID().slice(0, 8)}@collabboard.test`
  const password = 'test-pass-123'

  // Retry with backoff to handle Supabase auth rate limits
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt))

    const { data: user, error: createErr } = await adminSb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) {
      if (attempt < 2 && createErr.message?.includes('rate limit')) continue
      throw createErr
    }

    const { data: signIn, error: signInErr } = await anonSb.auth.signInWithPassword({
      email,
      password,
    })
    if (signInErr) {
      if (attempt < 2 && signInErr.message?.includes('rate limit')) continue
      throw signInErr
    }

    return {
      userId: user.user.id,
      email,
      accessToken: signIn.session!.access_token,
      refreshToken: signIn.session!.refresh_token,
      expiresAt: signIn.session!.expires_at!,
    }
  }
  throw new Error('createTestUser: exhausted retries')
}

export async function deleteTestUser(
  adminSb: SupabaseClient,
  userId: string,
): Promise<void> {
  await adminSb.auth.admin.deleteUser(userId)
}

// ---------------------------------------------------------------------------
// Board & object seeding
// ---------------------------------------------------------------------------

export async function createBoard(
  sb: SupabaseClient,
  name: string,
): Promise<string> {
  const { data, error } = await sb
    .from('boards')
    .insert({ name, created_by: null })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function seedObjects(
  sb: SupabaseClient,
  boardId: string,
  count: number,
  type: string = 'sticky_note',
): Promise<string[]> {
  const objects = Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    board_id: boardId,
    type,
    properties:
      type === 'sticky_note'
        ? { text: `Note ${i}`, color: '#fef08a' }
        : { fillColor: '#3b82f6', strokeColor: '#1e293b' },
    x: 100 + (i % 25) * 220,
    y: 100 + Math.floor(i / 25) * 220,
    width: 200,
    height: 200,
    z_index: i + 1,
    created_by: null,
    updated_at: new Date().toISOString(),
  }))

  // Supabase REST has a row limit per insert; batch in chunks of 100
  const ids: string[] = []
  for (let start = 0; start < objects.length; start += 100) {
    const batch = objects.slice(start, start + 100)
    const { error } = await sb.from('board_objects').insert(batch)
    if (error) throw error
    ids.push(...batch.map((o) => o.id))
  }
  return ids
}

export async function cleanupBoard(
  sb: SupabaseClient,
  boardId: string,
): Promise<void> {
  await sb.from('board_objects').delete().eq('board_id', boardId)
  await sb.from('boards').delete().eq('id', boardId)
}

// ---------------------------------------------------------------------------
// Two-user helpers
// ---------------------------------------------------------------------------

export const USER_A_ID = '00000000-0000-0000-0000-00000000000a'
export const USER_B_ID = '00000000-0000-0000-0000-00000000000b'
export const USER_C_ID = '00000000-0000-0000-0000-00000000000c'
export const USER_D_ID = '00000000-0000-0000-0000-00000000000d'
export const USER_E_ID = '00000000-0000-0000-0000-00000000000e'
export const ALL_USER_IDS = [USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID, USER_E_ID]

/**
 * Opens the app, sets a distinct dev user ID via localStorage, and
 * navigates to the given board by setting boardId in the Zustand store.
 *
 * @param options.waitForRealtime - If true (default), wait for Realtime
 *   connection to be established. Set to false for tests that only need
 *   objects loaded via REST fetch (e.g. FPS tests).
 * @param options.session - If provided, inject a real Supabase session so
 *   the Supabase client gets a real JWT for Realtime subscriptions.
 */
const DEFAULT_BASE_URL = process.env.BASE_URL ?? `http://localhost:${process.env.PLAYWRIGHT_PORT ?? '5199'}`

export async function openBoardAsUser(
  browser: Browser,
  boardId: string,
  userId: string,
  baseURL = DEFAULT_BASE_URL,
  options: { waitForRealtime?: boolean; session?: TestSession } = {},
): Promise<{ page: Page; context: BrowserContext }> {
  const { waitForRealtime = !!options.session, session } = options
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()

  // Set distinct dev user ID before the app initializes
  await page.addInitScript((uid: string) => {
    localStorage.setItem('DEV_USER_ID', uid)
  }, userId)

  await page.goto('/')
  // Wait for board list to confirm auth bypass worked
  await page.getByText('My Boards').waitFor({ timeout: 10000 })

  // If a real session is provided, inject it into the Supabase client
  // via setSession() so Realtime gets a valid JWT
  if (session) {
    // Wait for __supabase to be exposed on the window (set by supabase.ts when DEV_BYPASS_AUTH)
    await page.waitForFunction(
      () => (window as Record<string, unknown>).__supabase != null,
      { timeout: 10000 },
    )
    await page.evaluate(
      async (s: { accessToken: string; refreshToken: string }) => {
        const sb = (window as Record<string, unknown>).__supabase as {
          auth: {
            setSession: (params: {
              access_token: string
              refresh_token: string
            }) => Promise<unknown>
          }
        }
        await sb.auth.setSession({
          access_token: s.accessToken,
          refresh_token: s.refreshToken,
        })
      },
      { accessToken: session.accessToken, refreshToken: session.refreshToken },
    )
  }

  // Navigate to board by setting boardId in Zustand store
  await page.evaluate((bid: string) => {
    // Access the Zustand store via its internal API
    const store = (window as Record<string, unknown>).__boardStore as
      | { getState: () => { setBoardId: (id: string) => void } }
      | undefined
    if (store) {
      store.getState().setBoardId(bid)
    }
  }, boardId)

  // Wait for canvas toolbar to confirm board loaded
  await page.getByRole('button', { name: /Select/ }).waitFor({ timeout: 15000 })

  if (waitForRealtime) {
    // Wait for Realtime subscription to be fully established
    await page.waitForFunction(
      () => {
        const store = (window as any).__connectionStore
        const status = store?.getState().status
        return status === 'connected'
      },
      { timeout: 15000 },
    )
  } else {
    // Just wait for connection attempt to settle (connected, error, or reconnecting)
    await page.waitForFunction(
      () => {
        const store = (window as any).__connectionStore
        const status = store?.getState().status
        return status && status !== 'connecting'
      },
      { timeout: 15000 },
    )
  }

  return { page, context }
}

export async function openTwoUsers(
  browser: Browser,
  boardId: string,
  baseURL = DEFAULT_BASE_URL,
  options: {
    waitForRealtime?: boolean
    sessionA?: TestSession
    sessionB?: TestSession
  } = {},
): Promise<{
  pageA: Page
  pageB: Page
  contextA: BrowserContext
  contextB: BrowserContext
}> {
  const userAId = options.sessionA?.userId ?? USER_A_ID
  const userBId = options.sessionB?.userId ?? USER_B_ID
  const [a, b] = await Promise.all([
    openBoardAsUser(browser, boardId, userAId, baseURL, {
      waitForRealtime: options.waitForRealtime,
      session: options.sessionA,
    }),
    openBoardAsUser(browser, boardId, userBId, baseURL, {
      waitForRealtime: options.waitForRealtime,
      session: options.sessionB,
    }),
  ])
  return {
    pageA: a.page,
    pageB: b.page,
    contextA: a.context,
    contextB: b.context,
  }
}

// ---------------------------------------------------------------------------
// FPS measurement
// ---------------------------------------------------------------------------

export async function startFpsMeasurement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    w.__fpsFrames = [] as number[]
    w.__fpsRunning = true
    const loop = (ts: number) => {
      if (!(w.__fpsRunning as boolean)) return
      ;(w.__fpsFrames as number[]).push(ts)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
}

export interface FpsResult {
  avg: number
  min: number
  p95: number
  frameCount: number
}

export async function stopFpsMeasurement(page: Page): Promise<FpsResult> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    w.__fpsRunning = false
    const frames = w.__fpsFrames as number[]
    if (frames.length < 2)
      return { avg: 0, min: 0, p95: 0, frameCount: frames.length }

    const deltas: number[] = []
    for (let i = 1; i < frames.length; i++) {
      deltas.push(frames[i] - frames[i - 1])
    }
    deltas.sort((a, b) => a - b)

    const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length
    const maxDelta = deltas[deltas.length - 1]
    const p95Delta = deltas[Math.floor(deltas.length * 0.95)]

    return {
      avg: Math.round(1000 / avgDelta),
      min: Math.round(1000 / maxDelta),
      p95: Math.round(1000 / p95Delta),
      frameCount: frames.length,
    }
  })
}

// ---------------------------------------------------------------------------
// Store access helpers (used from page.evaluate)
// ---------------------------------------------------------------------------

/**
 * Gets the object count from the board store inside the page.
 */
export async function getObjectCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as Record<string, unknown>).__boardStore as
      | { getState: () => { objects: unknown[] } }
      | undefined
    return store?.getState().objects.length ?? 0
  })
}

/**
 * Waits until the board store has at least `count` objects.
 * Returns the time waited in ms, or -1 on timeout.
 */
export async function waitForObjectCount(
  page: Page,
  count: number,
  timeoutMs = 5000,
): Promise<number> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const current = await getObjectCount(page)
    if (current >= count) return Date.now() - start
    await page.waitForTimeout(50)
  }
  return -1
}

// ---------------------------------------------------------------------------
// N-user helper
// ---------------------------------------------------------------------------

export async function openNUsers(
  browser: Browser,
  boardId: string,
  n: number,
  baseURL = DEFAULT_BASE_URL,
  options: { sessions?: TestSession[] } = {},
): Promise<{ pages: Page[]; contexts: BrowserContext[] }> {
  const results = await Promise.all(
    ALL_USER_IDS.slice(0, n).map((uid, i) =>
      openBoardAsUser(browser, boardId, uid, baseURL, {
        session: options.sessions?.[i],
      }),
    ),
  )
  return {
    pages: results.map((r) => r.page),
    contexts: results.map((r) => r.context),
  }
}

// ---------------------------------------------------------------------------
// Results persistence
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = resolve(__dirname, '../../test-results')
const RESULTS_FILE = resolve(RESULTS_DIR, 'perf-results.json')

export interface PerfResult {
  test: string
  timestamp: string
  metrics: Record<string, number | string | boolean>
  passed: boolean
  runId?: string
}

export function savePerfResult(result: PerfResult): void {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true })

  let results: PerfResult[] = []
  if (existsSync(RESULTS_FILE)) {
    results = JSON.parse(readFileSync(RESULTS_FILE, 'utf-8'))
  }
  results.push({
    ...result,
    runId: process.env.PERF_RUN_ID ?? result.runId,
  })
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
}
