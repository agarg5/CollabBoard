import { Group, Arrow } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types/board'

interface ConnectorProps {
  obj: BoardObject
  onSelect: (id: string, e?: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragMove?: (e: import('konva').default.KonvaEventObject<DragEvent>) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, attrs: { x: number; y: number; width: number; height: number; rotation?: number }) => void
}

export const MIN_WIDTH = 10
export const MIN_HEIGHT = 10

export function Connector({
  obj,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformEnd,
}: ConnectorProps) {
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
      rotation: node.rotation(),
    })
  }

  return (
    <Group
      id={obj.id}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation ?? 0}
      draggable
      onClick={(e) => onSelect(obj.id, e)}
      onTap={() => onSelect(obj.id)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Arrow
        points={[0, 0, obj.width, obj.height]}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={strokeColor}
        pointerLength={10}
        pointerWidth={8}
        hitStrokeWidth={Math.max(12, strokeWidth)}
      />
    </Group>
  )
}
