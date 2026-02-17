import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBoardStore } from '../store/boardStore'
import { executeToolCall } from '../lib/aiExecutor'
import type { AIResponse } from '../types/board'

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`

export function useAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendPrompt(prompt: string): Promise<string | null> {
    setLoading(true)
    setError(null)

    const boardId = useBoardStore.getState().boardId
    if (!boardId) {
      setError('No board selected')
      setLoading(false)
      return null
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      setError('Not authenticated')
      setLoading(false)
      return null
    }

    const boardState = useBoardStore.getState().objects

    try {
      const res = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt, boardState }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        const msg = (body as { error?: string }).error ?? 'AI request failed'
        setError(msg)
        return null
      }

      const data = (await res.json()) as AIResponse

      for (const toolCall of data.toolCalls) {
        await executeToolCall(toolCall, {
          boardId,
          userId: session.user.id,
        })
      }

      return data.message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { sendPrompt, loading, error }
}
