export type ObjectType =
  | 'sticky_note'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'connector'
  | 'frame'
  | 'text'

export interface BoardObject {
  id: string
  board_id: string
  type: ObjectType
  properties: Record<string, unknown>
  x: number
  y: number
  width: number
  height: number
  z_index: number
  created_by: string | null
  updated_at: string
}

export interface Board {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface CursorPosition {
  user_id: string
  user_name: string
  x: number
  y: number
  color: string
}
