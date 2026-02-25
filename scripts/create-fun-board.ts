#!/usr/bin/env node
/**
 * Script to create a fun board with various objects
 * Usage: npm run create-fun-board
 * 
 * Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set in your .env file
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env')

let supabaseUrl: string | undefined
let supabaseAnonKey: string | undefined

try {
  const envContent = readFileSync(envPath, 'utf-8')
  const envLines = envContent.split('\n')
  
  for (const line of envLines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=').trim()
      
      if (key === 'VITE_SUPABASE_URL') {
        supabaseUrl = value
      } else if (key === 'VITE_SUPABASE_ANON_KEY') {
        supabaseAnonKey = value
      }
    }
  }
} catch (error) {
  console.warn('Could not read .env file, trying process.env...')
}

// Fallback to process.env
supabaseUrl = supabaseUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
supabaseAnonKey = supabaseAnonKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface BoardObject {
  id: string
  board_id: string
  type: 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'connector' | 'frame' | 'text'
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

async function createFunBoard() {
  console.log('🎨 Creating a fun board...')

  // Create the board
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .insert({ name: 'Fun Board 🎉' })
    .select()
    .single()

  if (boardError) {
    console.error('Error creating board:', boardError)
    process.exit(1)
  }

  console.log(`✅ Created board: ${board.name} (${board.id})`)

  const boardId = board.id
  const now = new Date().toISOString()
  const objects: BoardObject[] = []
  let zIndex = 1

  // Helper to create objects
  const createObject = (
    type: BoardObject['type'],
    x: number,
    y: number,
    width: number,
    height: number,
    properties: Record<string, unknown>,
    rotation = 0,
  ) => {
    objects.push({
      id: randomUUID(),
      board_id: boardId,
      type,
      properties,
      x,
      y,
      width,
      height,
      z_index: zIndex++,
      rotation,
      created_by: null,
      updated_at: now,
    })
  }

  // Create a fun welcome frame
  createObject('frame', 100, 100, 500, 400, {
    label: 'Welcome to Fun Board! 🎉',
    strokeColor: '#8b5cf6',
  })

  // Colorful sticky notes with fun messages
  const stickyNotes = [
    { x: 150, y: 180, text: 'Hello! 👋', color: '#fef08a' },
    { x: 300, y: 180, text: 'Have fun! 🎨', color: '#fda4af' },
    { x: 450, y: 180, text: 'Be creative! ✨', color: '#93c5fd' },
    { x: 150, y: 320, text: 'Collaborate! 👥', color: '#86efac' },
    { x: 300, y: 320, text: 'Dream big! 🌟', color: '#fbbf24' },
    { x: 450, y: 320, text: 'Stay awesome! 💪', color: '#c084fc' },
  ]

  // Store sticky note IDs for connectors
  const stickyNoteIds: string[] = []
  
  // Create sticky notes and store their IDs
  stickyNotes.forEach((note) => {
    const objId = randomUUID()
    stickyNoteIds.push(objId)
    createObject('sticky_note', note.x, note.y, 120, 120, {
      text: note.text,
      color: note.color,
    })
    // Update the last object's ID
    objects[objects.length - 1].id = objId
  })

  // Colorful shapes
  createObject('circle', 700, 200, 100, 100, {
    fillColor: '#ec4899',
    strokeColor: '#1e293b',
    strokeWidth: 3,
  })

  createObject('rectangle', 700, 350, 150, 100, {
    fillColor: '#3b82f6',
    strokeColor: '#1e293b',
    strokeWidth: 3,
  })

  createObject('circle', 900, 200, 80, 80, {
    fillColor: '#10b981',
    strokeColor: '#1e293b',
    strokeWidth: 3,
  })

  createObject('rectangle', 900, 350, 120, 120, {
    fillColor: '#f59e0b',
    strokeColor: '#1e293b',
    strokeWidth: 3,
  }, 15)

  // Text elements
  createObject('text', 200, 550, 300, 40, {
    text: 'Made with ❤️ for you!',
    color: '#1e293b',
    fontSize: 24,
    fontWeight: 'bold',
  })

  createObject('text', 700, 550, 250, 32, {
    text: 'Enjoy exploring! 🚀',
    color: '#8b5cf6',
    fontSize: 20,
  })

  // Connectors between some sticky notes (after they're created)
  if (stickyNoteIds.length >= 3) {
    // Get center positions for connector endpoints
    const note1Center = { x: stickyNotes[0].x + 60, y: stickyNotes[0].y + 60 }
    const note2Center = { x: stickyNotes[1].x + 60, y: stickyNotes[1].y + 60 }
    const note3Center = { x: stickyNotes[2].x + 60, y: stickyNotes[2].y + 60 }
    
    createObject('connector', note1Center.x, note1Center.y, note2Center.x - note1Center.x, note2Center.y - note1Center.y, {
      strokeColor: '#64748b',
      strokeWidth: 2,
      startObjectId: stickyNoteIds[0],
      endObjectId: stickyNoteIds[1],
    })
    
    createObject('connector', note2Center.x, note2Center.y, note3Center.x - note2Center.x, note3Center.y - note2Center.y, {
      strokeColor: '#64748b',
      strokeWidth: 2,
      startObjectId: stickyNoteIds[1],
      endObjectId: stickyNoteIds[2],
    })
  }

  // Decorative lines
  createObject('line', 650, 150, 200, 0, {
    strokeColor: '#cbd5e1',
    strokeWidth: 2,
  })

  createObject('line', 650, 500, 200, 0, {
    strokeColor: '#cbd5e1',
    strokeWidth: 2,
  })

  // Insert all objects
  console.log(`📦 Inserting ${objects.length} objects...`)

  // Insert in batches to avoid overwhelming the database
  const batchSize = 10
  for (let i = 0; i < objects.length; i += batchSize) {
    const batch = objects.slice(i, i + batchSize)
    const { error } = await supabase.from('board_objects').insert(batch)

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
      process.exit(1)
    }

    console.log(`  ✅ Inserted batch ${i / batchSize + 1} (${batch.length} objects)`)
  }

  console.log(`\n🎉 Successfully created fun board with ${objects.length} objects!`)
  console.log(`\nBoard ID: ${boardId}`)
  console.log(`You can now view it in your CollabBoard app!`)
}

createFunBoard().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
