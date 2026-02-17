import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage } from 'react-konva'
import type Konva from 'konva'
import { useUiStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { useAuthStore } from '../../store/authStore'
import { BackgroundGrid } from './BackgroundGrid'
import { ObjectLayer } from './ObjectLayer'
import { CursorLayer } from './CursorLayer'
import { TextEditor } from './TextEditor'
import { calculateZoom } from './zoomHelper'
import { insertObject, deleteObject } from '../../lib/boardSync'
import type { BoardObject } from '../../types/board'

interface BoardCanvasProps {
  broadcastCursor: (worldX: number, worldY: number) => void
}

export function BoardCanvas({ broadcastCursor }: BoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const stagePosition = useUiStore((s) => s.stagePosition)
  const stageScale = useUiStore((s) => s.stageScale)
  const setStagePosition = useUiStore((s) => s.setStagePosition)
  const setStageScale = useUiStore((s) => s.setStageScale)
  const addObject = useBoardStore((s) => s.addObject)
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds)
  const deleteSelectedObjects = useBoardStore((s) => s.deleteSelectedObjects)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const { selectedIds } = useBoardStore.getState()
      if (selectedIds.length === 0) return
      if (useUiStore.getState().editingId !== null) return

      e.preventDefault()
      const deletedIds = deleteSelectedObjects()
      deletedIds.forEach((id) => deleteObject(id))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedObjects])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = e.target.getStage()
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const { scale, position } = calculateZoom(
        e.evt.deltaY,
        pointer.x,
        pointer.y,
        stageScale,
        stagePosition,
      )
      setStageScale(scale)
      setStagePosition(position)
    },
    [stageScale, stagePosition, setStageScale, setStagePosition],
  )

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target
      if (stage !== e.target.getStage()) return
      setStagePosition({ x: stage.x(), y: stage.y() })
    },
    [setStagePosition],
  )

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage()
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const { stagePosition: pos, stageScale: scale } = useUiStore.getState()
      const worldX = (pointer.x - pos.x) / scale
      const worldY = (pointer.y - pos.y) / scale
      broadcastCursor(worldX, worldY)
    },
    [broadcastCursor],
  )

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage()
    const target = e.target
    const clickedOnEmpty =
      target === stage || (target.getParent() === stage && target.nodeType === 'Layer')

    if ((tool === 'sticky_note' || tool === 'rectangle' || tool === 'circle') && clickedOnEmpty && stage) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const worldX = (pointer.x - stagePosition.x) / stageScale
      const worldY = (pointer.y - stagePosition.y) / stageScale

      let width = 200
      let height = 200
      let properties: Record<string, unknown> = { text: '', color: '#fef08a' }

      if (tool === 'rectangle') {
        width = 150
        height = 100
        properties = { fillColor: '#3b82f6', strokeColor: '#1e293b', strokeWidth: 2 }
      } else if (tool === 'circle') {
        width = 120
        height = 120
        properties = { fillColor: '#ec4899', strokeColor: '#1e293b', strokeWidth: 2 }
      }

      const { boardId, objects } = useBoardStore.getState()
      if (!boardId) return
      const rawId = useAuthStore.getState().user?.id
      const userId = rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : null
      const newObj: BoardObject = {
        id: crypto.randomUUID(),
        board_id: boardId,
        type: tool,
        properties,
        x: worldX - width / 2,
        y: worldY - height / 2,
        width,
        height,
        z_index: objects.reduce((max, o) => Math.max(max, o.z_index), 0) + 1,
        created_by: userId,
        updated_at: new Date().toISOString(),
      }
      addObject(newObj)
      insertObject(newObj)
      setSelectedIds([newObj.id])
      setTool('select')
      return
    }

    if (clickedOnEmpty) {
      setSelectedIds([])
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-white">
      {dimensions.width > 0 && (
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          x={stagePosition.x}
          y={stagePosition.y}
          scaleX={stageScale}
          scaleY={stageScale}
          draggable={tool === 'select'}
          onWheel={handleWheel}
          onDragMove={handleDragMove}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onMouseMove={handleMouseMove}
        >
          <BackgroundGrid
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            stageX={stagePosition.x}
            stageY={stagePosition.y}
            scale={stageScale}
          />
          <ObjectLayer />
          <CursorLayer />
        </Stage>
      )}
      <TextEditor />
    </div>
  )
}
