import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { patchObject } from '../../lib/boardSync'

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

export function Toolbar() {
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const selectedObj = useBoardStore((s) =>
    s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : null,
  )
  const updateObject = useBoardStore((s) => s.updateObject)

  const isShape = selectedObj?.type === 'rectangle' || selectedObj?.type === 'circle'
  const showStickyColors = selectedObj?.type === 'sticky_note'
  const showShapeColors = isShape

  function handleColorChange(color: string) {
    if (!selectedObj) return
    const updated_at = new Date().toISOString()
    const properties = isShape
      ? { ...selectedObj.properties, fillColor: color }
      : { ...selectedObj.properties, color }
    updateObject(selectedObj.id, { properties, updated_at })
    patchObject(selectedObj.id, { properties, updated_at })
  }

  const colors = showStickyColors ? STICKY_COLORS : showShapeColors ? SHAPE_COLORS : null
  const activeColor = isShape
    ? (selectedObj?.properties.fillColor as string)
    : (selectedObj?.properties.color as string)

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

      {colors && (
        <>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          {colors.map((c) => (
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
