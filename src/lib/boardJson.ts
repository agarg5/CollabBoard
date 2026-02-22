import type { BoardObject, ObjectType } from '../types/board'

const VALID_TYPES: Set<string> = new Set([
  'sticky_note',
  'rectangle',
  'circle',
  'line',
  'connector',
  'frame',
  'text',
])

const MAX_IMPORT_OBJECTS = 5000

interface BoardExport {
  version: 1
  exportedAt: string
  objects: BoardObject[]
}

/** Export board objects as a JSON file download. */
export function exportBoardJson(objects: BoardObject[], boardName: string) {
  const payload: BoardExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    objects,
  }
  const safeName = (boardName || 'board').replace(/[^a-zA-Z0-9_-]/g, '_')
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}-export.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Parse and validate a JSON file, returning board objects ready to insert. */
export function parseBoardJson(
  json: string,
  boardId: string,
  userId: string | null,
  existingMaxZ: number,
): BoardObject[] {
  const data = JSON.parse(json) as unknown

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON: expected an object')
  }

  const record = data as Record<string, unknown>
  const rawObjects = record.version ? (record.objects as unknown[]) : (data as unknown[])

  if (!Array.isArray(rawObjects)) {
    throw new Error('Invalid format: expected an array of objects or { version, objects }')
  }

  if (rawObjects.length > MAX_IMPORT_OBJECTS) {
    throw new Error(`Import limited to ${MAX_IMPORT_OBJECTS} objects (got ${rawObjects.length})`)
  }

  const baseZ = existingMaxZ + 1
  const now = new Date().toISOString()

  return rawObjects.map((item, i) => {
    const obj = item as Record<string, unknown>

    if (!obj.type || !VALID_TYPES.has(obj.type as string)) {
      throw new Error(`Object ${i}: invalid or missing type "${obj.type}"`)
    }
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') {
      throw new Error(`Object ${i}: missing x/y coordinates`)
    }

    // Validate properties is a plain object
    const props = obj.properties
    if (props != null && (typeof props !== 'object' || Array.isArray(props))) {
      throw new Error(`Object ${i}: properties must be an object`)
    }

    // Validate width/height are positive numbers if provided
    const width = obj.width != null ? obj.width : 150
    const height = obj.height != null ? obj.height : 150
    if (typeof width !== 'number' || width <= 0) {
      throw new Error(`Object ${i}: invalid width`)
    }
    if (typeof height !== 'number' || height <= 0) {
      throw new Error(`Object ${i}: invalid height`)
    }

    return {
      id: crypto.randomUUID(),
      board_id: boardId,
      type: obj.type as ObjectType,
      properties: (props as Record<string, unknown>) ?? {},
      x: obj.x as number,
      y: obj.y as number,
      width,
      height,
      z_index: baseZ + i,
      rotation: (obj.rotation as number) || 0,
      created_by: userId,
      updated_at: now,
    }
  })
}
