import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { useBoardListStore } from './boardListStore'
import type { Board } from '../types/board'

const userId = 'user-123'

const makeBoard = (overrides: Partial<Board> = {}): Board => ({
  id: crypto.randomUUID(),
  name: 'Test Board',
  created_by: userId,
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

function chainMock(terminal: Record<string, unknown>) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockResolvedValue(terminal)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(terminal)
  chain.delete = vi.fn().mockReturnValue(chain)
  return chain
}

describe('boardListStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBoardListStore.setState({ boards: [], loading: false })
  })

  it('fetchBoards loads all boards', async () => {
    const boards = [makeBoard({ name: 'Board A' }), makeBoard({ name: 'Board B' })]
    const chain = chainMock({ data: boards, error: null })
    mockFrom.mockReturnValue(chain)

    await useBoardListStore.getState().fetchBoards(userId)

    expect(mockFrom).toHaveBeenCalledWith('boards')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(useBoardListStore.getState().boards).toEqual(boards)
    expect(useBoardListStore.getState().loading).toBe(false)
  })

  it('fetchBoards sets loading state', async () => {
    const chain = chainMock({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const promise = useBoardListStore.getState().fetchBoards(userId)
    expect(useBoardListStore.getState().loading).toBe(true)
    await promise
    expect(useBoardListStore.getState().loading).toBe(false)
  })

  it('createBoard adds board to list', async () => {
    const newBoard = makeBoard({ name: 'New Board' })
    const chain = chainMock({ data: newBoard, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await useBoardListStore.getState().createBoard('New Board', userId)

    expect(mockFrom).toHaveBeenCalledWith('boards')
    expect(chain.insert).toHaveBeenCalledWith({ name: 'New Board', created_by: userId })
    expect(result).toEqual(newBoard)
    expect(useBoardListStore.getState().boards).toHaveLength(1)
    expect(useBoardListStore.getState().boards[0]).toEqual(newBoard)
  })

  it('createBoard returns null on error', async () => {
    const chain = chainMock({ data: null, error: { message: 'fail' } })
    mockFrom.mockReturnValue(chain)

    const result = await useBoardListStore.getState().createBoard('Fail', userId)
    expect(result).toBeNull()
    expect(useBoardListStore.getState().boards).toHaveLength(0)
  })

  it('deleteBoard removes board from list', async () => {
    const board = makeBoard({ id: 'board-1' })
    useBoardListStore.setState({ boards: [board] })

    const chain = chainMock({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await useBoardListStore.getState().deleteBoard('board-1')

    expect(result).toBe(true)
    expect(useBoardListStore.getState().boards).toHaveLength(0)
  })

  it('deleteBoard returns false on error', async () => {
    const board = makeBoard({ id: 'board-1' })
    useBoardListStore.setState({ boards: [board] })

    const chain = chainMock({ error: { message: 'fail' } })
    // Make the eq call return the error directly for delete chain
    chain.eq = vi.fn().mockResolvedValue({ error: { message: 'fail' } })
    mockFrom.mockReturnValue(chain)

    const result = await useBoardListStore.getState().deleteBoard('board-1')

    expect(result).toBe(false)
    expect(useBoardListStore.getState().boards).toHaveLength(1)
  })
})
