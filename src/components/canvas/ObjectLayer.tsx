import { useEffect, useMemo, useRef } from 'react'
import { Layer, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { patchObject } from '../../lib/boardSync'
import { useVisibleObjects } from '../../hooks/useVisibleObjects'
import { StickyNote, MIN_WIDTH as STICKY_MIN_W, MIN_HEIGHT as STICKY_MIN_H } from './StickyNote'
import { ShapeRect, MIN_WIDTH as RECT_MIN_W, MIN_HEIGHT as RECT_MIN_H } from './ShapeRect'
import { ShapeCircle, MIN_WIDTH as CIRCLE_MIN_W, MIN_HEIGHT as CIRCLE_MIN_H } from './ShapeCircle'
import { TextObject, MIN_WIDTH as TEXT_MIN_W, MIN_HEIGHT as TEXT_MIN_H } from './TextObject'
import { ShapeLine, MIN_WIDTH as LINE_MIN_W, MIN_HEIGHT as LINE_MIN_H } from './ShapeLine'
import { Connector, MIN_WIDTH as CONN_MIN_W, MIN_HEIGHT as CONN_MIN_H } from './Connector'
import { Frame, MIN_WIDTH as FRAME_MIN_W, MIN_HEIGHT as FRAME_MIN_H } from './Frame'
import type { SelectionRect } from './BoardCanvas'

const MIN_SIZES: Record<string, { width: number; height: number }> = {
  sticky_note: { width: STICKY_MIN_W, height: STICKY_MIN_H },
  rectangle: { width: RECT_MIN_W, height: RECT_MIN_H },
  circle: { width: CIRCLE_MIN_W, height: CIRCLE_MIN_H },
  text: { width: TEXT_MIN_W, height: TEXT_MIN_H },
  line: { width: LINE_MIN_W, height: LINE_MIN_H },
  connector: { width: CONN_MIN_W, height: CONN_MIN_H },
  frame: { width: FRAME_MIN_W, height: FRAME_MIN_H },
}
const DEFAULT_MIN = { width: 50, height: 50 }

interface ObjectLayerProps {
  selectionRect: SelectionRect | null
  stageWidth: number
  stageHeight: number
}

export function ObjectLayer({ selectionRect, stageWidth, stageHeight }: ObjectLayerProps) {
  const visibleObjects = useVisibleObjects({ stageWidth, stageHeight })
  const objects = useBoardStore((s) => s.objects)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds)
  const updateObject = useBoardStore((s) => s.updateObject)
  const editingId = useUiStore((s) => s.editingId)
  const setEditingId = useUiStore((s) => s.setEditingId)

  const transformerRef = useRef<Konva.Transformer>(null)
  const layerRef = useRef<Konva.Layer>(null)
  // Stores initial positions of all selected objects when multi-drag starts
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  const selectedMins = useMemo(() => {
    if (selectedIds.length !== 1) return DEFAULT_MIN
    const type = objects.find((o) => o.id === selectedIds[0])?.type
    return (type && MIN_SIZES[type]) || DEFAULT_MIN
  }, [selectedIds, objects])

  // Re-run when selectedIds changes OR when visibleObjects changes (so that
  // culled-then-selected nodes are attached after they mount into the layer).
  useEffect(() => {
    const transformer = transformerRef.current
    const layer = layerRef.current
    if (!transformer || !layer) return

    const nodes = selectedIds
      .map((id) => layer.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[]
    transformer.nodes(nodes)
    transformer.getLayer()?.batchDraw()
  }, [selectedIds, visibleObjects])

  function handleSelect(id: string, e?: Konva.KonvaEventObject<MouseEvent>) {
    if (e?.evt.shiftKey) {
      const current = useBoardStore.getState().selectedIds
      if (current.includes(id)) {
        setSelectedIds(current.filter((sid) => sid !== id))
      } else {
        setSelectedIds([...current, id])
      }
    } else {
      setSelectedIds([id])
    }
  }

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    const draggedId = e.target.id()
    const { selectedIds: ids } = useBoardStore.getState()

    // If dragged object is not in selection, select only it
    if (!ids.includes(draggedId)) {
      setSelectedIds([draggedId])
      dragStartPositions.current.clear()
      return
    }

    // Store initial positions of all selected nodes for multi-drag
    dragStartPositions.current.clear()
    const layer = layerRef.current
    if (!layer) return
    for (const id of ids) {
      const node = layer.findOne(`#${id}`)
      if (node) {
        dragStartPositions.current.set(id, { x: node.x(), y: node.y() })
      }
    }

    e.target.moveToTop()
    transformerRef.current?.moveToTop()
  }

  /** Visually reposition connector Konva nodes during drag (no store/DB writes). */
  function updateConnectorEndpointsVisual(movedId: string, liveX: number, liveY: number) {
    const layer = layerRef.current
    if (!layer) return
    const { objects: allObjects } = useBoardStore.getState()
    const movedObj = allObjects.find((o) => o.id === movedId)
    if (!movedObj) return

    for (const conn of allObjects) {
      if (conn.type !== 'connector') continue
      const startId = conn.properties.startObjectId as string | undefined
      const endId = conn.properties.endObjectId as string | undefined
      if (startId !== movedId && endId !== movedId) continue

      const startObj = startId ? allObjects.find((o) => o.id === startId) : null
      const endObj = endId ? allObjects.find((o) => o.id === endId) : null

      let sx = conn.x
      let sy = conn.y
      if (startObj) {
        if (startObj.id === movedId) {
          sx = liveX + movedObj.width / 2
          sy = liveY + movedObj.height / 2
        } else {
          sx = startObj.x + startObj.width / 2
          sy = startObj.y + startObj.height / 2
        }
      }

      let ex = conn.x + conn.width
      let ey = conn.y + conn.height
      if (endObj) {
        if (endObj.id === movedId) {
          ex = liveX + movedObj.width / 2
          ey = liveY + movedObj.height / 2
        } else {
          ex = endObj.x + endObj.width / 2
          ey = endObj.y + endObj.height / 2
        }
      }

      const connNode = layer.findOne(`#${conn.id}`)
      if (connNode) {
        connNode.x(sx)
        connNode.y(sy)
        connNode.width(ex - sx)
        connNode.height(ey - sy)
      }
    }
  }

  function handleDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const draggedId = e.target.id()
    const startPos = dragStartPositions.current.get(draggedId)
    if (!startPos || dragStartPositions.current.size <= 1) {
      // Single object drag — update connectors visually
      updateConnectorEndpointsVisual(draggedId, e.target.x(), e.target.y())
      return
    }

    const dx = e.target.x() - startPos.x
    const dy = e.target.y() - startPos.y

    const layer = layerRef.current
    if (!layer) return

    for (const [id, pos] of dragStartPositions.current) {
      if (id === draggedId) continue
      const node = layer.findOne(`#${id}`)
      if (node) {
        node.x(pos.x + dx)
        node.y(pos.y + dy)
      }
    }

    // Update connectors visually for all dragged objects
    for (const [id, pos] of dragStartPositions.current) {
      const liveX = id === draggedId ? e.target.x() : pos.x + dx
      const liveY = id === draggedId ? e.target.y() : pos.y + dy
      updateConnectorEndpointsVisual(id, liveX, liveY)
    }
  }

  function updateConnectorEndpoints(movedId: string) {
    const { objects: allObjects } = useBoardStore.getState()
    const movedObj = allObjects.find((o) => o.id === movedId)
    if (!movedObj) return

    for (const conn of allObjects) {
      if (conn.type !== 'connector') continue
      const startId = conn.properties.startObjectId as string | undefined
      const endId = conn.properties.endObjectId as string | undefined
      if (startId !== movedId && endId !== movedId) continue

      const startObj = startId ? allObjects.find((o) => o.id === startId) : null
      const endObj = endId ? allObjects.find((o) => o.id === endId) : null

      // Compute start point
      let sx = conn.x
      let sy = conn.y
      if (startObj) {
        sx = startObj.x + startObj.width / 2
        sy = startObj.y + startObj.height / 2
      }

      // Compute end point
      let ex = conn.x + conn.width
      let ey = conn.y + conn.height
      if (endObj) {
        ex = endObj.x + endObj.width / 2
        ey = endObj.y + endObj.height / 2
      }

      const updated_at = new Date().toISOString()
      const patch = {
        x: sx,
        y: sy,
        width: ex - sx,
        height: ey - sy,
        updated_at,
      }
      updateObject(conn.id, patch)
      patchObject(conn.id, patch)
    }
  }

  function handleDragEnd(id: string, x: number, y: number) {
    const updated_at = new Date().toISOString()

    // If multi-drag, persist all selected objects
    if (dragStartPositions.current.size > 1) {
      const layer = layerRef.current
      const { selectedIds: ids } = useBoardStore.getState()
      for (const sid of ids) {
        const node = layer?.findOne(`#${sid}`)
        if (node) {
          const nx = node.x()
          const ny = node.y()
          updateObject(sid, { x: nx, y: ny, updated_at })
          patchObject(sid, { x: nx, y: ny, updated_at })
        }
      }
      // Update connector endpoints for all moved objects
      for (const sid of ids) {
        updateConnectorEndpoints(sid)
      }
      dragStartPositions.current.clear()
      return
    }

    updateObject(id, { x, y, updated_at })
    patchObject(id, { x, y, updated_at })
    updateConnectorEndpoints(id)
    dragStartPositions.current.clear()
  }

  function handleTransformEnd(
    id: string,
    attrs: { x: number; y: number; width: number; height: number; rotation?: number },
  ) {
    const updated_at = new Date().toISOString()
    updateObject(id, { ...attrs, updated_at })
    patchObject(id, { ...attrs, updated_at })
    updateConnectorEndpoints(id)
  }

  function handleDoubleClick(id: string) {
    setEditingId(id)
  }

  return (
    <Layer ref={layerRef}>
      {[...visibleObjects].sort((a, b) => a.z_index - b.z_index).map((obj) => {
        const isSelected = selectedIds.includes(obj.id)
        if (obj.type === 'sticky_note') {
          return (
            <StickyNote
              key={obj.id}
              obj={obj}
              isSelected={isSelected}
              isEditing={editingId === obj.id}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
              onDoubleClick={handleDoubleClick}
            />
          )
        }
        if (obj.type === 'rectangle') {
          return (
            <ShapeRect
              key={obj.id}
              obj={obj}
              isSelected={isSelected}
              isEditing={editingId === obj.id}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />
          )
        }
        if (obj.type === 'circle') {
          return (
            <ShapeCircle
              key={obj.id}
              obj={obj}
              isSelected={isSelected}
              isEditing={editingId === obj.id}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />
          )
        }
        if (obj.type === 'line') {
          return (
            <ShapeLine
              key={obj.id}
              obj={obj}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />
          )
        }
        if (obj.type === 'connector') {
          return (
            <Connector
              key={obj.id}
              obj={obj}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />
          )
        }
        if (obj.type === 'frame') {
          return (
            <Frame
              key={obj.id}
              obj={obj}
              isSelected={isSelected}
              isEditing={editingId === obj.id}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
              onDoubleClick={handleDoubleClick}
            />
          )
        }
        if (obj.type === 'text') {
          return (
            <TextObject
              key={obj.id}
              obj={obj}
              isSelected={isSelected}
              isEditing={editingId === obj.id}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
              onDoubleClick={handleDoubleClick}
            />
          )
        }
        return null
      })}
      {selectionRect && (
        <Rect
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[6, 3]}
          listening={false}
        />
      )}
      <Transformer
        ref={transformerRef}
        rotateEnabled
        keepRatio={false}
        boundBoxFunc={(_oldBox, newBox) => ({
          ...newBox,
          width: Math.max(selectedMins.width, newBox.width),
          height: Math.max(selectedMins.height, newBox.height),
        })}
        anchorSize={8}
        anchorCornerRadius={2}
        borderStroke="#3b82f6"
        anchorStroke="#3b82f6"
        anchorFill="#ffffff"
      />
    </Layer>
  )
}
