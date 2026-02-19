import { useMemo } from 'react'
import { useBoardStore } from '../store/boardStore'
import { useUiStore } from '../store/uiStore'
import type { BoardObject } from '../types/board'

const PADDING = 200 // world-unit padding to prevent pop-in

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

    // Compute visible viewport in world coordinates
    const vpLeft = (-stagePosition.x / stageScale) - PADDING
    const vpTop = (-stagePosition.y / stageScale) - PADDING
    const vpRight = ((-stagePosition.x + stageWidth) / stageScale) + PADDING
    const vpBottom = ((-stagePosition.y + stageHeight) / stageScale) + PADDING

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

      // AABB intersection check
      if (
        obj.x + obj.width >= vpLeft &&
        obj.x <= vpRight &&
        obj.y + obj.height >= vpTop &&
        obj.y <= vpBottom
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
