import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_TOOL_ITERATIONS = 5

const SYSTEM_PROMPT = `You are an AI assistant for CollabBoard, a collaborative whiteboard app.
You help users create and manipulate objects on the board using the provided tool functions.

Rules:
- Always use tools to fulfill requests. Never just describe what you would do.
- When creating multiple objects, space them out with reasonable gaps (at least 220px apart).
- Default canvas starting area is around x=100, y=100.
- Sticky note default size is 200x200. Shape default size is 150x100.
- Available sticky note colors: #fef08a (yellow), #fda4af (pink), #93c5fd (blue), #86efac (green), #c4b5fd (purple), #fed7aa (orange).

Multi-step guidance:
- When asked to rearrange, organize, or lay out existing objects, FIRST call getBoardState to see what exists, THEN plan and execute your actions.
- When asked to "arrange in a grid", calculate positions based on object count. Use ~240px column spacing and ~240px row spacing.
- When asked to "space evenly", compute total span and divide equally.
- You can reference objects created in earlier tool calls by their returned IDs.

Template guidance:
- SWOT analysis: First create a frame labeled "SWOT Analysis" (x=60, y=30, width=540, height=510). Then create 4 sticky notes inside: Strengths (#86efac) at (80,70), Weaknesses (#fda4af) at (310,70), Opportunities (#93c5fd) at (80,300), Threats (#c4b5fd) at (310,300). Each 220x200. Title each note with the category name and brief placeholder text.
- User journey map: First create a frame labeled "User Journey" (x=60, y=30, width=1260, height=280). Then create 5 sticky notes inside at y=70: Awareness (#fef08a) at (80,70), Consideration (#93c5fd) at (320,70), Decision (#86efac) at (560,70), Onboarding (#fed7aa) at (800,70), Retention (#c4b5fd) at (1040,70). Each 200x200.
- Retrospective board: Create 3 frames side by side: "What Went Well" (x=60, y=30, w=280, h=520), "What To Improve" (x=360, y=30, w=280, h=520), "Action Items" (x=660, y=30, w=280, h=520). Inside each frame, create a header sticky note and 2-3 blank sticky notes below. Use #86efac for well, #fda4af for improve, #93c5fd for actions.
- Pros and cons: Create two columns of sticky notes. "Pros" (#86efac) on the left, "Cons" (#fda4af) on the right.
- Kanban board: Create columns "To Do", "In Progress", "Done" as headers with empty cards below each.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'createStickyNote',
      description: 'Create a sticky note on the board',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text content of the sticky note' },
          x: { type: 'number', description: 'X position on canvas' },
          y: { type: 'number', description: 'Y position on canvas' },
          color: {
            type: 'string',
            description:
              'Background color hex. Options: #fef08a (yellow), #fda4af (pink), #93c5fd (blue), #86efac (green), #c4b5fd (purple), #fed7aa (orange). Default: #fef08a',
          },
          width: { type: 'number', description: 'Width in pixels (default 200)' },
          height: { type: 'number', description: 'Height in pixels (default 200)' },
        },
        required: ['text', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createShape',
      description: 'Create a rectangle or circle shape on the board',
      parameters: {
        type: 'object',
        properties: {
          shapeType: {
            type: 'string',
            enum: ['rectangle', 'circle'],
            description: 'Type of shape to create',
          },
          x: { type: 'number', description: 'X position on canvas' },
          y: { type: 'number', description: 'Y position on canvas' },
          width: { type: 'number', description: 'Width in pixels (default 150)' },
          height: { type: 'number', description: 'Height in pixels (default 100)' },
          fillColor: { type: 'string', description: 'Fill color hex (default #3b82f6)' },
          strokeColor: { type: 'string', description: 'Stroke color hex (default #1e293b)' },
        },
        required: ['shapeType', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createFrame',
      description: 'Create a frame (grouping container) on the board',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Frame label text' },
          x: { type: 'number', description: 'X position on canvas' },
          y: { type: 'number', description: 'Y position on canvas' },
          width: { type: 'number', description: 'Width in pixels (default 400)' },
          height: { type: 'number', description: 'Height in pixels (default 300)' },
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createConnector',
      description: 'Create a line/connector between two points on the board',
      parameters: {
        type: 'object',
        properties: {
          fromX: { type: 'number', description: 'Starting X position' },
          fromY: { type: 'number', description: 'Starting Y position' },
          toX: { type: 'number', description: 'Ending X position' },
          toY: { type: 'number', description: 'Ending Y position' },
          color: { type: 'string', description: 'Line color hex (default #1e293b)' },
        },
        required: ['fromX', 'fromY', 'toX', 'toY'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'moveObject',
      description: 'Move an existing object to a new position',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'UUID of the object to move' },
          x: { type: 'number', description: 'New X position' },
          y: { type: 'number', description: 'New Y position' },
        },
        required: ['objectId', 'x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resizeObject',
      description: 'Resize an existing object',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'UUID of the object to resize' },
          width: { type: 'number', description: 'New width in pixels' },
          height: { type: 'number', description: 'New height in pixels' },
        },
        required: ['objectId', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateText',
      description: 'Update the text content of a sticky note or text object',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'UUID of the object to update' },
          text: { type: 'string', description: 'New text content' },
        },
        required: ['objectId', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'changeColor',
      description: 'Change the color of an object',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'UUID of the object to recolor' },
          color: { type: 'string', description: 'New color hex value' },
        },
        required: ['objectId', 'color'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deleteObject',
      description: 'Delete an object from the board',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'UUID of the object to delete' },
        },
        required: ['objectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getBoardState',
      description:
        'Get the current state of all objects on the board. Use this when you need to examine what exists before making changes.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify JWT — reject unauthenticated requests
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { prompt, boardState, messageHistory } = body as {
    prompt?: string
    boardState?: unknown[]
    messageHistory?: Array<{ role: string; content: string }>
  }

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const boardContext =
    boardState?.length > 0
      ? `Current board has ${boardState.length} objects:\n${JSON.stringify(boardState)}`
      : 'The board is currently empty.'

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: boardContext },
    ...(messageHistory ?? []),
    { role: 'user', content: prompt },
  ]

  // Track all tool calls and simulated results across iterations
  const allToolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> = []
  const allSimulatedResults: string[] = []
  // Track objects "created" during simulation so getBoardState can include them
  const simulatedObjects: unknown[] = []
  let fakeIdCounter = 0

  function simulateToolResult(
    toolCall: { id: string; function: { name: string; arguments: string } },
  ): string {
    const name = toolCall.function.name
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(toolCall.function.arguments) } catch { /* use empty */ }

    if (name === 'getBoardState') {
      const combined = [...(boardState ?? []), ...simulatedObjects]
      return JSON.stringify(combined)
    }

    if (name.startsWith('create')) {
      const fakeId = `__simulated_${fakeIdCounter++}`
      const typeMap: Record<string, string> = {
        createStickyNote: 'sticky_note',
        createShape: (args.shapeType as string) ?? 'rectangle',
        createFrame: 'frame',
        createConnector: 'connector',
      }
      simulatedObjects.push({ id: fakeId, type: typeMap[name] ?? name.replace('create', '').toLowerCase(), ...args })
      return JSON.stringify({ created: fakeId })
    }

    // Manipulation tools
    return JSON.stringify({ success: true })
  }

  let finalMessage: string | null = null

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('OpenAI API error:', response.status, errorBody)
      return new Response(JSON.stringify({ error: 'AI request failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const choice = data.choices?.[0]

    if (!choice) {
      return new Response(JSON.stringify({ error: 'No response from AI' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const assistantMessage = choice.message
    messages.push(assistantMessage)

    const toolCalls = assistantMessage.tool_calls as
      | Array<{ id: string; type: string; function: { name: string; arguments: string } }>
      | undefined

    // No tool calls = final text response, we're done
    if (!toolCalls || toolCalls.length === 0) {
      finalMessage = assistantMessage.content
      break
    }

    // Process tool calls: collect them and simulate results
    for (const tc of toolCalls) {
      allToolCalls.push(tc)
      const simResult = simulateToolResult(tc)
      allSimulatedResults.push(simResult)

      // Feed simulated result back as tool message for next iteration
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: simResult,
      })
    }
  }

  // If we exhausted iterations without a final text response, use the last content or a default
  if (finalMessage === null) {
    finalMessage = 'Done! I executed the requested actions on the board.'
  }

  return new Response(
    JSON.stringify({
      message: finalMessage,
      toolCalls: allToolCalls,
      simulatedResults: allSimulatedResults,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
