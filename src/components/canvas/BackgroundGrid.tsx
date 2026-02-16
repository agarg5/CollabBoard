import { Circle, Layer } from 'react-konva'

const GRID_SPACING = 40
const DOT_RADIUS = 1.5
const DOT_COLOR = '#d1d5db'

interface BackgroundGridProps {
  stageWidth: number
  stageHeight: number
  stageX: number
  stageY: number
  scale: number
}

export function BackgroundGrid({
  stageWidth,
  stageHeight,
  stageX,
  stageY,
  scale,
}: BackgroundGridProps) {
  const dots = computeGridDots(stageWidth, stageHeight, stageX, stageY, scale)

  return (
    <Layer listening={false}>
      {dots.map((dot) => (
        <Circle
          key={`${dot.x},${dot.y}`}
          x={dot.x}
          y={dot.y}
          radius={DOT_RADIUS / scale}
          fill={DOT_COLOR}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
    </Layer>
  )
}

function computeGridDots(
  stageWidth: number,
  stageHeight: number,
  stageX: number,
  stageY: number,
  scale: number,
) {
  const buffer = GRID_SPACING
  // Visible area in world coordinates
  const startWorldX = -stageX / scale - buffer
  const startWorldY = -stageY / scale - buffer
  const endWorldX = (stageWidth - stageX) / scale + buffer
  const endWorldY = (stageHeight - stageY) / scale + buffer

  // Snap to grid
  const firstX = Math.floor(startWorldX / GRID_SPACING) * GRID_SPACING
  const firstY = Math.floor(startWorldY / GRID_SPACING) * GRID_SPACING

  const dots: { x: number; y: number }[] = []
  for (let x = firstX; x <= endWorldX; x += GRID_SPACING) {
    for (let y = firstY; y <= endWorldY; y += GRID_SPACING) {
      dots.push({ x, y })
    }
  }
  return dots
}
