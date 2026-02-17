import { Group, Rect } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'

interface ShapeRectProps {
  obj: BoardObject
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragMove?: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number }) => void
}

export const MIN_WIDTH = 50
export const MIN_HEIGHT = 50

export function ShapeRect({
  obj,
  onSelect,
  onDragStart,
  onDragMove,
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
      width={obj.width}
      height={obj.height}
      draggable
      onClick={(e) => onSelect(obj.id, e)}
      onTap={() => onSelect(obj.id)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={obj.width}
        height={obj.height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </Group>
  )
}
