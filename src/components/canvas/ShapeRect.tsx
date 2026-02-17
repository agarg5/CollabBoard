import { Group, Rect } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'

interface ShapeRectProps {
  obj: BoardObject
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number }) => void
}

export const MIN_WIDTH = 50
export const MIN_HEIGHT = 50

export function ShapeRect({
  obj,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: ShapeRectProps) {
  const fillColor = (obj.properties.fillColor as string) || '#3b82f6'
  const strokeColor = (obj.properties.strokeColor as string) || '#1e293b'
  const strokeWidth = (obj.properties.strokeWidth as number) || 2

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
      draggable
      onClick={() => onSelect(obj.id)}
      onTap={() => onSelect(obj.id)}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={obj.width}
        height={obj.height}
        fill={fillColor}
        stroke={isSelected ? '#3b82f6' : strokeColor}
        strokeWidth={isSelected ? 2 : strokeWidth}
      />
    </Group>
  )
}
