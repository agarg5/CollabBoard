import { useRef, useEffect, useState, useCallback } from 'react'
import { useAiStore } from '../../store/aiStore'
import { useBoardStore } from '../../store/boardStore'
import { getValidUserId } from '../../store/authStore'
import { sendAiMessage } from '../../lib/aiApi'
import { executeToolCalls } from '../../lib/aiTools'
import type { ChatMessage, AiToolCall } from '../../types/board'

interface AiChatPanelProps {
  boardId: string
}

export function AiChatPanel({ boardId }: AiChatPanelProps) {
  const panelOpen = useAiStore((s) => s.panelOpen)
  const togglePanel = useAiStore((s) => s.togglePanel)

  return (
    <>
      {renderToggleButton()}
      {panelOpen && <ChatPanel boardId={boardId} onClose={togglePanel} />}
    </>
  )

  function renderToggleButton() {
    if (panelOpen) return null
    return (
      <button
        onClick={togglePanel}
        className="absolute bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        aria-label="Open AI assistant"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
          <path d="M12 3v2m0 14v2M5.636 5.636l1.414 1.414m9.9 9.9l1.414 1.414M3 12h2m14 0h2M5.636 18.364l1.414-1.414m9.9-9.9l1.414-1.414" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </button>
    )
  }
}

function ChatPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const messages = useAiStore((s) => s.messages)
  const loading = useAiStore((s) => s.loading)
  const addMessage = useAiStore((s) => s.addMessage)
  const updateMessage = useAiStore((s) => s.updateMessage)
  const clearMessages = useAiStore((s) => s.clearMessages)
  const setLoading = useAiStore((s) => s.setLoading)

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'done',
    }
    addMessage(userMsg)

    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      status: 'sending',
    }
    addMessage(assistantMsg)
    setLoading(true)

    try {
      const boardState = useBoardStore.getState().objects
      const allMessages = useAiStore.getState().messages
      const response = await sendAiMessage(text, boardState, allMessages)

      updateMessage(assistantId, {
        content: response.message ?? '',
        toolCalls: response.toolCalls?.length ? response.toolCalls : undefined,
        status: 'done',
      })

      if (response.toolCalls?.length) {
        const userId = getValidUserId() ?? 'anonymous'
        await executeToolCalls(response.toolCalls, boardId, userId)
      }
    } catch (err) {
      updateMessage(assistantId, {
        content: 'Something went wrong. Please try again.',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }, [input, loading, boardId, addMessage, updateMessage, setLoading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="absolute right-0 top-0 z-50 flex h-full w-[380px] flex-col border-l border-gray-200 bg-white shadow-xl">
      {renderHeader()}
      {renderMessages()}
      {renderInput()}
    </div>
  )

  function renderHeader() {
    return (
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
        <div className="flex gap-2">
          <button
            onClick={clearMessages}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Clear chat history"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Close AI panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  function renderMessages() {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">
            Ask the AI to create objects, organize your board, or build templates.
          </p>
        )}
        {messages.map((msg) => renderMessage(msg))}
        <div ref={messagesEndRef} />
      </div>
    )
  }

  function renderMessage(msg: ChatMessage) {
    const isUser = msg.role === 'user'
    return (
      <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            isUser
              ? 'bg-indigo-600 text-white'
              : msg.status === 'error'
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-100 text-gray-900'
          }`}
        >
          {msg.status === 'sending' ? renderLoading() : <p className="whitespace-pre-wrap">{msg.content}</p>}
          {msg.toolCalls?.length ? renderToolCallSummary(msg.toolCalls) : null}
        </div>
      </div>
    )
  }

  function renderToolCallSummary(toolCalls: AiToolCall[]) {
    const counts: Record<string, number> = {}
    for (const tc of toolCalls) {
      const name = tc.function.name
      counts[name] = (counts[name] ?? 0) + 1
    }

    const labels: Record<string, string> = {
      createStickyNote: 'sticky note',
      createShape: 'shape',
      createFrame: 'frame',
      createConnector: 'connector',
      moveObject: 'move',
      resizeObject: 'resize',
      updateText: 'text update',
      changeColor: 'color change',
      deleteObject: 'deletion',
    }

    const parts = Object.entries(counts).map(([name, count]) => {
      const label = labels[name] ?? name
      return count > 1 ? `${count} ${label}s` : `1 ${label}`
    })

    return (
      <p className="mt-1 text-xs text-gray-500 border-t border-gray-200 pt-1">
        Applied: {parts.join(', ')}
      </p>
    )
  }

  function renderInput() {
    return (
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI..."
            disabled={loading}
            rows={1}
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  function renderLoading() {
    return (
      <div className="flex items-center gap-1 py-1">
        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
      </div>
    )
  }
}
