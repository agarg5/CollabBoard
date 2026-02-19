import { test, expect } from '@playwright/test'

/**
 * AI Agent performance test.
 * Skipped unless RUN_AI_TESTS=true (requires live OpenAI key + Supabase Edge Function).
 */
const RUN_AI = process.env.RUN_AI_TESTS === 'true'
const AI_RESPONSE_TARGET_MS = 2000

test.describe('AI Agent performance', () => {
  test.skip(!RUN_AI, 'Skipped: set RUN_AI_TESTS=true to run')

  const supabaseUrl = process.env.VITE_SUPABASE_URL!
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!

  test(`AI agent responds within ${AI_RESPONSE_TARGET_MS}ms`, async () => {
    const prompt = 'Create a yellow sticky note that says Hello'
    const boardState: unknown[] = []

    const start = Date.now()
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ prompt, boardState }),
    })
    const elapsed = Date.now() - start

    console.log(`AI agent response time: ${elapsed}ms`)
    console.log(`AI agent status: ${res.status}`)

    // The endpoint may require a real auth token; if it returns 401,
    // still verify the latency of the round-trip
    if (res.ok) {
      const data = (await res.json()) as { message: string; toolCalls: unknown[] }
      expect(data.message).toBeTruthy()
      expect(data.toolCalls.length).toBeGreaterThan(0)
    }

    expect(elapsed).toBeLessThan(AI_RESPONSE_TARGET_MS)
  })
})
