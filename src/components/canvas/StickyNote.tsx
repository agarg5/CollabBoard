import { useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'
import { useCachedNode } from '../../hooks/useCachedNode'

interface StickyNoteProps {
  obj: BoardObject
  isSelected: boolean
  isEditing: boolean
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragMove?: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number; rotation?: number }) => void
  onDoubleClick: (id: string) => void
}

const PADDING = 12
const FONT_SIZE = 14
const FONT_FAMILY = 'Arial'
const LINE_HEIGHT = 1.2
const MIN_WIDTH = 100
const MIN_HEIGHT = 60

export function StickyNote({
  obj,
  isSelected,
  isEditing,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}: StickyNoteProps) {
  const color = (obj.properties.color as string) || '#fef08a'
  const text = (obj.properties.text as string) || ''
  const [isDragging, setIsDragging] = useState(false)

  const shouldCache = !isSelected && !isEditing && !isDragging
  const cacheKey = `${obj.width}-${obj.height}-${obj.rotation ?? 0}-${color}-${text}`
  const groupRef = useCachedNode(shouldCache, cacheKey, 12)

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
      rotation: node.rotation(),
    })
  }

  return (
    <Group
      ref={groupRef}
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation ?? 0}
      draggable
      onClick={(e) => onSelect(obj.id, e)}
      onTap={() => onSelect(obj.id)}
      onDragStart={(e) => { setIsDragging(true); onDragStart(e) }}
      onDragMove={onDragMove}
      onDragEnd={(e) => { setIsDragging(false); handleDragEnd(e) }}
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
      {!isEditing && (
        <Text
          width={obj.width}
          height={obj.height}
          text={text}
          fontSize={FONT_SIZE}
          fontFamily={FONT_FAMILY}
          lineHeight={LINE_HEIGHT}
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

export { PADDING, FONT_SIZE, FONT_FAMILY, LINE_HEIGHT, MIN_WIDTH, MIN_HEIGHT }
