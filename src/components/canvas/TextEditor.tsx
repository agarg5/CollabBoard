import { useEffect, useRef } from 'react'
import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { PADDING, FONT_SIZE } from './StickyNote'

export function TextEditor() {
  const editingId = useUiStore((s) => s.editingId)
  const setEditingId = useUiStore((s) => s.setEditingId)
  const stagePosition = useUiStore((s) => s.stagePosition)
  const stageScale = useUiStore((s) => s.stageScale)
  const objects = useBoardStore((s) => s.objects)
  const updateObject = useBoardStore((s) => s.updateObject)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const obj = editingId ? objects.find((o) => o.id === editingId) : null

  useEffect(() => {
    if (obj && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.value = (obj.properties.text as string) || ''
    }
  }, [obj])

  if (!obj) return null

  const x = obj.x * stageScale + stagePosition.x
  const y = obj.y * stageScale + stagePosition.y
  const width = obj.width * stageScale
  const height = obj.height * stageScale
  const scaledFontSize = FONT_SIZE * stageScale
  const scaledPadding = PADDING * stageScale

  function handleBlur() {
    if (!obj || !textareaRef.current) return
    const text = textareaRef.current.value
    updateObject(obj.id, {
      properties: { ...obj.properties, text },
    })
    setEditingId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      handleBlur()
    }
  }

  return (
    <textarea
      ref={textareaRef}
      className="absolute border-none outline-none resize-none bg-transparent overflow-hidden"
      style={{
        left: x + scaledPadding,
        top: y + scaledPadding,
        width: width - scaledPadding * 2,
        height: height - scaledPadding * 2,
        fontSize: scaledFontSize,
        lineHeight: '1.2',
        fontFamily: 'sans-serif',
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
