import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { getValidUserId } from '../../store/authStore'
import { patchObject, deleteObject, insertObject } from '../../lib/boardSync'
import type { BoardObject } from '../../types/board'

const STICKY_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Pink', value: '#fda4af' },
  { name: 'Blue', value: '#93c5fd' },
  { name: 'Green', value: '#86efac' },
  { name: 'Purple', value: '#c4b5fd' },
]

const SHAPE_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Gray', value: '#6b7280' },
]

const SHAPE_TYPES = new Set(['rectangle', 'circle'])

function getMultiSelectColorInfo(selectedIds: string[], objects: BoardObject[]) {
  if (selectedIds.length === 0) return null

  const selectedObjs = objects.filter((o) => selectedIds.includes(o.id))
  if (selectedObjs.length === 0) return null

  const types = new Set(selectedObjs.map((o) => o.type))

  // All sticky notes
  if (types.size === 1 && types.has('sticky_note')) {
    return { palette: STICKY_COLORS, colorKey: 'color' as const, isShape: false }
  }

  // All shapes (rectangle/circle)
  if ([...types].every((t) => SHAPE_TYPES.has(t))) {
    return { palette: SHAPE_COLORS, colorKey: 'fillColor' as const, isShape: true }
  }

  return null
}

export function Toolbar() {
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const objects = useBoardStore((s) => s.objects)
  const updateObject = useBoardStore((s) => s.updateObject)
  const deleteSelectedObjects = useBoardStore((s) => s.deleteSelectedObjects)
  const copySelected = useBoardStore((s) => s.copySelected)
  const pasteClipboard = useBoardStore((s) => s.pasteClipboard)
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected)
  const clipboardLength = useBoardStore((s) => s.clipboard.length)

  function handleDuplicate() {
    const newObjects = duplicateSelected(getValidUserId())
    newObjects.forEach((obj) => insertObject(obj))
  }

  function handlePaste() {
    const newObjects = pasteClipboard(getValidUserId())
    newObjects.forEach((obj) => insertObject(obj))
  }

  const colorInfo = getMultiSelectColorInfo(selectedIds, objects)

  function handleColorChange(color: string) {
    if (!colorInfo) return
    const updated_at = new Date().toISOString()
    const selectedObjs = objects.filter((o) => selectedIds.includes(o.id))
    for (const obj of selectedObjs) {
      const properties = colorInfo.isShape
        ? { ...obj.properties, fillColor: color }
        : { ...obj.properties, color }
      updateObject(obj.id, { properties, updated_at })
      patchObject(obj.id, { properties, updated_at })
    }
  }

  // Determine the "active" color — show as active if all share the same color
  const activeColor = (() => {
    if (!colorInfo) return undefined
    const selectedObjs = objects.filter((o) => selectedIds.includes(o.id))
    const colors = selectedObjs.map((o) => o.properties[colorInfo.colorKey] as string)
    return colors.every((c) => c === colors[0]) ? colors[0] : undefined
  })()

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200">
      <button
        onClick={() => setTool('select')}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'select' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="inline-block mr-1 -mt-0.5"
        >
          <path
            d="M3 1L13 8L8 9L6 14L3 1Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        Select
      </button>
      <button
        onClick={() => setTool('hand')}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'hand' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="inline-block mr-1 -mt-0.5"
        >
          <path
            d="M8 1.5v7M5.5 3.5v5.5M3.5 5.5v4a4.5 4.5 0 009 0V4.5M10.5 3v6M12.5 5v4.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Hand
      </button>
      <button
        onClick={() => setTool('sticky_note')}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'sticky_note' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="inline-block mr-1 -mt-0.5"
        >
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
          <line x1="5" y1="9" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
        </svg>
        Sticky Note
      </button>
      <button
        onClick={() => setTool('rectangle')}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'rectangle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="inline-block mr-1 -mt-0.5"
        >
          <rect
            x="2"
            y="3"
            width="12"
            height="10"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        Rectangle
      </button>
      <button
        onClick={() => setTool('circle')}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'circle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="inline-block mr-1 -mt-0.5"
        >
          <ellipse
            cx="8"
            cy="8"
            rx="6"
            ry="6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        Circle
      </button>
      <button
        onClick={() => setTool('text')}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'text' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="inline-block mr-1 -mt-0.5"
        >
          <path
            d="M3 3h10M8 3v10M5.5 3v1M10.5 3v1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Text
      </button>

      {selectedIds.length > 0 && (
        <>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            title="Delete selected"
            onClick={() => {
              const deletedIds = deleteSelectedObjects()
              deletedIds.forEach((id) => deleteObject(id))
            }}
            className="px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-red-100 text-red-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="inline-block -mt-0.5"
            >
              <path
                d="M5 2V1h6v1h4v2H1V2h4zM2 5h12l-1 10H3L2 5zm4 2v6m4-6v6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            title="Duplicate (Ctrl+D)"
            onClick={handleDuplicate}
            className="px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-gray-100"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="inline-block -mt-0.5"
            >
              <rect x="4" y="4" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 3V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            title="Copy (Ctrl+C)"
            onClick={copySelected}
            className="px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-gray-100"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="inline-block -mt-0.5"
            >
              <rect x="5" y="5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 3V2a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </>
      )}

      {clipboardLength > 0 && (
        <>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            title="Paste (Ctrl+V)"
            onClick={handlePaste}
            className="px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-gray-100"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="inline-block -mt-0.5"
            >
              <rect x="3" y="4" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </>
      )}

      {colorInfo && (
        <>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          {colorInfo.palette.map((c) => (
            <button
              key={c.value}
              title={c.name}
              onClick={() => handleColorChange(c.value)}
              className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${
                activeColor === c.value
                  ? 'border-gray-600 scale-110'
                  : 'border-gray-300'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </>
      )}
    </div>
  )
}
