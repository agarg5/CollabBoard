import { useEffect, useCallback, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuthStore } from '../store/authStore'
import { usePresenceStore } from '../store/presenceStore'
import { getCursorColor } from '../lib/cursorColors'
import type { CursorPosition, PresenceUser } from '../types/board'

const THROTTLE_MS = 50

export function usePresenceCursors(
  channelRef: React.RefObject<RealtimeChannel | null>,
) {
  const lastSentRef = useRef(0)

  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return

    const myId = useAuthStore.getState().user?.id

    // --- Broadcast: receive remote cursors ---
    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      const cursor = payload as CursorPosition
      const currentMyId = useAuthStore.getState().user?.id
      if (cursor.user_id === currentMyId) return
      usePresenceStore.getState().setCursor(cursor.user_id, cursor)
    })

    // --- Presence: track who's online ---
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{
        user_id: string
        user_name: string
        color: string
        online_at: string
      }>()
      const users: PresenceUser[] = Object.values(state).flatMap((presences) =>
        presences.map((p) => ({
          user_id: p.user_id,
          user_name: p.user_name,
          color: p.color,
          online_at: p.online_at,
        })),
      )
      usePresenceStore.getState().setOnlineUsers(users)
    })

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences) {
        const data = p as unknown as { user_id: string }
        usePresenceStore.getState().removeCursor(data.user_id)
      }
    })

    // Track own presence
    const user = useAuthStore.getState().user
    if (user) {
      const name =
        user.user_metadata?.full_name || user.email || 'Anonymous'
      channel.track({
        user_id: user.id,
        user_name: name,
        color: getCursorColor(user.id),
        online_at: new Date().toISOString(),
      })
    }

    return () => {
      if (myId) usePresenceStore.getState().removeCursor(myId)
    }
  }, [channelRef])

  const broadcastCursor = useCallback(
    (worldX: number, worldY: number) => {
      const now = Date.now()
      if (now - lastSentRef.current < THROTTLE_MS) return
      lastSentRef.current = now

      const channel = channelRef.current
      if (!channel) return

      const user = useAuthStore.getState().user
      if (!user) return

      const name =
        user.user_metadata?.full_name || user.email || 'Anonymous'

      const cursor: CursorPosition = {
        user_id: user.id,
        user_name: name,
        x: worldX,
        y: worldY,
        color: getCursorColor(user.id),
      }

      channel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: cursor,
      })
    },
    [channelRef],
  )

  return { broadcastCursor }
}
