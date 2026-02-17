import { useEffect } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchObjects } from '../lib/boardSync'
import { useBoardStore } from '../store/boardStore'
import type { BoardObject } from '../types/board'

export function handleRealtimePayload(
  payload: RealtimePostgresChangesPayload<BoardObject>,
) {
  const store = useBoardStore.getState()

  if (payload.eventType === 'INSERT') {
    const exists = store.objects.some((o) => o.id === payload.new.id)
    if (!exists) store.addObject(payload.new)
    return
  }

  if (payload.eventType === 'UPDATE') {
    const local = store.objects.find((o) => o.id === payload.new.id)
    if (!local) {
      store.addObject(payload.new)
      return
    }
    if (local.updated_at >= payload.new.updated_at) return
    store.updateObject(payload.new.id, payload.new)
    return
  }

  if (payload.eventType === 'DELETE') {
    const id = payload.old.id
    if (!id) return
    const exists = store.objects.some((o) => o.id === id)
    if (exists) store.removeObject(id)
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
