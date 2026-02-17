import { useEffect, useRef } from 'react'
import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { patchObject } from '../../lib/boardSync'
import { PADDING as STICKY_PADDING, FONT_SIZE as STICKY_FONT_SIZE, FONT_FAMILY, LINE_HEIGHT as STICKY_LINE_HEIGHT } from './StickyNote'
import { FONT_SIZE as TEXT_FONT_SIZE, LINE_HEIGHT as TEXT_LINE_HEIGHT, PADDING as TEXT_PADDING } from './TextObject'

export function TextEditor() {
  const editingId = useUiStore((s) => s.editingId)
  const setEditingId = useUiStore((s) => s.setEditingId)
  const stagePosition = useUiStore((s) => s.stagePosition)
  const stageScale = useUiStore((s) => s.stageScale)
  const obj = useBoardStore((s) =>
    editingId ? s.objects.find((o) => o.id === editingId) : null,
  )
  const updateObject = useBoardStore((s) => s.updateObject)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (obj && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.value = (obj.properties.text as string) || ''
    }
  }, [obj])

  if (!obj) return null

  const isText = obj.type === 'text'
  const fontSize = isText ? ((obj.properties.fontSize as number) || TEXT_FONT_SIZE) : STICKY_FONT_SIZE
  const padding = isText ? TEXT_PADDING : STICKY_PADDING
  const lineHeight = isText ? TEXT_LINE_HEIGHT : STICKY_LINE_HEIGHT

  const x = obj.x * stageScale + stagePosition.x
  const y = obj.y * stageScale + stagePosition.y
  const width = obj.width * stageScale
  const height = obj.height * stageScale
  const scaledFontSize = fontSize * stageScale
  const scaledPadding = padding * stageScale

  function handleBlur() {
    if (!obj || !textareaRef.current) return
    const text = textareaRef.current.value
    const updated_at = new Date().toISOString()
    // TODO: persist color/fontSize changes from a future text color picker
    const properties = { ...obj.properties, text }
    updateObject(obj.id, { properties, updated_at })
    patchObject(obj.id, { properties, updated_at })
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
        lineHeight: `${lineHeight}`,
        color: isText ? ((obj.properties.color as string) || '#1e293b') : undefined,
        fontFamily: FONT_FAMILY,
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
