import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'
import { FONT_FAMILY } from './StickyNote'

interface FrameProps {
  obj: BoardObject
  isSelected: boolean
  isEditing: boolean
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number }) => void
  onDoubleClick: (id: string) => void
}

const LABEL_FONT_SIZE = 14
const LABEL_PADDING = 8
export const MIN_WIDTH = 200
export const MIN_HEIGHT = 150

export function Frame({
  obj,
  isSelected,
  isEditing,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}: FrameProps) {
  const strokeColor = (obj.properties.strokeColor as string) || '#94a3b8'
  const label = (obj.properties.label as string) || ''

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(obj.id, e.target.x(), e.target.y())
  }

  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    onTransformEnd(obj.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(MIN_WIDTH, node.width() * scaleX),
      height: Math.max(MIN_HEIGHT, node.height() * scaleY),
    })
  }

  return (
    <Group
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      draggable
      onClick={(e) => onSelect(obj.id, e)}
      onTap={() => onSelect(obj.id)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      onDblClick={() => onDoubleClick(obj.id)}
      onDblTap={() => onDoubleClick(obj.id)}
    >
      <Rect
        width={obj.width}
        height={obj.height}
        fill="rgba(59,130,246,0.03)"
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1.5}
        dash={[8, 4]}
      />
      {!isEditing && (
        <Text
          x={LABEL_PADDING}
          y={LABEL_PADDING}
          width={obj.width - LABEL_PADDING * 2}
          text={label || 'Frame'}
          fontSize={LABEL_FONT_SIZE}
          fontFamily={FONT_FAMILY}
          fill={strokeColor}
          listening={false}
        />
      )}
    </Group>
  )
}

export { LABEL_FONT_SIZE, LABEL_PADDING }
