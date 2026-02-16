# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CollabBoard is a real-time collaborative whiteboard (Miro-like) with an AI board agent. Users can create sticky notes, shapes, connectors, and frames on an infinite canvas, with live multiplayer sync, cursors, and presence.

## Tech Stack

- **Frontend**: Vite + React + TypeScript + React-Konva (canvas rendering) + Zustand (state)
- **Backend**: Supabase (Postgres, Realtime Channels, Auth, Edge Functions)
- **Auth**: Google OAuth via Supabase Auth
- **AI Agent**: OpenAI GPT-4 with function calling, proxied through Supabase Edge Function
- **Deploy**: Vercel (frontend) + Supabase (hosted backend)

## Commands

```bash
# Development
npm run dev              # Start Vite dev server
npm run build            # Production build
npm run preview          # Preview production build

# Supabase
npx supabase start       # Local Supabase (requires Docker)
npx supabase db push     # Push migrations to remote
npx supabase functions serve  # Local Edge Functions

# Testing
npm run test             # Vitest (unit tests)
npm run test:watch       # Vitest in watch mode
npm run test:e2e         # Playwright E2E tests
npm run test:stress      # k6 load tests

# Linting
npm run lint             # ESLint
npm run format           # Prettier
```

## Architecture

### Real-Time Sync Strategy
- **Cursor positions**: Supabase Realtime **Broadcast** (ephemeral, no DB writes, <50ms target)
- **Object CRUD**: Supabase Realtime **Postgres Changes** (persisted, triggers on `board_objects` table, <100ms target)
- **Presence**: Supabase Realtime **Presence** (tracks who's online per board channel)

Each board has a dedicated Realtime channel: `board:{board_id}`

### State Management
Zustand stores hold local canvas state. Supabase subscriptions push remote changes into the store. The flow is:
1. User action -> update Zustand store (optimistic) -> write to Supabase
2. Supabase Realtime event -> update Zustand store (for other clients)

### Canvas Rendering
React-Konva renders the infinite canvas. Key layers:
- **Background layer**: Grid/dots
- **Objects layer**: Sticky notes, shapes, frames, connectors, text
- **Selection layer**: Selection rectangles, transform handles
- **Cursor layer**: Other users' cursors with name labels

### Database Schema
- `boards`: id, name, created_by, created_at
- `board_objects`: id, board_id, type (enum), properties (JSONB), x, y, width, height, z_index, created_by, updated_at
- Object types: sticky_note, rectangle, circle, line, connector, frame, text

### AI Agent
OpenAI GPT-4 with function calling. The AI receives board state via `getBoardState()` and manipulates the board through tool functions (createStickyNote, createShape, moveObject, etc.). API calls are proxied through a Supabase Edge Function at `/functions/v1/ai-agent` to keep the API key server-side.

### Conflict Resolution
Last-write-wins at the object level using `updated_at` timestamps. Acceptable for MVP scale.

## Project Structure

```
src/
  components/canvas/    # Board canvas: Stage, object renderers, cursors
  components/ui/        # Toolbar, panels, presence sidebar
  components/auth/      # Login screen
  hooks/                # useBoard, usePresence, useAI, useCanvas
  store/                # Zustand stores (boardStore, uiStore)
  lib/                  # Supabase client, OpenAI helpers, utils
  types/                # TypeScript types for board objects, events
supabase/
  migrations/           # SQL schema migrations
  functions/            # Edge Functions (ai-agent)
```

## Key Constraints

- Target 60 FPS during pan/zoom/manipulation
- Support 500+ objects without performance drops
- Support 5+ concurrent users per board
- AI agent commands should respond in <2 seconds
- Cursor sync must be throttled (send every ~50ms, not every mousemove frame)

## Repository

GitHub: https://github.com/agarg5/CollabBoard

## Project Management

Linear project: [CollabBoard](https://linear.app/project-abhi/project/collabboard-4c39808a1267)

Team key: `NAS`. Use `linear` CLI for issue management.

```bash
linear issue list --team NAS --project CollabBoard --sort priority --all-states --all-assignees
linear issue create -t "Title" -d "Description" --team NAS --project CollabBoard --no-interactive
```

Milestones: MVP (24h) -> Full Features (4 days) -> Polish & Submit (7 days)
