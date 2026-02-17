import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInvoke = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}))

const mockExecute = vi.fn().mockResolvedValue(undefined)
vi.mock('../lib/aiToolExecutor', () => ({
  executeToolCalls: (...args: unknown[]) => mockExecute(...args),
}))

import { useAiChatStore } from './aiChatStore'
import { useBoardStore } from './boardStore'

describe('aiChatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAiChatStore.setState({ messages: [], loading: false, error: null, panelOpen: false })
    useBoardStore.setState({ boardId: 'board-1', objects: [], selectedIds: [] })
  })

  it('starts with empty state', () => {
    const state = useAiChatStore.getState()
    expect(state.messages).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.panelOpen).toBe(false)
  })

  it('setPanelOpen toggles panel', () => {
    useAiChatStore.getState().setPanelOpen(true)
    expect(useAiChatStore.getState().panelOpen).toBe(true)
    useAiChatStore.getState().setPanelOpen(false)
    expect(useAiChatStore.getState().panelOpen).toBe(false)
  })

  it('sendMessage adds user message and sets loading', async () => {
    mockInvoke.mockResolvedValue({
      data: { message: 'Done!', toolCalls: [] },
      error: null,
    })

    const promise = useAiChatStore.getState().sendMessage('create a sticky note')

    // Should be loading with user message added
    expect(useAiChatStore.getState().loading).toBe(true)
    expect(useAiChatStore.getState().messages).toHaveLength(1)
    expect(useAiChatStore.getState().messages[0].role).toBe('user')
    expect(useAiChatStore.getState().messages[0].content).toBe('create a sticky note')

    await promise

    expect(useAiChatStore.getState().loading).toBe(false)
    expect(useAiChatStore.getState().messages).toHaveLength(2)
    expect(useAiChatStore.getState().messages[1].role).toBe('assistant')
    expect(useAiChatStore.getState().messages[1].content).toBe('Done!')
  })

  it('sendMessage executes tool calls', async () => {
    const toolCalls = [
      {
        id: 'call-1',
        function: { name: 'createStickyNote', arguments: '{"text":"Hi","x":0,"y":0}' },
      },
    ]
    mockInvoke.mockResolvedValue({
      data: { message: null, toolCalls },
      error: null,
    })

    await useAiChatStore.getState().sendMessage('create a note')

    expect(mockExecute).toHaveBeenCalledWith(toolCalls, 'board-1')
  })

  it('sendMessage sets error on failure', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    })

    await useAiChatStore.getState().sendMessage('test')

    expect(useAiChatStore.getState().loading).toBe(false)
    expect(useAiChatStore.getState().error).toBe('Network error')
    // User message still in history, no assistant message
    expect(useAiChatStore.getState().messages).toHaveLength(1)
  })

  it('sendMessage does nothing if no boardId', async () => {
    useBoardStore.setState({ boardId: null })

    await useAiChatStore.getState().sendMessage('test')

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(useAiChatStore.getState().messages).toHaveLength(0)
  })

  it('clearMessages resets messages and error', () => {
    useAiChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'test', timestamp: Date.now() },
      ],
      error: 'some error',
    })

    useAiChatStore.getState().clearMessages()

    expect(useAiChatStore.getState().messages).toHaveLength(0)
    expect(useAiChatStore.getState().error).toBeNull()
  })

  it('sends compact board state with message', async () => {
    useBoardStore.setState({
      boardId: 'board-1',
      objects: [
        {
          id: 'obj-1',
          board_id: 'board-1',
          type: 'sticky_note' as const,
          properties: { text: 'Hello', color: '#fef08a' },
          x: 100.7,
          y: 200.3,
          width: 200,
          height: 200,
          z_index: 1,
          created_by: null,
          updated_at: '',
        },
      ],
    })

    mockInvoke.mockResolvedValue({
      data: { message: 'ok', toolCalls: [] },
      error: null,
    })

    await useAiChatStore.getState().sendMessage('test')

    const invokeArgs = mockInvoke.mock.calls[0]
    expect(invokeArgs[0]).toBe('ai-agent')
    const body = invokeArgs[1].body
    expect(body.boardState[0].x).toBe(101) // rounded
    expect(body.boardState[0].y).toBe(200) // rounded
    expect(body.boardState[0].text).toBe('Hello')
    expect(body.boardState[0].color).toBe('#fef08a')
    // Should not include z_index, updated_at, etc.
    expect(body.boardState[0].z_index).toBeUndefined()
  })
})
