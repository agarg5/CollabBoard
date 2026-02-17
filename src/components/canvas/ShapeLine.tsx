import { Group, Line } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'

interface ShapeLineProps {
  obj: BoardObject
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragMove?: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number }) => void
}

export const MIN_WIDTH = 20
export const MIN_HEIGHT = 20

export function ShapeLine({
  obj,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformEnd,
}: ShapeLineProps) {
  const strokeColor = (obj.properties.strokeColor as string) || '#3b82f6'
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
      <Line
        points={[0, 0, obj.width, obj.height]}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        hitStrokeWidth={Math.max(10, strokeWidth)}
      />
    </Group>
  )
}
