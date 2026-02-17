import { Group, Ellipse } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'

interface ShapeCircleProps {
  obj: BoardObject
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number }) => void
}

export const MIN_WIDTH = 50
export const MIN_HEIGHT = 50

export function ShapeCircle({
  obj,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: ShapeCircleProps) {
  const fillColor = (obj.properties.fillColor as string) || '#ec4899'
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
      onClick={() => onSelect(obj.id)}
      onTap={() => onSelect(obj.id)}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Ellipse
        x={obj.width / 2}
        y={obj.height / 2}
        radiusX={obj.width / 2}
        radiusY={obj.height / 2}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </Group>
  )
}
