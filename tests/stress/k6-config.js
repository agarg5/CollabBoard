/**
 * Shared k6 configuration for CollabBoard stress tests.
 *
 * Environment variables (pass via -e flag or .env):
 *   SUPABASE_URL      — e.g. https://xyz.supabase.co
 *   SUPABASE_ANON_KEY — the anon/public key
 *   BOARD_ID          — UUID of an existing board to test against
 */

export const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321'
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''
export const BOARD_ID =
  __ENV.BOARD_ID || '00000000-0000-0000-0000-000000000000'

/** REST base URL for Supabase PostgREST */
export const REST_URL = `${SUPABASE_URL}/rest/v1`

/** Realtime WebSocket URL (Phoenix protocol) */
export const WS_URL = SUPABASE_URL.replace('https://', 'wss://').replace(
  'http://',
  'ws://',
) + `/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`

/** Standard headers for REST calls */
export const REST_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Prefer: 'return=minimal',
}

/**
 * Generate a UUID v4 (simplified, not cryptographically secure — fine for k6).
 */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Create a sticky note object payload for the given board.
 */
export function makeStickyNote(boardId, index) {
  return {
    id: uuid(),
    board_id: boardId,
    type: 'sticky_note',
    properties: { text: `k6 Note ${index}`, color: '#fef08a' },
    x: 100 + (index % 10) * 220,
    y: 100 + Math.floor(index / 10) * 220,
    width: 200,
    height: 200,
    z_index: index + 1,
    created_by: null,
    updated_at: new Date().toISOString(),
  }
}
