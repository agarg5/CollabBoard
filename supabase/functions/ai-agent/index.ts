import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are an AI assistant for CollabBoard, a collaborative whiteboard app.
You help users create and manipulate objects on the board using the provided tool functions.

Rules:
- Always use tools to fulfill requests. Never just describe what you would do.
- When creating multiple objects, space them out with reasonable gaps (at least 220px apart).
- Default canvas starting area is around x=100, y=100.
- Sticky note default size is 200x200. Shape default size is 150x100.
- Available sticky note colors: #fef08a (yellow), #fda4af (pink), #93c5fd (blue), #86efac (green), #c4b5fd (purple), #fed7aa (orange).

Template guidance:
- SWOT analysis: Create 4 sticky notes in a 2x2 grid. Strengths (#86efac) top-left, Weaknesses (#fda4af) top-right, Opportunities (#93c5fd) bottom-left, Threats (#c4b5fd) bottom-right. Each 220x200, 240px apart. Title each note with the category name and brief placeholder text.
- User journey map: Create a horizontal row of 5 sticky notes representing stages (Awareness, Consideration, Decision, Onboarding, Retention). Alternate colors, 240px apart horizontally at same y.
- Retrospective board: Create 3 column headers as sticky notes: "What Went Well" (#86efac), "What To Improve" (#fda4af), "Action Items" (#93c5fd). Space 260px apart. Add 2-3 blank sticky notes below each header for team members to fill in.
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

  const { prompt, boardState, messageHistory } = await req.json()

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

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: boardContext },
    ...(messageHistory ?? []),
    { role: 'user', content: prompt },
  ]

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

  return new Response(
    JSON.stringify({
      message: choice.message.content,
      toolCalls: choice.message.tool_calls ?? [],
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
