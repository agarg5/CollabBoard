import { useState, useRef, useEffect, useCallback } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useAI } from '../../hooks/useAI'

const COOLDOWN_SECONDS = 5

export function AIChatPanel() {
  const setChatPanelOpen = useUiStore((s) => s.setChatPanelOpen)
  const messages = useUiStore((s) => s.chatMessages)
  const addChatMessage = useUiStore((s) => s.addChatMessage)
  const { sendPrompt, loading, error } = useAI()
  const [input, setInput] = useState('')
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [input, autoResize])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || loading || cooldown > 0) return

    setInput('')
    setDismissedError(null)
    addChatMessage({ role: 'user', content: trimmed })

    const response = await sendPrompt(trimmed)
    if (response) {
      addChatMessage({ role: 'assistant', content: response })
    }
    setCooldown(COOLDOWN_SECONDS)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const showError = error && error !== dismissedError

  return (
    <div className="flex flex-col w-80 shrink-0 h-full border-l border-gray-200 bg-white">
      {renderHeader()}
      {showError && renderError()}
      {renderMessages()}
      {renderInput()}
    </div>
  )

  function renderHeader() {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">AI Assistant</h2>
        <button
          onClick={() => setChatPanelOpen(false)}
          className="p-1 rounded cursor-pointer hover:bg-gray-100 transition-colors"
          aria-label="Close AI panel"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    )
  }

  function renderError() {
    return (
      <div className="flex items-center justify-between px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">
        <span>{error}</span>
        <button
          onClick={() => setDismissedError(error)}
          className="ml-2 p-0.5 rounded cursor-pointer hover:bg-red-100 transition-colors"
          aria-label="Dismiss error"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    )
  }

  function renderMessages() {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Ask the AI to create objects, organize your board, or build templates.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
              <span className="inline-flex gap-1 text-lg leading-none">
                <span className="typing-dot-1">.</span>
                <span className="typing-dot-2">.</span>
                <span className="typing-dot-3">.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    )
  }

  function renderInput() {
    return (
      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={cooldown > 0 ? `Wait ${cooldown}s...` : 'Ask the AI...'}
            disabled={loading || cooldown > 0}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || cooldown > 0 || !input.trim()}
            className="px-3 py-2 rounded-lg bg-blue-500 text-white text-sm cursor-pointer hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            ) : cooldown > 0 ? (
              <span className="text-xs font-mono w-4 text-center">{cooldown}</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L8 2l5 11H3z" fill="currentColor" transform="rotate(0 8 8)" />
              </svg>
            )}
          </button>
        </div>
      </div>
    )
  }
}
