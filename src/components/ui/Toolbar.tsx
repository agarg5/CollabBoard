import { useBoardStore } from '../../store/boardStore'
import { useUiStore } from '../../store/uiStore'
import { patchObject } from '../../lib/boardSync'

const COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Pink', value: '#fda4af' },
  { name: 'Blue', value: '#93c5fd' },
  { name: 'Green', value: '#86efac' },
  { name: 'Purple', value: '#c4b5fd' },
]

export function Toolbar() {
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const selectedObj = useBoardStore((s) =>
    s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : null,
  )
  const updateObject = useBoardStore((s) => s.updateObject)
  const showColors = selectedObj?.type === 'sticky_note'

  function handleColorChange(color: string) {
    if (!selectedObj) return
    const updated_at = new Date().toISOString()
    const properties = { ...selectedObj.properties, color }
    updateObject(selectedObj.id, { properties, updated_at })
    patchObject(selectedObj.id, { properties })
  }

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

      {showColors && (
        <>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          {COLORS.map((c) => (
            <button
              key={c.value}
              title={c.name}
              onClick={() => handleColorChange(c.value)}
              className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${
                (selectedObj?.properties.color as string) === c.value
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
