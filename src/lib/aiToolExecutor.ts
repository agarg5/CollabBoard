import { useBoardStore } from '../store/boardStore'
import { useAuthStore } from '../store/authStore'
import { insertObject, patchObject, deleteObject } from './boardSync'
import type { BoardObject } from '../types/board'

export interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

export async function executeToolCalls(
  toolCalls: ToolCall[],
  boardId: string,
): Promise<void> {
  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments)
    const handler = HANDLERS[call.function.name]
    if (handler) {
      await handler(args, boardId)
    }
  }
}

function getNextZIndex(): number {
  const { objects } = useBoardStore.getState()
  return objects.reduce((max, o) => Math.max(max, o.z_index), 0) + 1
}

function getUserId(): string | null {
  const rawId = useAuthStore.getState().user?.id
  return rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : null
}

function makeObject(
  boardId: string,
  type: BoardObject['type'],
  args: Record<string, unknown>,
  properties: Record<string, unknown>,
): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: boardId,
    type,
    properties,
    x: (args.x as number) ?? 0,
    y: (args.y as number) ?? 0,
    width: (args.width as number) ?? 200,
    height: (args.height as number) ?? 200,
    z_index: getNextZIndex(),
    created_by: getUserId(),
    updated_at: new Date().toISOString(),
  }
}

async function createAndInsert(obj: BoardObject): Promise<void> {
  useBoardStore.getState().addObject(obj)
  await insertObject(obj)
}

type Handler = (args: Record<string, unknown>, boardId: string) => Promise<void>

const HANDLERS: Record<string, Handler> = {
  createStickyNote: async (args, boardId) => {
    const obj = makeObject(boardId, 'sticky_note', args, {
      text: (args.text as string) || '',
      color: (args.color as string) || '#fef08a',
    })
    obj.width = (args.width as number) || 200
    obj.height = (args.height as number) || 200
    await createAndInsert(obj)
  },

  createShape: async (args, boardId) => {
    const shapeType = args.shapeType as 'rectangle' | 'circle'
    const obj = makeObject(boardId, shapeType, args, {
      fillColor: (args.fillColor as string) || '#3b82f6',
      strokeColor: (args.strokeColor as string) || '#1e293b',
      strokeWidth: 2,
    })
    obj.width = (args.width as number) || 150
    obj.height = (args.height as number) || 100
    await createAndInsert(obj)
  },

  createFrame: async (args, boardId) => {
    const obj = makeObject(boardId, 'frame', args, {
      label: (args.label as string) || '',
    })
    obj.width = (args.width as number) || 400
    obj.height = (args.height as number) || 300
    await createAndInsert(obj)
  },

  createConnector: async (args, boardId) => {
    const obj = makeObject(boardId, 'connector', args, {
      fromX: args.fromX as number,
      fromY: args.fromY as number,
      toX: args.toX as number,
      toY: args.toY as number,
      color: (args.color as string) || '#1e293b',
    })
    obj.x = args.fromX as number
    obj.y = args.fromY as number
    obj.width = Math.abs((args.toX as number) - (args.fromX as number)) || 1
    obj.height = Math.abs((args.toY as number) - (args.fromY as number)) || 1
    await createAndInsert(obj)
  },

  moveObject: async (args) => {
    const id = args.objectId as string
    const changes: Partial<BoardObject> = {
      x: args.x as number,
      y: args.y as number,
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
  },

  resizeObject: async (args) => {
    const id = args.objectId as string
    const changes: Partial<BoardObject> = {
      width: args.width as number,
      height: args.height as number,
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
  },

  updateText: async (args) => {
    const id = args.objectId as string
    const obj = useBoardStore.getState().objects.find((o) => o.id === id)
    if (!obj) return
    const properties = { ...obj.properties, text: args.text as string }
    const changes: Partial<BoardObject> = {
      properties,
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
  },

  changeColor: async (args) => {
    const id = args.objectId as string
    const obj = useBoardStore.getState().objects.find((o) => o.id === id)
    if (!obj) return
    const colorKey =
      obj.type === 'sticky_note' || obj.type === 'text' ? 'color' : 'fillColor'
    const properties = { ...obj.properties, [colorKey]: args.color as string }
    const changes: Partial<BoardObject> = {
      properties,
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
  },

  deleteObject: async (args) => {
    const id = args.objectId as string
    useBoardStore.getState().removeObject(id)
    await deleteObject(id)
  },

  getBoardState: async () => {
    // No-op: board state is sent with each request already
  },
}
