import { useEffect, useCallback, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuthStore } from '../store/authStore'
import { usePresenceStore } from '../store/presenceStore'
import { getCursorColor } from '../lib/cursorColors'
import type { CursorPosition } from '../types/board'

const THROTTLE_MS = 16
const CURSOR_STALE_MS = 10_000

/**
 * Provides broadcastCursor() for sending local cursor position.
 * All channel listeners (broadcast receive, presence sync/leave) are
 * registered in useBoardChannel before subscribe — this hook only
 * handles sending and staleness cleanup.
 */
export function usePresenceCursors(channel: RealtimeChannel | null) {
  const lastSentRef = useRef(0)

  // Cursor staleness cleanup: remove cursors not updated in CURSOR_STALE_MS
  useEffect(() => {
    const interval = setInterval(() => {
      const { cursors, removeCursor } = usePresenceStore.getState()
      const now = Date.now()
      for (const [userId, cursor] of Object.entries(cursors)) {
        if (cursor._lastSeen && now - cursor._lastSeen > CURSOR_STALE_MS) {
          removeCursor(userId)
        }
      }
    }, CURSOR_STALE_MS)

    return () => clearInterval(interval)
  }, [])

  const broadcastCursor = useCallback(
    (worldX: number, worldY: number) => {
      const now = Date.now()
      if (now - lastSentRef.current < THROTTLE_MS) return
      lastSentRef.current = now

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
    [channel],
  )

  return { broadcastCursor }
}
