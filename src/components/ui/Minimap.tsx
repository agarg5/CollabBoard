import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'

interface MinimapProps {
  viewportWidth: number
  viewportHeight: number
}

const MINIMAP_W = 200
const MINIMAP_H = 140
const PADDING_RATIO = 0.1
const MIN_VIEWPORT_SIZE = 4
const DEFAULT_HALF = 500

function getObjectColor(obj: { type: string; properties: Record<string, unknown> }): string {
  const p = obj.properties
  switch (obj.type) {
    case 'sticky_note':
      return (p.color as string) || '#fde68a'
    case 'rectangle':
    case 'circle':
      return (p.fillColor as string) || '#93c5fd'
    case 'frame':
      return 'rgba(156,163,175,0.4)'
    case 'text':
      return (p.color as string) || '#374151'
    case 'line':
      return (p.strokeColor as string) || '#374151'
    default:
      return '#9ca3af'
  }
}

export function Minimap({ viewportWidth, viewportHeight }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const isDraggingRef = useRef(false)

  const objects = useBoardStore((s) => s.objects)
  const stagePosition = useUiStore((s) => s.stagePosition)
  const stageScale = useUiStore((s) => s.stageScale)
  const setStagePosition = useUiStore((s) => s.setStagePosition)

  // Compute world bounds encompassing all objects + viewport
  const computeWorldBounds = useCallback(() => {
    // Current viewport in world coordinates
    const vpLeft = -stagePosition.x / stageScale
    const vpTop = -stagePosition.y / stageScale
    const vpRight = vpLeft + viewportWidth / stageScale
    const vpBottom = vpTop + viewportHeight / stageScale

    const renderable = objects.filter((o) => o.type !== 'connector')

    if (renderable.length === 0) {
      // Default bounds when no objects
      const minX = Math.min(-DEFAULT_HALF, vpLeft)
      const minY = Math.min(-DEFAULT_HALF, vpTop)
      const maxX = Math.max(DEFAULT_HALF, vpRight)
      const maxY = Math.max(DEFAULT_HALF, vpBottom)
      return { minX, minY, maxX, maxY, vpLeft, vpTop, vpRight, vpBottom }
    }

    let minX = vpLeft
    let minY = vpTop
    let maxX = vpRight
    let maxY = vpBottom

    for (const obj of renderable) {
      minX = Math.min(minX, obj.x)
      minY = Math.min(minY, obj.y)
      maxX = Math.max(maxX, obj.x + obj.width)
      maxY = Math.max(maxY, obj.y + obj.height)
    }

    // Add padding
    const padX = (maxX - minX) * PADDING_RATIO
    const padY = (maxY - minY) * PADDING_RATIO
    minX -= padX
    minY -= padY
    maxX += padX
    maxY += padY

    return { minX, minY, maxX, maxY, vpLeft, vpTop, vpRight, vpBottom }
  }, [objects, stagePosition, stageScale, viewportWidth, viewportHeight])

  // Render minimap
  useEffect(() => {
    if (collapsed) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = MINIMAP_W * dpr
    canvas.height = MINIMAP_H * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H)

    const bounds = computeWorldBounds()
    const worldW = bounds.maxX - bounds.minX
    const worldH = bounds.maxY - bounds.minY

    // Scale to fit minimap, maintaining aspect ratio
    const scaleX = MINIMAP_W / worldW
    const scaleY = MINIMAP_H / worldH
    const s = Math.min(scaleX, scaleY)

    // Center offset
    const offsetX = (MINIMAP_W - worldW * s) / 2
    const offsetY = (MINIMAP_H - worldH * s) / 2

    const toMiniX = (wx: number) => (wx - bounds.minX) * s + offsetX
    const toMiniY = (wy: number) => (wy - bounds.minY) * s + offsetY

    // Draw objects (skip connectors)
    const renderable = objects.filter((o) => o.type !== 'connector')
    for (const obj of renderable) {
      const mx = toMiniX(obj.x)
      const my = toMiniY(obj.y)
      const mw = Math.max(2, obj.width * s)
      const mh = Math.max(2, obj.height * s)

      ctx.fillStyle = getObjectColor(obj)
      if (obj.type === 'circle') {
        ctx.beginPath()
        ctx.ellipse(mx + mw / 2, my + mh / 2, mw / 2, mh / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(mx, my, mw, mh)
      }
    }

    // Draw viewport rectangle
    const vx = toMiniX(bounds.vpLeft)
    const vy = toMiniY(bounds.vpTop)
    const vw = Math.max(MIN_VIEWPORT_SIZE, (bounds.vpRight - bounds.vpLeft) * s)
    const vh = Math.max(MIN_VIEWPORT_SIZE, (bounds.vpBottom - bounds.vpTop) * s)

    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(vx, vy, vw, vh)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(vx, vy, vw, vh)
  }, [collapsed, objects, stagePosition, stageScale, viewportWidth, viewportHeight, computeWorldBounds])

  // Convert minimap pixel to world coordinate and pan
  const panToMinimapPoint = useCallback(
    (canvasX: number, canvasY: number) => {
      const bounds = computeWorldBounds()
      const worldW = bounds.maxX - bounds.minX
      const worldH = bounds.maxY - bounds.minY
      const scaleX = MINIMAP_W / worldW
      const scaleY = MINIMAP_H / worldH
      const s = Math.min(scaleX, scaleY)
      const offsetX = (MINIMAP_W - worldW * s) / 2
      const offsetY = (MINIMAP_H - worldH * s) / 2

      // Convert minimap coord to world coord
      const worldX = (canvasX - offsetX) / s + bounds.minX
      const worldY = (canvasY - offsetY) / s + bounds.minY

      // Center viewport on this world point
      const newX = -(worldX - viewportWidth / stageScale / 2) * stageScale
      const newY = -(worldY - viewportHeight / stageScale / 2) * stageScale
      setStagePosition({ x: newX, y: newY })
    },
    [computeWorldBounds, stageScale, viewportWidth, viewportHeight, setStagePosition],
  )

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      isDraggingRef.current = true
      const { x, y } = getCanvasCoords(e)
      panToMinimapPoint(x, y)
    },
    [getCanvasCoords, panToMinimapPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return
      const { x, y } = getCanvasCoords(e)
      panToMinimapPoint(x, y)
    },
    [getCanvasCoords, panToMinimapPoint],
  )

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-14 left-4 z-40 bg-gray-900/90 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-gray-800 backdrop-blur"
      >
        Minimap
      </button>
    )
  }

  return (
    <div className="absolute bottom-14 left-4 z-40 rounded-lg shadow-lg overflow-hidden backdrop-blur">
      <div className="flex items-center justify-between px-3 py-1 bg-gray-900/90 border-b border-gray-700">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Minimap</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-400 cursor-pointer hover:text-white text-sm leading-none"
          aria-label="Collapse minimap"
        >
          &minus;
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        style={{ width: MINIMAP_W, height: MINIMAP_H, display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  )
}
