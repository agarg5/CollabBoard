import { test, expect } from '@playwright/test'
import {
  createSupabaseClient,
  createAnonClient,
  createTestUser,
  deleteTestUser,
  savePerfResult,
  type TestSession,
} from './perf-helpers'

/**
 * AI Agent performance test.
 * Skipped unless RUN_AI_TESTS=true (requires live OpenAI key + Supabase Edge Function).
 */
const RUN_AI = process.env.RUN_AI_TESTS === 'true'
const AI_RESPONSE_TARGET_MS = 2000

test.describe('AI Agent performance', () => {
  test.skip(!RUN_AI, 'Skipped: set RUN_AI_TESTS=true to run')

  const sb = createSupabaseClient()
  const anonSb = createAnonClient()
  const supabaseUrl = process.env.VITE_SUPABASE_URL!
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!
  let session: TestSession

  test.beforeEach(async () => {
    session = await createTestUser(sb, anonSb)
  })

  test.afterEach(async () => {
    if (session?.userId) await deleteTestUser(sb, session.userId).catch(() => {})
  })

  test(`AI agent responds within ${AI_RESPONSE_TARGET_MS}ms`, async () => {
    const prompt = 'Create a yellow sticky note that says Hello'
    const boardState: unknown[] = []

    const start = Date.now()
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ prompt, boardState }),
    })
    const elapsed = Date.now() - start

    console.log(`AI agent response time: ${elapsed}ms`)
    console.log(`AI agent status: ${res.status}`)
    expect(res.status).not.toBe(401)
    expect(res.ok).toBe(true)
    const data = (await res.json()) as { message: string; toolCalls: unknown[] }
    expect(data.message).toBeTruthy()
    expect(data.toolCalls.length).toBeGreaterThan(0)

    savePerfResult({
      test: 'ai-agent-response-latency',
      timestamp: new Date().toISOString(),
      metrics: { elapsedMs: elapsed, status: res.status },
      passed: elapsed < AI_RESPONSE_TARGET_MS,
    })

    expect(elapsed).toBeLessThan(AI_RESPONSE_TARGET_MS)
  })
})
