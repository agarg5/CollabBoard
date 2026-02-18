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
  rotation: number
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
  /** Local-only timestamp for staleness detection (not broadcast) */
  _lastSeen?: number
}

export interface PresenceUser {
  user_id: string
  user_name: string
  color: string
  online_at: string
}

export interface AIToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AIResponse {
  message: string
  toolCalls: AIToolCall[]
  simulatedResults?: string[]
}
