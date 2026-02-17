# CollabBoard

A real-time collaborative whiteboard application (similar to Miro) with an AI board agent. Multiple users can create sticky notes, shapes, and connectors on an infinite canvas with live multiplayer sync, cursors, and presence.

**Live Demo:** [https://collabboard-ashy.vercel.app/](https://collabboard-ashy.vercel.app/)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase and OpenAI credentials in .env

# Start development server
npm run dev

# Run tests
npm test
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Vite + React + TypeScript | No SSR needed for a canvas app. Fast builds, fast HMR, no unnecessary abstractions |
| **Canvas** | React-Konva (Konva.js) | Declarative React API, built-in event handling, sufficient performance for 500+ objects |
| **State** | Zustand | Lightweight, works outside React (critical for WebSocket callbacks), selector-based re-renders |
| **Backend** | Supabase (Postgres + Realtime + Auth + Edge Functions) | Auth + DB + real-time in one managed platform. No custom server needed |
| **Auth** | Google OAuth via Supabase Auth | One-click sign in, managed sessions, zero password management |
| **AI Agent** | OpenAI GPT-4 with function calling | Mature API, structured output for board manipulation commands |
| **Deploy** | Vercel (frontend) + Supabase (hosted backend) | Zero-config deployment, auto-deploy from GitHub |

## Architecture

### Real-Time Sync Strategy

CollabBoard uses three distinct Supabase Realtime features, each optimized for a different type of data:

| Data | Realtime Feature | Persisted? | Target Latency |
|------|-----------------|------------|----------------|
| **Cursor positions** | **Broadcast** | No (fire-and-forget WebSocket) | <50ms |
| **Object CRUD** (create/move/delete sticky notes, shapes) | **Postgres Changes** | Yes (triggers on DB writes) | <100ms |
| **Who's online** | **Presence** | No (shared state, auto-cleanup on disconnect) | ~1s |

**Why separate them?** Cursor positions change 20+ times per second per user. Writing every cursor move to the database would be wasteful and slow. Broadcast is pure pub/sub — messages go directly between clients via WebSocket with zero DB involvement. Object changes (creating a sticky note, moving it) need persistence so they survive page refreshes, so those go through Postgres.

Each board has a dedicated Realtime channel: `board:{board_id}`

### State Management Flow

Zustand stores are the single source of truth for the canvas. Both local and remote changes flow through them:

```
Local change:  User action → Zustand store (optimistic) → Write to Supabase
Remote change: Supabase Realtime event → Zustand store → React re-renders
```

**Why Zustand over Redux or React Context?**
- **vs React Context**: Context re-renders every consumer when any value changes. With 500 canvas objects and frequent cursor updates, this would kill performance. Zustand supports selectors — components only re-render when their specific data changes.
- **vs Redux**: Same selector benefits, but without the boilerplate (no action types, action creators, reducers, middleware). A Zustand store is ~15 lines of code.
- **Critical feature**: Zustand works outside React components. When a Supabase WebSocket event arrives in a plain callback function, we can call `useBoardStore.getState().addObject(...)` directly. React Context requires being inside a component tree.

### Canvas Rendering

React-Konva renders the infinite canvas with layered architecture:

1. **Background layer** — Grid/dots pattern
2. **Objects layer** — Sticky notes, shapes, frames, connectors, text
3. **Selection layer** — Selection rectangles, transform handles
4. **Cursor layer** — Other users' cursors with name labels

**Why React-Konva?**
- Declarative React components for canvas objects (a sticky note is a `<Rect>` + `<Text>` component)
- Built-in drag, click, hover, and transform events per object
- Sufficient performance for our scale (60 FPS with 500 objects). PixiJS (WebGL) would be faster but is overkill here.

### Database Schema

```sql
boards
├── id (uuid, PK)
├── name (text)
├── created_by (uuid, FK → auth.users)
└── created_at (timestamptz)

board_objects
├── id (uuid, PK)
├── board_id (uuid, FK → boards)
├── type (enum: sticky_note, rectangle, circle, line, connector, frame, text)
├── properties (JSONB) ← flexible per-type data
├── x, y (float)
├── width, height (float)
├── z_index (int)
├── created_by (uuid, FK → auth.users)
└── updated_at (timestamptz)
```

**Why JSONB for properties?** Different object types need different properties (a sticky note has `text` and `color`, a connector has `startId` and `endId`). JSONB gives each type its own shape without creating a sparse table of nullable columns. Common fields (position, dimensions) stay as typed columns for fast queries.

### Conflict Resolution

**Last-write-wins** at the object level using `updated_at` timestamps. If two users drag the same sticky note simultaneously, the last write to reach Supabase wins, and both clients reconcile to that position.

This is acceptable because:
- At 5-10 users on a large canvas, simultaneous edits on the same object are rare
- Users see each other's cursors, so they naturally avoid colliding
- Upgrading to CRDTs (e.g., Yjs) is possible later if needed for text co-editing

### AI Agent

OpenAI GPT-4 with function calling. The AI receives board state and manipulates it through tool functions (`createStickyNote`, `moveObject`, etc.). API calls are proxied through a Supabase Edge Function to keep the API key server-side.

## Project Structure

```
src/
  components/
    canvas/       # Board canvas: Stage, object renderers, cursor layer
    ui/           # Toolbar, panels, presence sidebar
    auth/         # Login screen
  hooks/          # useBoard, usePresence, useAI, useCanvas
  store/          # Zustand stores (boardStore, uiStore)
  lib/            # Supabase client, utilities
  types/          # TypeScript type definitions
  test/           # Test setup
tests/
  e2e/            # Playwright E2E tests
  stress/         # k6 load test scripts
supabase/
  migrations/     # SQL schema migrations
  functions/      # Edge Functions (ai-agent proxy)
```

## Scripts

```bash
npm run dev          # Vite dev server with HMR
npm run build        # TypeScript check + production build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Vitest (unit tests)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests
```

## Performance Targets

- 60 FPS during pan/zoom/object manipulation
- 500+ objects on canvas without performance drops
- <50ms cursor sync latency
- <100ms object sync latency
- <2s AI agent response time
- 5+ concurrent users per board
