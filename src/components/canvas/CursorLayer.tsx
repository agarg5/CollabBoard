import { Layer, Line, Rect, Text, Group } from 'react-konva'
import { usePresenceStore } from '../../store/presenceStore'
import { useAuthStore } from '../../store/authStore'

const CURSOR_POINTS = [0, 0, 4, 14, 7.5, 10.5, 14, 12, 0, 0]
const LABEL_OFFSET_X = 12
const LABEL_OFFSET_Y = 16
const LABEL_PAD = 4
const FONT_SIZE = 12

export function CursorLayer() {
  const cursors = usePresenceStore((s) => s.cursors)
  const myId = useAuthStore((s) => s.user?.id)

  return (
    <Layer listening={false}>
      {Object.values(cursors).map((cursor) => {
        if (cursor.user_id === myId) return null
        return (
          <Group key={cursor.user_id} x={cursor.x} y={cursor.y}>
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
        )
      })}
    </Layer>
  )
}
