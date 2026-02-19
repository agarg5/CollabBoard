import { useUiStore } from '../../store/uiStore'
import { calculateZoom, MIN_SCALE, MAX_SCALE } from '../canvas/zoomHelper'

export interface ZoomControlsProps {
  viewportWidth: number
  viewportHeight: number
}

/**
 * Zoom in (+) and zoom out (-) buttons plus zoom level indicator.
 * Zooms toward the center of the viewport.
 */
export function ZoomControls({ viewportWidth, viewportHeight }: ZoomControlsProps) {
  const stageScale = useUiStore((s) => s.stageScale)
  const stagePosition = useUiStore((s) => s.stagePosition)
  const setStageScale = useUiStore((s) => s.setStageScale)
  const setStagePosition = useUiStore((s) => s.setStagePosition)

  const centerX = viewportWidth / 2
  const centerY = viewportHeight / 2

  function handleZoomIn() {
    const { scale, position } = calculateZoom(
      -100,
      centerX,
      centerY,
      stageScale,
      stagePosition,
    )
    setStageScale(scale)
    setStagePosition(position)
  }

  function handleZoomOut() {
    const { scale, position } = calculateZoom(
      100,
      centerX,
      centerY,
      stageScale,
      stagePosition,
    )
    setStageScale(scale)
    setStagePosition(position)
  }

  const atMinScale = stageScale <= MIN_SCALE
  const atMaxScale = stageScale >= MAX_SCALE
  const zoomPercent = Math.round(stageScale * 100)

  return (
    <div
      className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white/95 px-1 py-1 shadow-sm"
      role="group"
      aria-label="Canvas zoom controls"
    >
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={atMinScale}
        title="Zoom out"
        aria-label="Zoom out"
        className="flex h-8 w-8 items-center justify-center rounded text-lg font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        −
      </button>
      <span
        className="min-w-[3rem] px-2 text-center text-sm tabular-nums text-gray-600"
        aria-label={`Zoom level ${zoomPercent} percent`}
      >
        {zoomPercent}%
      </span>
      <button
        type="button"
        onClick={handleZoomIn}
        disabled={atMaxScale}
        title="Zoom in"
        aria-label="Zoom in"
        className="flex h-8 w-8 items-center justify-center rounded text-lg font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        +
      </button>
    </div>
  )
}
