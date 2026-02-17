import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
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
import type { BoardObject, ObjectType } from '../../types/board'

const CREATION_TOOLS: Set<string> = new Set(['sticky_note', 'rectangle', 'circle', 'text'])
const SELECTION_THRESHOLD = 5

interface BoardCanvasProps {
  broadcastCursor: (worldX: number, worldY: number) => void
}

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export function BoardCanvas({ broadcastCursor }: BoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isSpaceHeld, setIsSpaceHeld] = useState(false)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)

  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panStartStageRef = useRef({ x: 0, y: 0 })
  const isSelectingRef = useRef(false)
  const selectionStartRef = useRef({ x: 0, y: 0 })
  const justFinishedDragRef = useRef(false)

  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const stagePosition = useUiStore((s) => s.stagePosition)
  const stageScale = useUiStore((s) => s.stageScale)
  const setStagePosition = useUiStore((s) => s.setStagePosition)
  const setStageScale = useUiStore((s) => s.setStageScale)
  const addObject = useBoardStore((s) => s.addObject)
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds)
  const deleteSelectedObjects = useBoardStore((s) => s.deleteSelectedObjects)
  const selectAll = useBoardStore((s) => s.selectAll)

  // Keyboard: delete, spacebar, Ctrl/Cmd+A
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const editing = useUiStore.getState().editingId !== null

      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editing) return
        const { selectedIds } = useBoardStore.getState()
        if (selectedIds.length === 0) return
        e.preventDefault()
        const deletedIds = deleteSelectedObjects()
        deletedIds.forEach((id) => deleteObject(id))
        return
      }

      // Ctrl/Cmd+A — select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        if (editing) return
        e.preventDefault()
        selectAll()
        return
      }

      // Spacebar — enable panning mode
      if (e.key === ' ' && !e.repeat) {
        if (editing) return
        e.preventDefault()
        setIsSpaceHeld(true)
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') {
        setIsSpaceHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [deleteSelectedObjects, selectAll])

  // Resize observer
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

  function isClickOnEmpty(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage()
    const target = e.target
    return target === stage || (target.getParent() === stage && target.nodeType === 'Layer')
  }

  function shouldPan(e: Konva.KonvaEventObject<MouseEvent>): boolean {
    const evt = e.evt
    // Middle-click drag
    if (evt.button === 1) return true
    // Space held + left click
    if (isSpaceHeld && evt.button === 0) return true
    // Hand tool + left click
    if (tool === 'hand' && evt.button === 0) return true
    return false
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage()
    if (!stage) return

    // Panning?
    if (shouldPan(e)) {
      e.evt.preventDefault()
      isPanningRef.current = true
      panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY }
      const { stagePosition: pos } = useUiStore.getState()
      panStartStageRef.current = { x: pos.x, y: pos.y }
      return
    }

    // Only left click from here
    if (e.evt.button !== 0) return

    // Selection rect — only on empty canvas with select tool
    if (tool === 'select' && isClickOnEmpty(e)) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const { stagePosition: pos, stageScale: scale } = useUiStore.getState()
      const worldX = (pointer.x - pos.x) / scale
      const worldY = (pointer.y - pos.y) / scale
      isSelectingRef.current = true
      selectionStartRef.current = { x: worldX, y: worldY }
      setSelectionRect({ x: worldX, y: worldY, width: 0, height: 0 })
    }
  }

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage()
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      // Broadcast cursor position
      const { stagePosition: pos, stageScale: scale } = useUiStore.getState()
      const worldX = (pointer.x - pos.x) / scale
      const worldY = (pointer.y - pos.y) / scale
      broadcastCursor(worldX, worldY)

      // Panning
      if (isPanningRef.current) {
        const dx = e.evt.clientX - panStartRef.current.x
        const dy = e.evt.clientY - panStartRef.current.y
        useUiStore.getState().setStagePosition({
          x: panStartStageRef.current.x + dx,
          y: panStartStageRef.current.y + dy,
        })
        return
      }

      // Selection rect
      if (isSelectingRef.current) {
        const startX = selectionStartRef.current.x
        const startY = selectionStartRef.current.y
        setSelectionRect({
          x: Math.min(startX, worldX),
          y: Math.min(startY, worldY),
          width: Math.abs(worldX - startX),
          height: Math.abs(worldY - startY),
        })
      }
    },
    [broadcastCursor],
  )

  function handleMouseUp(_e: Konva.KonvaEventObject<MouseEvent>) {
    // Finish panning
    if (isPanningRef.current) {
      isPanningRef.current = false
      justFinishedDragRef.current = true
      setTimeout(() => { justFinishedDragRef.current = false }, 0)
      return
    }

    // Finish selection rect
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      const rect = selectionRect
      setSelectionRect(null)

      if (!rect || (rect.width < SELECTION_THRESHOLD && rect.height < SELECTION_THRESHOLD)) {
        // Too small — treat as a click (deselect handled in handleStageClick)
        return
      }

      justFinishedDragRef.current = true
      setTimeout(() => { justFinishedDragRef.current = false }, 0)

      // AABB intersection test
      const objects = useBoardStore.getState().objects
      const hits = objects.filter((obj) => {
        return (
          obj.x < rect.x + rect.width &&
          obj.x + obj.width > rect.x &&
          obj.y < rect.y + rect.height &&
          obj.y + obj.height > rect.y
        )
      })
      setSelectedIds(hits.map((o) => o.id))
    }
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (justFinishedDragRef.current) return

    const stage = e.target.getStage()
    const target = e.target
    const clickedOnEmpty =
      target === stage || (target.getParent() === stage && target.nodeType === 'Layer')

    // Hand tool — don't create objects or deselect
    if (tool === 'hand') return

    if (CREATION_TOOLS.has(tool) && stage && (tool === 'text' || clickedOnEmpty)) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const { stagePosition: pos, stageScale: scale } = useUiStore.getState()
      const worldX = (pointer.x - pos.x) / scale
      const worldY = (pointer.y - pos.y) / scale

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
      } else if (tool === 'text') {
        width = 200
        height = 32
        properties = { text: '', color: '#1e293b', fontSize: 16 }
      }

      const { boardId, objects } = useBoardStore.getState()
      if (!boardId) return
      const rawId = useAuthStore.getState().user?.id
      const userId = rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : null
      const newObj: BoardObject = {
        id: crypto.randomUUID(),
        board_id: boardId,
        type: tool as ObjectType,
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
      if (tool === 'text') {
        useUiStore.getState().setEditingId(newObj.id)
      }
      setTool('select')
      return
    }

    if (clickedOnEmpty) {
      setSelectedIds([])
    }
  }

  function getCursorClass(): string {
    if (tool === 'hand' || isSpaceHeld) return 'cursor-grab'
    if (isPanningRef.current) return 'cursor-grabbing'
    if (CREATION_TOOLS.has(tool)) return 'cursor-crosshair'
    return 'cursor-default'
  }

  function renderSelectionRect() {
    if (!selectionRect) return null
    return (
      <Layer>
        <Rect
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[6, 3]}
        />
      </Layer>
    )
  }

  return (
    <div ref={containerRef} className={`relative flex-1 overflow-hidden bg-white ${getCursorClass()}`}>
      {dimensions.width > 0 && (
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          x={stagePosition.x}
          y={stagePosition.y}
          scaleX={stageScale}
          scaleY={stageScale}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <BackgroundGrid
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            stageX={stagePosition.x}
            stageY={stagePosition.y}
            scale={stageScale}
          />
          <ObjectLayer />
          {renderSelectionRect()}
          <CursorLayer />
        </Stage>
      )}
      <TextEditor />
    </div>
  )
}
