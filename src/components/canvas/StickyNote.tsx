import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'

interface StickyNoteProps {
  obj: BoardObject
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number }) => void
  onDoubleClick: (id: string) => void
}

const PADDING = 12
const FONT_SIZE = 14

export function StickyNote({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}: StickyNoteProps) {
  const color = (obj.properties.color as string) || '#fef08a'
  const text = (obj.properties.text as string) || ''

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
      width: Math.max(100, node.width() * scaleX),
      height: Math.max(60, node.height() * scaleY),
    })
  }

  return (
    <Group
      id={obj.id}
      x={obj.x}
      y={obj.y}
      draggable
      onClick={() => onSelect(obj.id)}
      onTap={() => onSelect(obj.id)}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      onDblClick={() => onDoubleClick(obj.id)}
      onDblTap={() => onDoubleClick(obj.id)}
    >
      <Rect
        width={obj.width}
        height={obj.height}
        fill={color}
        cornerRadius={8}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={8}
        shadowOffsetY={2}
        stroke={isSelected ? '#3b82f6' : undefined}
        strokeWidth={isSelected ? 2 : 0}
      />
      <Text
        width={obj.width}
        height={obj.height}
        text={text}
        fontSize={FONT_SIZE}
        padding={PADDING}
        align="left"
        verticalAlign="top"
        wrap="word"
        listening={false}
      />
    </Group>
  )
}

export { PADDING, FONT_SIZE }
