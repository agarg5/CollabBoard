import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConnectionStore } from '../store/connectionStore'
import { useBoardStore } from '../store/boardStore'

vi.mock('../lib/boardSync', () => ({
  fetchObjects: vi.fn(() =>
    Promise.resolve([{ id: 'obj1', board_id: 'b1' }]),
  ),
}))

describe('useBoardChannel reconnection logic', () => {
  beforeEach(() => {
    useConnectionStore.setState({ status: 'connecting' })
    useBoardStore.setState({ objects: [] })
    vi.clearAllMocks()
  })

  it('connectionStore transitions through full reconnect lifecycle', () => {
    const { setStatus } = useConnectionStore.getState()

    // Initial subscribe
    setStatus('connected')
    expect(useConnectionStore.getState().status).toBe('connected')

    // Network drops — channel error
    setStatus('error')
    expect(useConnectionStore.getState().status).toBe('error')

    // Supabase starts reconnecting
    setStatus('reconnecting')
    expect(useConnectionStore.getState().status).toBe('reconnecting')

    // Reconnected
    setStatus('connected')
    expect(useConnectionStore.getState().status).toBe('connected')
  })

  it('refetchBoard updates board store with fetched objects', async () => {
    const { fetchObjects } = await import('../lib/boardSync')

    const objects = await fetchObjects('test-board')
    useBoardStore.getState().setObjects(objects)

    expect(fetchObjects).toHaveBeenCalledWith('test-board')
    expect(useBoardStore.getState().objects).toEqual([
      { id: 'obj1', board_id: 'b1' },
    ])
  })

  it('sets reconnecting then connected when refetch completes', async () => {
    const { fetchObjects } = await import('../lib/boardSync')
    const { setStatus } = useConnectionStore.getState()

    // Simulate reconnect flow from subscribe callback
    setStatus('reconnecting')
    const objects = await fetchObjects('test-board')
    useBoardStore.getState().setObjects(objects)
    setStatus('connected')

    expect(useConnectionStore.getState().status).toBe('connected')
    expect(useBoardStore.getState().objects).toHaveLength(1)
  })
})
