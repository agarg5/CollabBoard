import { useRef } from 'react'
import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { getValidUserId } from '../../store/authStore'
import { patchObject, deleteObject, insertObject } from '../../lib/boardSync'
import { trackDelete, trackBatchCreate, trackBatchUpdate } from '../../hooks/useUndoRedo'
import { exportBoardJson, parseBoardJson } from '../../lib/boardJson'
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

const STROKE_ONLY_TYPES = new Set(['line', 'connector'])
const FILLED_SHAPE_TYPES = new Set(['rectangle', 'circle'])


function getMultiSelectColorInfo(selectedIds: string[], objects: BoardObject[]) {
  if (selectedIds.length === 0) return null

  const selectedObjs = objects.filter((o) => selectedIds.includes(o.id))
  if (selectedObjs.length === 0) return null

  const types = new Set(selectedObjs.map((o) => o.type))

  // All sticky notes
  if (types.size === 1 && types.has('sticky_note')) {
    return { palette: STICKY_COLORS, colorKey: 'color' as const, isShape: false, isStrokeOnly: false }
  }

  // All stroke-only types (line, connector)
  if ([...types].every((t) => STROKE_ONLY_TYPES.has(t))) {
    return { palette: SHAPE_COLORS, colorKey: 'strokeColor' as const, isShape: true, isStrokeOnly: true }
  }

  // All filled shapes (rectangle/circle)
  if ([...types].every((t) => FILLED_SHAPE_TYPES.has(t))) {
    return { palette: SHAPE_COLORS, colorKey: 'fillColor' as const, isShape: true, isStrokeOnly: false }
  }

  return null
}

export function Toolbar() {
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const chatPanelOpen = useUiStore((s) => s.chatPanelOpen)
  const setChatPanelOpen = useUiStore((s) => s.setChatPanelOpen)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const objects = useBoardStore((s) => s.objects)
  const updateObject = useBoardStore((s) => s.updateObject)
  const deleteSelectedObjects = useBoardStore((s) => s.deleteSelectedObjects)
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDuplicate() {
    const newObjects = duplicateSelected(getValidUserId())
    newObjects.forEach((obj) => insertObject(obj))
    trackBatchCreate(newObjects)
  }

  function handleExport() {
    const { objects: objs } = useBoardStore.getState()
    exportBoardJson(objs, 'board')
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { boardId } = useBoardStore.getState()
        if (!boardId) return
        const newObjects = parseBoardJson(reader.result as string, boardId, getValidUserId())
        const { objects: existing } = useBoardStore.getState()
        useBoardStore.getState().setObjects([...existing, ...newObjects])
        newObjects.forEach((obj) => insertObject(obj))
        trackBatchCreate(newObjects)
      } catch (err) {
        alert(`Import failed: ${(err as Error).message}`)
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }

  const colorInfo = getMultiSelectColorInfo(selectedIds, objects)

  function handleColorChange(color: string) {
    if (!colorInfo) return
    const updated_at = new Date().toISOString()
    const selectedObjs = objects.filter((o) => selectedIds.includes(o.id))
    const undoPairs: Array<{ before: BoardObject; after: BoardObject }> = []
    for (const obj of selectedObjs) {
      let properties: Record<string, unknown>
      if (colorInfo.isStrokeOnly) {
        properties = { ...obj.properties, strokeColor: color }
      } else if (colorInfo.isShape) {
        properties = { ...obj.properties, fillColor: color }
      } else {
        properties = { ...obj.properties, color }
      }
      const after = { ...obj, properties, updated_at }
      undoPairs.push({ before: { ...obj }, after })
      updateObject(obj.id, { properties, updated_at })
      patchObject(obj.id, { properties, updated_at })
    }
    trackBatchUpdate(undoPairs)
  }

  // Determine the "active" color — show as active if all share the same color
  const activeColor = (() => {
    if (!colorInfo) return undefined
    const selectedObjs = objects.filter((o) => selectedIds.includes(o.id))
    const colors = selectedObjs.map((o) => o.properties[colorInfo.colorKey] as string)
    return colors.every((c) => c === colors[0]) ? colors[0] : undefined
  })()

  return (
    <nav className="flex items-center gap-2 px-4 py-2 border-b border-gray-200" aria-label="Canvas tools">
      <button
        onClick={() => setTool('select')}
        title="Select"
        aria-label="Select tool"
        aria-pressed={tool === 'select'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'select' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
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
        title="Hand / Pan (Space)"
        aria-label="Hand (pan) tool"
        aria-pressed={tool === 'hand'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'hand' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
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
        title="Sticky Note"
        aria-label="Sticky note tool"
        aria-pressed={tool === 'sticky_note'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'sticky_note' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
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
        title="Rectangle"
        aria-label="Rectangle tool"
        aria-pressed={tool === 'rectangle'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'rectangle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
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
        title="Circle"
        aria-label="Circle tool"
        aria-pressed={tool === 'circle'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'circle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
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
        onClick={() => setTool('line')}
        title="Line"
        aria-label="Line tool"
        aria-pressed={tool === 'line'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'line' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="inline-block mr-1 -mt-0.5"
        >
          <line
            x1="2"
            y1="14"
            x2="14"
            y2="2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Line
      </button>
      <button
        onClick={() => setTool('connector')}
        title="Connector"
        aria-label="Connector tool"
        aria-pressed={tool === 'connector'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'connector' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="inline-block mr-1 -mt-0.5"
        >
          <path
            d="M3 13L13 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M13 3L9 3M13 3L13 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Connector
      </button>
      <button
        onClick={() => setTool('frame')}
        title="Frame"
        aria-label="Frame tool"
        aria-pressed={tool === 'frame'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'frame' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="inline-block mr-1 -mt-0.5"
        >
          <rect
            x="2"
            y="4"
            width="12"
            height="10"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeDasharray="3 2"
            fill="none"
          />
          <line x1="3" y1="2.5" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Frame
      </button>
      <button
        onClick={() => setTool('text')}
        title="Text"
        aria-label="Text tool"
        aria-pressed={tool === 'text'}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
          tool === 'text' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
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
        <div className="flex items-center gap-1">
          <div className="w-px h-6 bg-gray-300 mx-1" role="separator" />
          <button
            title="Delete (Del)"
            aria-label="Delete selected"
            onClick={() => {
              const { selectedIds: ids, objects: objs } = useBoardStore.getState()
              const deletedObjs = objs.filter((o) => ids.includes(o.id))
              trackDelete(deletedObjs)
              const deletedIds = deleteSelectedObjects()
              deletedIds.forEach((id) => deleteObject(id))
            }}
            className="flex items-center justify-center px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-red-100 text-red-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
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
            aria-label="Duplicate selected (Ctrl+D)"
            onClick={handleDuplicate}
            className="flex items-center justify-center px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-gray-100"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <rect x="4" y="4" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 3V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      )}

      {colorInfo && (
        <>
          <div className="w-px h-6 bg-gray-300 mx-1" role="separator" />
          {colorInfo.palette.map((c) => (
            <button
              key={c.value}
              title={c.name}
              aria-label={`${c.name} color${activeColor === c.value ? ' (selected)' : ''}`}
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

      <div className="ml-auto flex items-center">
        <div className="w-px h-6 bg-gray-300 mx-1" role="separator" />
        <button
          title="Export board as JSON"
          aria-label="Export board as JSON"
          onClick={handleExport}
          className="px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-gray-100"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 10v3h10v-3M8 2v8m-3-3l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          title="Import board from JSON"
          aria-label="Import board from JSON"
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1.5 rounded text-sm cursor-pointer transition-colors hover:bg-gray-100"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 10v3h10v-3M8 10V2m-3 3l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <div className="w-px h-6 bg-gray-300 mx-1" role="separator" />
        <button
          title="AI Assistant"
          aria-label="AI Assistant"
          aria-pressed={chatPanelOpen}
          onClick={() => setChatPanelOpen(!chatPanelOpen)}
          className={`px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
            chatPanelOpen ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="inline-block mr-1 -mt-0.5"
          >
            <path
              d="M8 1l1.5 3.5L13 6l-3 2.5L11 12l-3-2-3 2 1-3.5L3 6l3.5-1.5z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          AI
        </button>
      </div>
    </nav>
  )
}
