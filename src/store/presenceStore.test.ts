import { describe, it, expect, beforeEach } from 'vitest'
import { usePresenceStore } from './presenceStore'
import type { CursorPosition, PresenceUser } from '../types/board'

const cursor: CursorPosition = {
  user_id: 'u1',
  user_name: 'Alice',
  x: 100,
  y: 200,
  color: '#ef4444',
}

const user: PresenceUser = {
  user_id: 'u1',
  user_name: 'Alice',
  color: '#ef4444',
  online_at: '2026-01-01T00:00:00Z',
}

describe('presenceStore', () => {
  beforeEach(() => {
    usePresenceStore.setState({ cursors: {}, onlineUsers: [] })
  })

  it('setCursor adds a cursor keyed by user_id', () => {
    usePresenceStore.getState().setCursor('u1', cursor)
    expect(usePresenceStore.getState().cursors['u1']).toEqual(cursor)
  })

  it('removeCursor removes a cursor by user_id', () => {
    usePresenceStore.getState().setCursor('u1', cursor)
    usePresenceStore.getState().removeCursor('u1')
    expect(usePresenceStore.getState().cursors['u1']).toBeUndefined()
  })

  it('setOnlineUsers replaces the online users list', () => {
    usePresenceStore.getState().setOnlineUsers([user])
    expect(usePresenceStore.getState().onlineUsers).toEqual([user])
  })

  it('setCursor updates existing cursor position', () => {
    usePresenceStore.getState().setCursor('u1', cursor)
    usePresenceStore.getState().setCursor('u1', { ...cursor, x: 300 })
    expect(usePresenceStore.getState().cursors['u1'].x).toBe(300)
  })

  it('setCursor preserves _lastSeen when provided', () => {
    const ts = Date.now()
    usePresenceStore.getState().setCursor('u1', { ...cursor, _lastSeen: ts })
    expect(usePresenceStore.getState().cursors['u1']._lastSeen).toBe(ts)
  })
})
