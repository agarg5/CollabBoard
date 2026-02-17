import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchObjects } from '../lib/boardSync'
import { useBoardStore } from '../store/boardStore'
import type { BoardObject } from '../types/board'

export function handleRealtimePayload(payload: {
  eventType: string
  new: Record<string, unknown>
  old: Record<string, unknown>
}) {
  const store = useBoardStore.getState()

  if (payload.eventType === 'INSERT') {
    const newObj = payload.new as BoardObject
    const exists = store.objects.some((o) => o.id === newObj.id)
    if (!exists) store.addObject(newObj)
    return
  }

  if (payload.eventType === 'UPDATE') {
    const updated = payload.new as BoardObject
    const local = store.objects.find((o) => o.id === updated.id)
    if (!local) {
      store.addObject(updated)
      return
    }
    if (local.updated_at >= updated.updated_at) return
    store.updateObject(updated.id, updated)
    return
  }

  if (payload.eventType === 'DELETE') {
    const deleted = payload.old as BoardObject
    const exists = store.objects.some((o) => o.id === deleted.id)
    if (exists) store.removeObject(deleted.id)
  }
}

export function useRealtimeSync(boardId: string) {
  useEffect(() => {
    let cancelled = false

    fetchObjects(boardId).then((objects) => {
      if (!cancelled) useBoardStore.getState().setObjects(objects)
    })

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_objects',
          filter: `board_id=eq.${boardId}`,
        },
        handleRealtimePayload,
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [boardId])
}
