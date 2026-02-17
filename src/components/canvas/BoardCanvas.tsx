import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage } from 'react-konva'
import type Konva from 'konva'
import { useUiStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { useAuthStore, getValidUserId } from '../../store/authStore'
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

export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export function BoardCanvas({ broadcastCursor }: BoardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isSpaceHeld, setIsSpaceHeld] = useState(false)
  // selectionRect is state because it drives rendering of the visual rect.
  // selectionRectRef mirrors it so handleMouseUp can read the latest value
  // without capturing a stale closure (avoids re-creating the callback each frame).
  // isPanningRef/isSelectingRef are refs because they only gate logic in
  // event handlers and don't need to trigger re-renders.
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const selectionRectRef = useRef<SelectionRect | null>(null)

  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panStartStageRef = useRef({ x: 0, y: 0 })
  const isSelectingRef = useRef(false)
  const selectionStartRef = useRef({ x: 0, y: 0 })
  // Tracks whether the current mousedown initiated a pan or selection drag,
  // so the subsequent click event can be suppressed without setTimeout.
  const interactionStartedRef = useRef(false)

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

  function updateSelectionRect(rect: SelectionRect | null) {
    selectionRectRef.current = rect
    setSelectionRect(rect)
  }

  // Keyboard: delete, spacebar, Ctrl/Cmd+A
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const editing = useUiStore.getState().editingId !== null
      if (editing) return

      const mod = e.metaKey || e.ctrlKey

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedIds } = useBoardStore.getState()
        if (selectedIds.length === 0) return
        e.preventDefault()
        const deletedIds = deleteSelectedObjects()
        deletedIds.forEach((id) => deleteObject(id))
        return
      }

      if (mod && e.key === 'a') {
        e.preventDefault()
        selectAll()
        return
      }

      if (mod && e.key === 'd') {
        e.preventDefault()
        const newObjects = useBoardStore.getState().duplicateSelected(getValidUserId())
        newObjects.forEach((obj) => insertObject(obj))
        return
      }

      if (mod && e.key === 'c') {
        e.preventDefault()
        useBoardStore.getState().copySelected()
        return
      }

      if (mod && e.key === 'v') {
        e.preventDefault()
        const newObjects = useBoardStore.getState().pasteClipboard(getValidUserId())
        newObjects.forEach((obj) => insertObject(obj))
        return
      }

      if (e.key === ' ' && !e.repeat) {
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

  // Prevent middle-click autoscroll on the container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    function preventMiddleClick(e: MouseEvent) {
      if (e.button === 1) e.preventDefault()
    }
    container.addEventListener('mousedown', preventMiddleClick)
    return () => container.removeEventListener('mousedown', preventMiddleClick)
  }, [])

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

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage()
      if (!stage) return

      const currentTool = useUiStore.getState().tool
      const spaceHeld = isSpaceHeld

      // Determine if we should pan
      const evt = e.evt
      const shouldPanNow =
        evt.button === 1 ||
        (spaceHeld && evt.button === 0) ||
        (currentTool === 'hand' && evt.button === 0)

      if (shouldPanNow) {
        evt.preventDefault()
        isPanningRef.current = true
        interactionStartedRef.current = true
        panStartRef.current = { x: evt.clientX, y: evt.clientY }
        const { stagePosition: pos } = useUiStore.getState()
        panStartStageRef.current = { x: pos.x, y: pos.y }
        return
      }

      if (evt.button !== 0) return

      // Selection rect — only on empty canvas with select tool
      if (currentTool === 'select' && isClickOnEmpty(e)) {
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        const { stagePosition: pos, stageScale: scale } = useUiStore.getState()
        const worldX = (pointer.x - pos.x) / scale
        const worldY = (pointer.y - pos.y) / scale
        isSelectingRef.current = true
        interactionStartedRef.current = true
        selectionStartRef.current = { x: worldX, y: worldY }
        updateSelectionRect({ x: worldX, y: worldY, width: 0, height: 0 })
      }
    },
    [isSpaceHeld],
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

      if (isPanningRef.current) {
        const dx = e.evt.clientX - panStartRef.current.x
        const dy = e.evt.clientY - panStartRef.current.y
        useUiStore.getState().setStagePosition({
          x: panStartStageRef.current.x + dx,
          y: panStartStageRef.current.y + dy,
        })
        return
      }

      if (isSelectingRef.current) {
        const startX = selectionStartRef.current.x
        const startY = selectionStartRef.current.y
        updateSelectionRect({
          x: Math.min(startX, worldX),
          y: Math.min(startY, worldY),
          width: Math.abs(worldX - startX),
          height: Math.abs(worldY - startY),
        })
      }
    },
    [broadcastCursor],
  )

  const handleMouseUp = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanningRef.current) {
        isPanningRef.current = false
        // interactionStartedRef stays true until click fires
        return
      }

      if (isSelectingRef.current) {
        isSelectingRef.current = false
        // Read from ref to avoid stale closure — selectionRect state updates
        // every frame during drag, so capturing it in useCallback deps would
        // re-create this handler on every mouse move.
        const rect = selectionRectRef.current
        updateSelectionRect(null)

        if (!rect || (rect.width < SELECTION_THRESHOLD && rect.height < SELECTION_THRESHOLD)) {
          // Too small — treat as a click, let handleStageClick handle deselect
          interactionStartedRef.current = false
          return
        }

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
        useBoardStore.getState().setSelectedIds(hits.map((o) => o.id))
        // interactionStartedRef stays true until click fires
      }
    },
    [],
  )

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    // Skip if this click is the tail end of a pan or selection drag
    if (interactionStartedRef.current) {
      interactionStartedRef.current = false
      return
    }

    const stage = e.target.getStage()
    const target = e.target
    const clickedOnEmpty =
      target === stage || (target.getParent() === stage && target.nodeType === 'Layer')

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
      const userId = getValidUserId()
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
    if (CREATION_TOOLS.has(tool)) return 'cursor-crosshair'
    return 'cursor-default'
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
          <ObjectLayer selectionRect={selectionRect} />
          <CursorLayer />
        </Stage>
      )}
      <TextEditor />
    </div>
  )
}
