import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useBoardStore } from './store/boardStore'
import { useBoardChannel } from './hooks/useBoardChannel'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import { usePresenceCursors } from './hooks/usePresenceCursors'
import { LoginPage } from './components/auth/LoginPage'
import { BoardCanvas } from './components/canvas/BoardCanvas'
import { Toolbar } from './components/ui/Toolbar'
import { PresencePanel } from './components/ui/PresencePanel'
import './App.css'

function BoardView() {
  const { user, signOut } = useAuthStore()
  const boardId = useBoardStore((s) => s.boardId)

  const channelRef = useBoardChannel(boardId)
  useRealtimeSync(boardId)
  const { broadcastCursor } = usePresenceCursors(channelRef)

  return (
    <div className="flex flex-col w-screen h-screen">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-semibold">CollabBoard</h1>
        <div className="flex items-center gap-3">
          <PresencePanel />
          <span className="text-sm text-gray-500">{user!.email}</span>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm cursor-pointer rounded hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
      <Toolbar />
      <BoardCanvas broadcastCursor={broadcastCursor} />
    </div>
  )
}

function App() {
  const { user, loading, initialize } = useAuthStore()

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  if (loading) return renderLoading()
  if (!user) return <LoginPage />
  return <BoardView />

  function renderLoading() {
    return (
      <div className="flex items-center justify-center w-screen h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }
}

export default App
