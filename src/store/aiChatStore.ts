import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useBoardStore } from './boardStore'
import { executeToolCalls } from '../lib/aiToolExecutor'
import type { ToolCall } from '../lib/aiToolExecutor'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
}

interface AiChatState {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  sendMessage: (prompt: string) => Promise<void>
  clearMessages: () => void
}

export const useAiChatStore = create<AiChatState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,
  panelOpen: false,

  setPanelOpen: (panelOpen) => set({ panelOpen }),

  sendMessage: async (prompt: string) => {
    const { messages } = get()
    const { boardId, objects } = useBoardStore.getState()
    if (!boardId) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }
    set({ messages: [...messages, userMsg], loading: true, error: null })

    // Compact board state to minimize tokens
    const boardState = objects.map((o) => ({
      id: o.id,
      type: o.type,
      x: Math.round(o.x),
      y: Math.round(o.y),
      width: Math.round(o.width),
      height: Math.round(o.height),
      text: (o.properties.text as string) ?? undefined,
      color:
        (o.properties.color as string) ??
        (o.properties.fillColor as string) ??
        undefined,
    }))

    // Send last 10 messages as context
    const messageHistory = [...messages, userMsg]
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    const { data, error } = await supabase.functions.invoke('ai-agent', {
      body: { boardId, prompt, boardState, messageHistory },
    })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    // Execute tool calls on the client
    const toolCalls: ToolCall[] = data.toolCalls ?? []
    if (toolCalls.length > 0) {
      await executeToolCalls(toolCalls, boardId)
    }

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: data.message || summarizeToolCalls(toolCalls),
      toolCalls,
      timestamp: Date.now(),
    }

    set((state) => ({
      messages: [...state.messages, assistantMsg],
      loading: false,
    }))
  },

  clearMessages: () => set({ messages: [], error: null }),
}))

function summarizeToolCalls(toolCalls: ToolCall[]): string {
  if (!toolCalls.length) return 'Done!'
  const actions = toolCalls.map((tc) => {
    const name = tc.function.name
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()
    return name
  })
  const unique = [...new Set(actions)]
  return `Executed ${toolCalls.length} action(s): ${unique.join(', ')}.`
}
