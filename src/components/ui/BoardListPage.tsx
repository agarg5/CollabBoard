import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useBoardStore } from '../../store/boardStore'
import { useBoardListStore } from '../../store/boardListStore'
import type { Board } from '../../types/board'

export function BoardListPage() {
  const { user, signOut } = useAuthStore()
  const setBoardId = useBoardStore((s) => s.setBoardId)
  const { boards, loading, fetchBoards, createBoard, deleteBoard } = useBoardListStore()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (user) fetchBoards(user.id)
  }, [user, fetchBoards])

  async function handleCreate() {
    if (!user || !newBoardName.trim()) return
    setCreating(true)
    const board = await createBoard(newBoardName.trim(), user.id)
    setCreating(false)
    if (board) {
      setNewBoardName('')
      setShowCreateDialog(false)
    }
  }

  async function handleDelete(board: Board) {
    const confirmed = window.confirm(`Delete "${board.name}"? This cannot be undone.`)
    if (!confirmed) return
    setDeletingId(board.id)
    await deleteBoard(board.id)
    setDeletingId(null)
  }

  if (loading) return renderLoading()
  return renderBoardList()

  function renderLoading() {
    return (
      <div className="flex items-center justify-center w-screen h-screen">
        <p className="text-gray-500">Loading boards...</p>
      </div>
    )
  }

  function renderBoardList() {
    return (
      <div className="flex flex-col w-screen h-screen bg-gray-50">
        {renderHeader()}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">My Boards</h2>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
              >
                + New Board
              </button>
            </div>
            {showCreateDialog && renderCreateDialog()}
            {boards.length === 0 ? renderEmptyState() : renderGrid()}
          </div>
        </main>
      </div>
    )
  }

  function renderHeader() {
    return (
      <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-semibold">CollabBoard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user!.email}</span>
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm cursor-pointer rounded hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
    )
  }

  function renderCreateDialog() {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Create new board</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setShowCreateDialog(false)
            }}
            placeholder="Board name"
            autoFocus
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newBoardName.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={() => {
              setShowCreateDialog(false)
              setNewBoardName('')
            }}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  function renderEmptyState() {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg mb-2">No boards yet</p>
        <p className="text-gray-400 text-sm">
          Click "New Board" to create your first whiteboard.
        </p>
      </div>
    )
  }

  function renderGrid() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => renderBoardCard(board))}
      </div>
    )
  }

  function renderBoardCard(board: Board) {
    const isDeleting = deletingId === board.id
    const createdDate = new Date(board.created_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    return (
      <div
        key={board.id}
        onClick={() => !isDeleting && setBoardId(board.id)}
        className={`group relative p-5 bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-gray-300 ${
          isDeleting ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <h3 className="text-base font-medium text-gray-900 mb-1 pr-8 truncate">
          {board.name}
        </h3>
        <p className="text-xs text-gray-400">Created {createdDate}</p>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete(board)
          }}
          title="Delete board"
          className="absolute top-3 right-3 p-1.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M5 2V1h6v1h4v2H1V2h4zM2 5h12l-1 10H3L2 5zm4 2v6m4-6v6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    )
  }
}
