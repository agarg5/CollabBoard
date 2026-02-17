import { useBoardStore } from '../store/boardStore'
import { insertObject, patchObject, deleteObject } from './boardSync'
import type { BoardObject, AIToolCall } from '../types/board'

// TODO: DB sync calls (insertObject/patchObject/deleteObject) can reject but
// we don't roll back the optimistic store update. Acceptable for MVP (last-write-wins)
// but should add rollback or retry logic before scaling.

interface ExecutionContext {
  boardId: string
  userId: string
}

interface ToolResult {
  id: string
  result: unknown
}

function requireArgs(
  args: Record<string, unknown>,
  required: Record<string, 'number' | 'string'>,
): string | null {
  for (const [key, type] of Object.entries(required)) {
    if (typeof args[key] !== type) return `missing or invalid required arg: ${key}`
  }
  return null
}

function nextZIndex(): number {
  const objects = useBoardStore.getState().objects
  return objects.reduce((max, o) => Math.max(max, o.z_index), 0) + 1
}

function buildObject(
  overrides: Partial<BoardObject> & Pick<BoardObject, 'type' | 'x' | 'y' | 'width' | 'height' | 'properties'>,
  ctx: ExecutionContext,
): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: ctx.boardId,
    z_index: nextZIndex(),
    created_by: ctx.userId,
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

type ToolHandler = (args: Record<string, unknown>, ctx: ExecutionContext) => Promise<unknown>

const toolHandlers: Record<string, ToolHandler> = {
  async createStickyNote(args, ctx) {
    const err = requireArgs(args, { text: 'string', x: 'number', y: 'number' })
    if (err) return { error: err }
    const obj = buildObject(
      {
        type: 'sticky_note',
        x: args.x as number,
        y: args.y as number,
        width: (args.width as number) ?? 200,
        height: (args.height as number) ?? 200,
        properties: {
          text: args.text as string,
          color: (args.color as string) ?? '#fef08a',
        },
      },
      ctx,
    )
    useBoardStore.getState().addObject(obj)
    await insertObject(obj)
    return { created: obj.id }
  },

  async createShape(args, ctx) {
    const err = requireArgs(args, { shapeType: 'string', x: 'number', y: 'number' })
    if (err) return { error: err }
    const shapeType = args.shapeType as 'rectangle' | 'circle'
    const obj = buildObject(
      {
        type: shapeType,
        x: args.x as number,
        y: args.y as number,
        width: (args.width as number) ?? 150,
        height: (args.height as number) ?? 100,
        properties: {
          fillColor: (args.fillColor as string) ?? '#3b82f6',
          strokeColor: (args.strokeColor as string) ?? '#1e293b',
        },
      },
      ctx,
    )
    useBoardStore.getState().addObject(obj)
    await insertObject(obj)
    return { created: obj.id }
  },

  async createFrame(args, ctx) {
    const err = requireArgs(args, { x: 'number', y: 'number' })
    if (err) return { error: err }
    const obj = buildObject(
      {
        type: 'frame',
        x: args.x as number,
        y: args.y as number,
        width: (args.width as number) ?? 400,
        height: (args.height as number) ?? 300,
        properties: { label: (args.label as string) ?? '' },
      },
      ctx,
    )
    useBoardStore.getState().addObject(obj)
    await insertObject(obj)
    return { created: obj.id }
  },

  async createConnector(args, ctx) {
    const err = requireArgs(args, { fromX: 'number', fromY: 'number', toX: 'number', toY: 'number' })
    if (err) return { error: err }
    const fromX = args.fromX as number
    const fromY = args.fromY as number
    const toX = args.toX as number
    const toY = args.toY as number
    const obj = buildObject(
      {
        type: 'connector',
        x: fromX,
        y: fromY,
        width: Math.abs(toX - fromX) || 1,
        height: Math.abs(toY - fromY) || 1,
        properties: {
          fromX,
          fromY,
          toX,
          toY,
          color: (args.color as string) ?? '#1e293b',
        },
      },
      ctx,
    )
    useBoardStore.getState().addObject(obj)
    await insertObject(obj)
    return { created: obj.id }
  },

  async moveObject(args) {
    const err = requireArgs(args, { objectId: 'string', x: 'number', y: 'number' })
    if (err) return { error: err }
    const id = args.objectId as string
    const obj = useBoardStore.getState().objects.find((o) => o.id === id)
    if (!obj) return { error: 'Object not found' }
    const changes: Partial<BoardObject> = {
      x: args.x as number,
      y: args.y as number,
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
    return { moved: id }
  },

  async resizeObject(args) {
    const err = requireArgs(args, { objectId: 'string', width: 'number', height: 'number' })
    if (err) return { error: err }
    const id = args.objectId as string
    const obj = useBoardStore.getState().objects.find((o) => o.id === id)
    if (!obj) return { error: 'Object not found' }
    const changes: Partial<BoardObject> = {
      width: args.width as number,
      height: args.height as number,
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
    return { resized: id }
  },

  async updateText(args) {
    const err = requireArgs(args, { objectId: 'string', text: 'string' })
    if (err) return { error: err }
    const id = args.objectId as string
    const obj = useBoardStore.getState().objects.find((o) => o.id === id)
    if (!obj) return { error: 'Object not found' }
    const changes: Partial<BoardObject> = {
      properties: { ...obj.properties, text: args.text as string },
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
    return { updated: id }
  },

  async changeColor(args) {
    const err = requireArgs(args, { objectId: 'string', color: 'string' })
    if (err) return { error: err }
    const id = args.objectId as string
    const obj = useBoardStore.getState().objects.find((o) => o.id === id)
    if (!obj) return { error: 'Object not found' }
    const color = args.color as string
    const colorKeyMap: Record<string, string> = {
      rectangle: 'fillColor',
      circle: 'fillColor',
      sticky_note: 'color',
      connector: 'color',
    }
    const colorKey = colorKeyMap[obj.type]
    if (!colorKey) return { error: `changeColor is not supported for type: ${obj.type}` }
    const changes: Partial<BoardObject> = {
      properties: { ...obj.properties, [colorKey]: color },
      updated_at: new Date().toISOString(),
    }
    useBoardStore.getState().updateObject(id, changes)
    await patchObject(id, changes)
    return { recolored: id }
  },

  async deleteObject(args) {
    const err = requireArgs(args, { objectId: 'string' })
    if (err) return { error: err }
    const id = args.objectId as string
    const obj = useBoardStore.getState().objects.find((o) => o.id === id)
    if (!obj) return { error: 'Object not found' }
    useBoardStore.getState().removeObject(id)
    await deleteObject(id)
    return { deleted: id }
  },

  async getBoardState() {
    return useBoardStore.getState().objects
  },
}

export async function executeToolCall(
  toolCall: AIToolCall,
  context: ExecutionContext,
): Promise<ToolResult> {
  const { name, arguments: rawArgs } = toolCall.function

  let args: Record<string, unknown>
  try {
    args = JSON.parse(rawArgs) as Record<string, unknown>
  } catch {
    return { id: toolCall.id, result: { error: `Invalid arguments JSON for tool: ${name}` } }
  }

  const handler = toolHandlers[name]
  if (!handler) {
    return { id: toolCall.id, result: { error: `Unknown tool: ${name}` } }
  }
  const result = await handler(args, context)
  return { id: toolCall.id, result }
}
