import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { handleRealtimePayload } from './useRealtimeSync'
import { useAuthStore } from '../store/authStore'
import { usePresenceStore } from '../store/presenceStore'
import { useBoardStore } from '../store/boardStore'
import { useConnectionStore } from '../store/connectionStore'
import { fetchObjects } from '../lib/boardSync'
import { getCursorColor } from '../lib/cursorColors'
import type { CursorPosition, PresenceUser } from '../types/board'

function trackPresence(ch: RealtimeChannel) {
  const user = useAuthStore.getState().user
  if (!user) return
  const name = user.user_metadata?.full_name || user.email || 'Anonymous'
  ch.track({
    user_id: user.id,
    user_name: name,
    color: getCursorColor(user.id),
    online_at: new Date().toISOString(),
  })
}

async function refetchBoard(boardId: string) {
  const objects = await fetchObjects(boardId)
  useBoardStore.getState().setObjects(objects)
}

export function useBoardChannel(boardId: string) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const wasSubscribed = useRef(false)

  useEffect(() => {
    const { setStatus } = useConnectionStore.getState()
    setStatus('connecting')
    wasSubscribed.current = false

    const ch = supabase
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
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const cursor = payload as CursorPosition
        const myId = useAuthStore.getState().user?.id
        if (cursor.user_id === myId) return
        usePresenceStore
          .getState()
          .setCursor(cursor.user_id, { ...cursor, _lastSeen: Date.now() })
      })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{
          user_id: string
          user_name: string
          color: string
          online_at: string
        }>()
        const users: PresenceUser[] = Object.values(state).flatMap(
          (presences) =>
            presences.map((p) => ({
              user_id: p.user_id,
              user_name: p.user_name,
              color: p.color,
              online_at: p.online_at,
            })),
        )
        usePresenceStore.getState().setOnlineUsers(users)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        for (const p of leftPresences) {
          const data = p as unknown as { user_id: string }
          usePresenceStore.getState().removeCursor(data.user_id)
        }
      })
      .subscribe((status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          if (wasSubscribed.current) {
            setStatus('reconnecting')
            refetchBoard(boardId).then(() => setStatus('connected'))
            trackPresence(ch)
          } else {
            setStatus('connected')
          }
          wasSubscribed.current = true
        } else if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
        ) {
          setStatus('error')
        } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
          setStatus('reconnecting')
        }
      })

    setChannel(ch)
    trackPresence(ch)

    return () => {
      setChannel(null)
      supabase.removeChannel(ch)
    }
  }, [boardId])

  return channel
}
