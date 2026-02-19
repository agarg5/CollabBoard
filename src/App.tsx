import { useEffect, useState } from 'react'
import { useAuthStore } from './store/authStore'
import { useBoardStore } from './store/boardStore'
import { useBoardListStore } from './store/boardListStore'
import { useBoardChannel } from './hooks/useBoardChannel'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import { usePresenceCursors } from './hooks/usePresenceCursors'
import { LoginPage } from './components/auth/LoginPage'
import { ResetPasswordPage } from './components/auth/ResetPasswordPage'
import { BoardCanvas } from './components/canvas/BoardCanvas'
import { BoardListPage } from './components/ui/BoardListPage'
import { Toolbar } from './components/ui/Toolbar'
import { PresencePanel } from './components/ui/PresencePanel'
import { ConnectionStatus } from './components/ui/ConnectionStatus'
import { AIChatPanel } from './components/ui/AIChatPanel'
import { AccountSettings } from './components/ui/AccountSettings'
import { useUiStore } from './store/uiStore'
import './App.css'

function BoardView({ boardId }: { boardId: string }) {
  const { user, signOut } = useAuthStore()
  const setBoardId = useBoardStore((s) => s.setBoardId)
  const boardName = useBoardListStore((s) => s.boards.find((b) => b.id === boardId)?.name)
  const chatPanelOpen = useUiStore((s) => s.chatPanelOpen)
  const showAccountSettings = useUiStore((s) => s.showAccountSettings)
  const setShowAccountSettings = useUiStore((s) => s.setShowAccountSettings)

  const channel = useBoardChannel(boardId)
  useRealtimeSync(boardId)
  const { broadcastCursor } = usePresenceCursors(channel)

  return (
    <div className="flex flex-col w-screen h-screen">
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBoardId(null)}
            aria-label="Back to boards"
            className="px-3 py-1.5 text-sm cursor-pointer rounded hover:bg-gray-100 transition-colors"
          >
            &larr; Boards
          </button>
          {boardName && (
            <>
              <span className="text-gray-300 select-none">/</span>
              <h1 className="text-lg font-medium text-gray-700 truncate max-w-xs">{boardName}</h1>
            </>
          )}
          <ConnectionStatus />
        </div>
        <div className="flex items-center gap-3">
          <PresencePanel />
          <button
            onClick={() => setShowAccountSettings(true)}
            aria-label="Account settings"
            className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 hover:underline transition-colors"
          >
            {user!.email}
          </button>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="px-4 py-2 text-sm cursor-pointer rounded hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <Toolbar />
      <main className="flex flex-1 min-h-0">
        <BoardCanvas broadcastCursor={broadcastCursor} />
        {chatPanelOpen && <AIChatPanel />}
      </main>
      {showAccountSettings && <AccountSettings />}
    </div>
  )
}

function AuthenticatedApp() {
  const boardId = useBoardStore((s) => s.boardId)
  const setShowAccountSettings = useUiStore((s) => s.setShowAccountSettings)

  useEffect(() => {
    setShowAccountSettings(false)
  }, [boardId, setShowAccountSettings])

  if (!boardId) return <BoardListPage />
  return <BoardView boardId={boardId} />
}

function App() {
  const { user, loading, initialize } = useAuthStore()
  const [recoveryMode, setRecoveryMode] = useState(() => {
    // Detect recovery token in URL hash on fresh page load
    const hash = window.location.hash
    return hash.includes('type=recovery')
  })

  useEffect(() => {
    const unsubscribe = initialize((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setRecoveryMode(false)
      }
    })
    return unsubscribe
  }, [initialize])

  if (loading) return renderLoading()
  if (recoveryMode && user) return <ResetPasswordPage onComplete={() => setRecoveryMode(false)} />
  if (!user) return <LoginPage />
  return <AuthenticatedApp />

  function renderLoading() {
    return (
      <main className="flex items-center justify-center w-screen h-screen" role="status" aria-label="Loading application">
        <p className="text-gray-500">Loading...</p>
      </main>
    )
  }
}

export default App
