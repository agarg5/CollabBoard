import { useMemo } from 'react'
import { useBoardStore } from '../store/boardStore'
import { useUiStore } from '../store/uiStore'
import type { BoardObject } from '../types/board'

const PADDING_PX = 200 // screen-pixel padding to prevent pop-in

interface UseVisibleObjectsParams {
  stageWidth: number
  stageHeight: number
}

export function useVisibleObjects({ stageWidth, stageHeight }: UseVisibleObjectsParams): BoardObject[] {
  const objects = useBoardStore((s) => s.objects)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const editingId = useUiStore((s) => s.editingId)
  const stagePosition = useUiStore((s) => s.stagePosition)
  const stageScale = useUiStore((s) => s.stageScale)

  return useMemo(() => {
    if (stageWidth === 0 || stageHeight === 0) return objects

    // Compute visible viewport in world coordinates (padding applied in screen pixels)
    const vpLeft = (-stagePosition.x - PADDING_PX) / stageScale
    const vpTop = (-stagePosition.y - PADDING_PX) / stageScale
    const vpRight = (-stagePosition.x + stageWidth + PADDING_PX) / stageScale
    const vpBottom = (-stagePosition.y + stageHeight + PADDING_PX) / stageScale

    const selectedSet = new Set(selectedIds)

    // First pass: filter non-connectors
    const visibleNonConnectors: BoardObject[] = []
    const visibleNonConnectorIds = new Set<string>()
    const connectors: BoardObject[] = []

    for (const obj of objects) {
      if (obj.type === 'connector') {
        connectors.push(obj)
        continue
      }

      // Always render selected or editing objects
      if (selectedSet.has(obj.id) || obj.id === editingId) {
        visibleNonConnectors.push(obj)
        visibleNonConnectorIds.add(obj.id)
        continue
      }

      // Compute rotated bounding box for AABB intersection check
      let w = obj.width
      let h = obj.height
      const rotation = obj.rotation ?? 0
      if (rotation % 90 !== 0) {
        const rad = (rotation * Math.PI) / 180
        const sin = Math.abs(Math.sin(rad))
        const cos = Math.abs(Math.cos(rad))
        w = obj.width * cos + obj.height * sin
        h = obj.width * sin + obj.height * cos
      }
      // Center the expanded box on the object's center
      const cx = obj.x + obj.width / 2
      const cy = obj.y + obj.height / 2
      const left = cx - w / 2
      const top = cy - h / 2

      if (
        left + w >= vpLeft &&
        left <= vpRight &&
        top + h >= vpTop &&
        top <= vpBottom
      ) {
        visibleNonConnectors.push(obj)
        visibleNonConnectorIds.add(obj.id)
      }
    }

    // Second pass: connectors — include if they're in viewport, selected,
    // or either endpoint object is visible
    const visibleConnectors: BoardObject[] = []
    for (const conn of connectors) {
      if (selectedSet.has(conn.id) || conn.id === editingId) {
        visibleConnectors.push(conn)
        continue
      }

      const startId = conn.properties.startObjectId as string | undefined
      const endId = conn.properties.endObjectId as string | undefined
      if (
        (startId && visibleNonConnectorIds.has(startId)) ||
        (endId && visibleNonConnectorIds.has(endId))
      ) {
        visibleConnectors.push(conn)
        continue
      }

      // Also check if the connector line itself is in viewport
      // Use bounding box of start/end points
      const minX = Math.min(conn.x, conn.x + conn.width)
      const maxX = Math.max(conn.x, conn.x + conn.width)
      const minY = Math.min(conn.y, conn.y + conn.height)
      const maxY = Math.max(conn.y, conn.y + conn.height)
      if (maxX >= vpLeft && minX <= vpRight && maxY >= vpTop && minY <= vpBottom) {
        visibleConnectors.push(conn)
      }
    }

    return [...visibleNonConnectors, ...visibleConnectors]
  }, [objects, selectedIds, editingId, stagePosition, stageScale, stageWidth, stageHeight])
}
