import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useAI } from '../../hooks/useAI'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function AIChatPanel() {
  const setChatPanelOpen = useUiStore((s) => s.setChatPanelOpen)
  const { sendPrompt, loading, error } = useAI()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])

    const response = await sendPrompt(trimmed)
    if (response) {
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col w-80 h-full border-l border-gray-200 bg-white">
      {renderHeader()}
      {error && renderError()}
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
      <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">
        {error}
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
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
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
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI..."
            disabled={loading}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg bg-blue-500 text-white text-sm cursor-pointer hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8l5-5v3h5a2 2 0 012 2v0a2 2 0 01-2 2H7v3L2 8z" fill="currentColor" transform="rotate(-90 8 8)" />
              </svg>
            )}
          </button>
        </div>
      </div>
    )
  }
}
