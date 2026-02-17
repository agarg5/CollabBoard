import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'
import { FONT_FAMILY } from './StickyNote'

interface TextObjectProps {
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

export const FONT_SIZE = 16
export const LINE_HEIGHT = 1.4
export const MIN_WIDTH = 50
export const MIN_HEIGHT = 32
export const PADDING = 4

export function TextObject({
  obj,
  isSelected,
  isEditing,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}: TextObjectProps) {
  const text = (obj.properties.text as string) || ''
  const fontSize = (obj.properties.fontSize as number) || FONT_SIZE
  const color = (obj.properties.color as string) || '#1e293b'

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
        fill="transparent"
        stroke={isSelected ? '#3b82f6' : undefined}
        strokeWidth={isSelected ? 1 : 0}
        dash={isSelected ? [4, 4] : undefined}
      />
      {!isEditing && (
        <Text
          width={obj.width}
          height={obj.height}
          text={text || 'Type something...'}
          fontSize={fontSize}
          fontFamily={FONT_FAMILY}
          lineHeight={LINE_HEIGHT}
          fill={text ? color : '#9ca3af'}
          padding={PADDING}
          align="left"
          verticalAlign="top"
          wrap="word"
          listening={false}
        />
      )}
    </Group>
  )
}
