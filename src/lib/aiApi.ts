import { supabase } from './supabase'
import type { BoardObject, AiToolCall, ChatMessage } from '../types/board'

interface AiResponse {
  message: string
  toolCalls: AiToolCall[]
}

export async function sendAiMessage(
  prompt: string,
  boardState: BoardObject[],
  messageHistory: ChatMessage[],
): Promise<AiResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) throw new Error('Not authenticated')

  const history = messageHistory.slice(-20).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        prompt,
        boardState,
        messageHistory: history,
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI request failed (${res.status}): ${text}`)
  }

  return res.json()
}
