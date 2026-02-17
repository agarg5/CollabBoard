import { Shape, Layer } from 'react-konva'
import type { Context } from 'konva/lib/Context'
import type { Shape as ShapeType } from 'konva/lib/Shape'

const BASE_GRID_SPACING = 40
const DOT_RADIUS = 1.5
const DOT_COLOR = '#d1d5db'
const MIN_SCALE_FOR_DOTS = 0.15

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
  if (scale < MIN_SCALE_FOR_DOTS) return <Layer listening={false} />

  // Double spacing when zoomed out far to keep dot count reasonable
  const spacing = scale < 0.4 ? BASE_GRID_SPACING * 2 : BASE_GRID_SPACING

  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(ctx: Context, shape: ShapeType) => {
          const buffer = spacing
          const startWorldX = -stageX / scale - buffer
          const startWorldY = -stageY / scale - buffer
          const endWorldX = (stageWidth - stageX) / scale + buffer
          const endWorldY = (stageHeight - stageY) / scale + buffer

          const firstX = Math.floor(startWorldX / spacing) * spacing
          const firstY = Math.floor(startWorldY / spacing) * spacing

          const radius = DOT_RADIUS / scale
          const _ctx = ctx._context
          _ctx.fillStyle = DOT_COLOR

          for (let x = firstX; x <= endWorldX; x += spacing) {
            for (let y = firstY; y <= endWorldY; y += spacing) {
              _ctx.beginPath()
              _ctx.arc(x, y, radius, 0, Math.PI * 2)
              _ctx.fill()
            }
          }

          ctx.fillStrokeShape(shape)
        }}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Layer>
  )
}
