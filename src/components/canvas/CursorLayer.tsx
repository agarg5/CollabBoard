import { useRef, useEffect, useCallback, useState } from 'react'
import { Layer, Line, Rect, Text, Group } from 'react-konva'
import { usePresenceStore } from '../../store/presenceStore'
import { useAuthStore } from '../../store/authStore'
import type { CursorPosition } from '../../types/board'

const CURSOR_POINTS = [0, 0, 4, 14, 7.5, 10.5, 14, 12, 0, 0]
const LABEL_OFFSET_X = 12
const LABEL_OFFSET_Y = 16
const LABEL_PAD = 4
const FONT_SIZE = 12
const LERP_SPEED = 0.25 // fraction to move per frame (0–1, higher = snappier)

interface InterpolatedCursor extends CursorPosition {
  displayX: number
  displayY: number
}

function startLoop(
  rafRef: React.MutableRefObject<number>,
  interpolatedRef: React.MutableRefObject<Record<string, InterpolatedCursor>>,
  forceRender: React.Dispatch<React.SetStateAction<number>>,
) {
  if (rafRef.current) return // already running

  const animate = () => {
    const interp = interpolatedRef.current
    let needsUpdate = false

    for (const cursor of Object.values(interp)) {
      const dx = cursor.x - cursor.displayX
      const dy = cursor.y - cursor.displayY

      // Skip lerp if already close enough (< 0.5px)
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        if (cursor.displayX !== cursor.x || cursor.displayY !== cursor.y) {
          cursor.displayX = cursor.x
          cursor.displayY = cursor.y
          needsUpdate = true
        }
        continue
      }

      cursor.displayX += dx * LERP_SPEED
      cursor.displayY += dy * LERP_SPEED
      needsUpdate = true
    }

    if (needsUpdate) {
      forceRender((n) => n + 1)
      rafRef.current = requestAnimationFrame(animate)
    } else {
      rafRef.current = 0 // stop loop until new data arrives
    }
  }

  rafRef.current = requestAnimationFrame(animate)
}

export function CursorLayer() {
  const cursors = usePresenceStore((s) => s.cursors)
  const myId = useAuthStore((s) => s.user?.id)
  const interpolatedRef = useRef<Record<string, InterpolatedCursor>>({})
  const rafRef = useRef<number>(0)
  const [, forceRender] = useState(0)

  // Sync target positions from store into interpolated state (in useEffect, not render)
  useEffect(() => {
    const interp = interpolatedRef.current

    for (const [userId, cursor] of Object.entries(cursors)) {
      if (userId === myId) continue
      const existing = interp[userId]
      if (existing) {
        existing.x = cursor.x
        existing.y = cursor.y
        existing.user_name = cursor.user_name
        existing.color = cursor.color
      } else {
        interp[userId] = {
          ...cursor,
          displayX: cursor.x,
          displayY: cursor.y,
        }
      }
    }

    // Remove cursors that left
    for (const userId of Object.keys(interp)) {
      if (!cursors[userId]) delete interp[userId]
    }

    // Kick off the animation loop (no-op if already running)
    startLoop(rafRef, interpolatedRef, forceRender)
  }, [cursors, myId])

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [])

  const entries = Object.values(interpolatedRef.current)

  return (
    <Layer listening={false}>
      {entries.map((cursor) => (
        <Group key={cursor.user_id} x={cursor.displayX} y={cursor.displayY}>
          <Line
            points={CURSOR_POINTS}
            fill={cursor.color}
            stroke="#fff"
            strokeWidth={1}
            closed
          />
          <Rect
            x={LABEL_OFFSET_X}
            y={LABEL_OFFSET_Y}
            width={cursor.user_name.length * 7 + LABEL_PAD * 2}
            height={FONT_SIZE + LABEL_PAD * 2}
            fill={cursor.color}
            cornerRadius={3}
          />
          <Text
            x={LABEL_OFFSET_X + LABEL_PAD}
            y={LABEL_OFFSET_Y + LABEL_PAD}
            text={cursor.user_name}
            fontSize={FONT_SIZE}
            fill="#fff"
            fontFamily="sans-serif"
          />
        </Group>
      ))}
    </Layer>
  )
}
