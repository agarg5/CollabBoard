export const MIN_SCALE = 0.1
export const MAX_SCALE = 5
const SCALE_BY = 1.05

export interface ZoomResult {
  scale: number
  position: { x: number; y: number }
}

/**
 * Calculate new scale and position so the point under the cursor stays fixed.
 */
export function calculateZoom(
  wheelDeltaY: number,
  pointerX: number,
  pointerY: number,
  currentScale: number,
  currentPosition: { x: number; y: number },
): ZoomResult {
  const direction = wheelDeltaY > 0 ? -1 : 1
  const newScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, currentScale * SCALE_BY ** direction),
  )

  // The pointer's position in world coordinates before zoom
  const mouseWorldX = (pointerX - currentPosition.x) / currentScale
  const mouseWorldY = (pointerY - currentPosition.y) / currentScale

  // Adjust position so the same world point stays under the cursor
  const newX = pointerX - mouseWorldX * newScale
  const newY = pointerY - mouseWorldY * newScale

  return { scale: newScale, position: { x: newX, y: newY } }
}
