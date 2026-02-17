import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage } from 'react-konva'
import type Konva from 'konva'
import { useUiStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { useAuthStore } from '../../store/authStore'
import { BackgroundGrid } from './BackgroundGrid'
import { ObjectLayer } from './ObjectLayer'
import { TextEditor } from './TextEditor'
import { calculateZoom } from './zoomHelper'
import { insertObject } from '../../lib/boardSync'
import type { BoardObject } from '../../types/board'

export function BoardCanvas() {
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

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage()
    const target = e.target
    const clickedOnEmpty =
      target === stage || (target.getParent() === stage && target.nodeType === 'Layer')

    if (tool === 'sticky_note' && clickedOnEmpty && stage) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const worldX = (pointer.x - stagePosition.x) / stageScale
      const worldY = (pointer.y - stagePosition.y) / stageScale

      const { boardId, objects } = useBoardStore.getState()
      const userId = useAuthStore.getState().user?.id ?? ''
      const newNote: BoardObject = {
        id: crypto.randomUUID(),
        board_id: boardId,
        type: 'sticky_note',
        properties: { text: '', color: '#fef08a' },
        x: worldX - 100,
        y: worldY - 100,
        width: 200,
        height: 200,
        z_index: objects.reduce((max, o) => Math.max(max, o.z_index), 0) + 1,
        created_by: userId,
        updated_at: new Date().toISOString(),
      }
      addObject(newNote)
      insertObject(newNote)
      setSelectedIds([newNote.id])
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
        >
          <BackgroundGrid
            stageWidth={dimensions.width}
            stageHeight={dimensions.height}
            stageX={stagePosition.x}
            stageY={stagePosition.y}
            scale={stageScale}
          />
          <ObjectLayer />
        </Stage>
      )}
      <TextEditor />
    </div>
  )
}
