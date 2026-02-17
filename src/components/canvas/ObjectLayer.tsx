import { useEffect, useRef } from 'react'
import { Layer, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { patchObject } from '../../lib/boardSync'
import { StickyNote, MIN_WIDTH, MIN_HEIGHT } from './StickyNote'

export function ObjectLayer() {
  const objects = useBoardStore((s) => s.objects)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const setSelectedIds = useBoardStore((s) => s.setSelectedIds)
  const updateObject = useBoardStore((s) => s.updateObject)
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
    patchObject(id, { x, y })
  }

  function handleTransformEnd(
    id: string,
    attrs: { x: number; y: number; width: number; height: number },
  ) {
    const updated_at = new Date().toISOString()
    updateObject(id, { ...attrs, updated_at })
    patchObject(id, attrs)
  }

  function handleDoubleClick(id: string) {
    setEditingId(id)
  }

  return (
    <Layer ref={layerRef}>
      {[...objects].sort((a, b) => a.z_index - b.z_index).map((obj) => {
        if (obj.type === 'sticky_note') {
          return (
            <StickyNote
              key={obj.id}
              obj={obj}
              isSelected={selectedIds.includes(obj.id)}
              onSelect={handleSelect}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
              onDoubleClick={handleDoubleClick}
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
