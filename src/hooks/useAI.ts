import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBoardStore } from '../store/boardStore'
import { useUiStore } from '../store/uiStore'
import { executeToolCalls } from '../lib/aiExecutor'
import type { AIResponse } from '../types/board'

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`
const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000000'

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

    let accessToken: string | null = null
    let userId: string = DEV_USER_ID

    if (!DEV_BYPASS_AUTH) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        setLoading(false)
        return null
      }
      accessToken = session.access_token
      userId = session.user.id
    }

    const boardState = useBoardStore.getState().objects
    const chatMessages = useUiStore.getState().chatMessages
    // Exclude the last message — it's the current user prompt which the edge
    // function appends separately. Without this slice the user turn is doubled.
    const messageHistory = chatMessages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (DEV_BYPASS_AUTH) {
      headers['Authorization'] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      headers['X-Dev-Bypass'] = 'true'
    } else {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    try {
      const res = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, boardState, messageHistory }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }))
        const msg = (body as { error?: string }).error ?? 'AI request failed'
        setError(msg)
        return null
      }

      const data = (await res.json()) as AIResponse

      const errors = await executeToolCalls(
        data.toolCalls,
        data.simulatedResults ?? [],
        { boardId, userId },
      )

      if (errors.length > 0) {
        setError(`Some actions failed: ${errors.join('; ')}`)
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
