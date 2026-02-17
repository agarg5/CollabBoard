import { useEffect, useRef } from 'react'
import { Layer, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { patchObject } from '../../lib/boardSync'
import { StickyNote, MIN_WIDTH as STICKY_MIN_W, MIN_HEIGHT as STICKY_MIN_H } from './StickyNote'
import { ShapeRect, MIN_WIDTH as RECT_MIN_W, MIN_HEIGHT as RECT_MIN_H } from './ShapeRect'
import { ShapeCircle, MIN_WIDTH as CIRCLE_MIN_W, MIN_HEIGHT as CIRCLE_MIN_H } from './ShapeCircle'

// All shape types currently share the same min (50). If per-type mins diverge,
// switch to a lookup by selected object type instead of a global min.
const MIN_WIDTH = Math.min(STICKY_MIN_W, RECT_MIN_W, CIRCLE_MIN_W)
const MIN_HEIGHT = Math.min(STICKY_MIN_H, RECT_MIN_H, CIRCLE_MIN_H)

export function ObjectLayer() {
  const objects = useBoardStore((s) => s.objects)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds)
  const updateObject = useBoardStore((s) => s.updateObject)
  const editingId = useUiStore((s) => s.editingId)
  const setEditingId = useUiStore((s) => s.setEditingId)

  const transformerRef = useRef<Konva.Transformer>(null)
  const layerRef = useRef<Konva.Layer>(null)

  useEffect(() => {
    const transformer = transformerRef.current
    const layer = layerRef.current
    if (!transformer || !layer) return

    const nodes = selectedIds
      .map((id) => layer.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[]
    transformer.nodes(nodes)
    transformer.getLayer()?.batchDraw()
  }, [selectedIds])

  function handleSelect(id: string) {
    setSelectedIds([id])
  }

  function handleDragEnd(id: string, x: number, y: number) {
    const updated_at = new Date().toISOString()
    updateObject(id, { x, y, updated_at })
    patchObject(id, { x, y, updated_at })
  }

  function handleTransformEnd(
    id: string,
    attrs: { x: number; y: number; width: number; height: number },
  ) {
    const updated_at = new Date().toISOString()
    updateObject(id, { ...attrs, updated_at })
    patchObject(id, { ...attrs, updated_at })
  }

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    e.target.moveToTop()
    // Keep the Transformer above everything
    transformerRef.current?.moveToTop()
  }

  function handleDoubleClick(id: string) {
    setEditingId(id)
  }

  return (
    <Layer ref={layerRef}>
      {[...objects].sort((a, b) => a.z_index - b.z_index).map((obj) => {
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
              onSelect={handleSelect}
              onDragStart={handleDragStart}
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
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />
          )
        }
        return null
      })}
      <Transformer
        ref={transformerRef}
        keepRatio={false}
        boundBoxFunc={(_oldBox, newBox) => ({
          ...newBox,
          width: Math.max(MIN_WIDTH, newBox.width),
          height: Math.max(MIN_HEIGHT, newBox.height),
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
