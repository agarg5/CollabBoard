# CollabBoard Pre-Search Document

## Phase 1: Constraints

### 1. Scale & Load Profile
- **Launch**: 5-10 concurrent users (demo/evaluation context)
- **6 months**: Not applicable - this is a week-long sprint project
- **Traffic pattern**: Spiky (evaluation sessions, demo periods)
- **Real-time**: Yes - WebSocket-based live sync is the core requirement. Cursor positions need <50ms latency, object sync <100ms
- **Cold start tolerance**: Low - users expect instant board load

### 2. Budget & Cost Ceiling
- **Monthly spend**: Minimal. Supabase free tier (500MB DB, 2GB bandwidth, 50K monthly active users) covers evaluation needs
- **Pay-per-use**: Acceptable for AI API calls (OpenAI GPT-4)
- **Time vs money**: Trading money for time everywhere possible - using managed services over custom infrastructure

### 3. Time to Ship
- **MVP**: 24 hours (hard gate - multiplayer sync, basic shapes, auth, deployed)
- **Full features**: 4 days (AI agent, connectors, frames, transforms)
- **Final polish**: 7 days
- **Priority**: Speed-to-market. Maintainability is secondary for a sprint project
- **Iteration cadence after launch**: Not applicable - this is a one-week sprint with a final demo. No post-launch iteration planned

### 4. Compliance & Regulatory
- None. Educational/demo project. No HIPAA, GDPR, SOC 2 requirements.

### 5. Team & Skill Constraints
- Solo developer
- Strong with: TypeScript, React, Supabase, Canvas APIs
- AI-first development: using Claude Code + Cursor as primary coding tools
- **Learning appetite vs. shipping speed**: Shipping speed wins. Using only familiar tools (React, Supabase, TypeScript). No time for learning new frameworks
- Preference: Ship fast with familiar tools

---

## Phase 2: Architecture Discovery

### 6. Hosting & Deployment
- **Decision**: Vercel (frontend SPA) + Supabase (hosted backend)
- **Serverless vs. containers vs. edge vs. VPS**: Serverless (Vercel) for frontend, managed platform (Supabase) for backend. Containers/VPS rejected due to operational overhead for a solo sprint. Edge functions used only for the AI proxy
- **Why**: Zero-config deployment for Vite apps on Vercel. Supabase is fully managed - no infrastructure to operate
- **CI/CD**: Vercel auto-deploys from GitHub
- **Scaling**: Both services auto-scale within their tiers. Supabase Realtime handles connection pooling

### 7. Authentication & Authorization
- **Decision**: Google OAuth via Supabase Auth
- **Why**: One-click sign in, no password management, Supabase handles token refresh and session management natively
- **Alternatives considered**: Magic links (slower UX), email/password (requires password reset flow), other social providers (GitHub, Apple - unnecessary for target audience). Google OAuth chosen for simplicity and broad adoption
- **RBAC**: Not needed for MVP. All authenticated users have equal board access
- **Multi-tenancy**: Boards are identified by URL/ID. Row-level security (RLS) on Supabase tables scopes data per board

### 8. Database & Data Layer
- **Decision**: Supabase Postgres + Realtime Channels
- **Why Postgres over Firestore**: Relational model fits board objects well (objects belong to boards, boards belong to users). SQL is more flexible for queries. Supabase Realtime broadcasts changes via channels
- **Schema approach**:
  - `boards` table: id, name, created_by, created_at
  - `board_objects` table: id, board_id, type, properties (JSONB), position, dimensions, z_index, created_by, updated_at
- **Real-time sync**: Supabase Realtime Broadcast for cursor positions (ephemeral, no persistence needed). Supabase Realtime Postgres Changes for object CRUD (persistent)
- **Read/write ratio**: ~60/40 during active collaboration. Writes are frequent (cursor moves, object drags)

**Key tradeoff**: Using Supabase Realtime Broadcast for cursors (fire-and-forget, no DB writes) vs Postgres Changes for objects (persisted, triggers on table changes). This separates ephemeral data from persistent state.

### 9. Backend/API Architecture
- **Decision**: No custom backend server. Supabase client SDK talks directly to Postgres via PostgREST + Realtime
- **Why**: Eliminates an entire deployment layer. Supabase RLS handles authorization at the database level. The AI agent runs client-side, calling OpenAI API directly (with key proxied through a Supabase Edge Function for security)
- **Edge Functions**: One function for proxying OpenAI API calls (keeps API key server-side)
- **Background jobs / queues**: Not needed. All operations are synchronous request-response. AI agent calls are short-lived (<2s). No long-running tasks, scheduled jobs, or async processing required

### 10. Frontend Framework & Rendering
- **Decision**: Vite + React SPA with React-Konva
- **Why Vite over Next.js**: No SSR/SEO needs for a canvas app. Simpler build, faster HMR, less abstraction
- **Why React-Konva over alternatives**:
  - vs Fabric.js: Better React integration, declarative component model
  - vs PixiJS: Easier object manipulation API, events built-in, sufficient performance for 500 objects
  - vs tldraw/Excalidraw: More customizable, better learning opportunity, full control over object model
- **State management**: Zustand for local canvas state (lightweight, no boilerplate). Supabase subscriptions push remote changes into the store
- **SEO requirements**: None. This is a canvas-based app behind authentication - no public pages to index
- **Offline support / PWA**: Not planned. Real-time collaboration requires an active connection. Offline mode would add significant complexity with no benefit for the use case
- **Rendering strategy**: React-Konva handles canvas rendering. HTML overlay for UI controls (toolbar, chat, presence indicators)

### 11. Third-Party Integrations
- **Supabase**: Auth, DB, Realtime, Edge Functions - all on free tier
- **OpenAI GPT-4**: Function calling for AI board agent. ~$0.01-0.03 per command. Rate limit: 500 RPM on basic tier
- **Vercel**: Frontend hosting, free tier sufficient
- **Vendor lock-in risk**: Moderate for Supabase (Postgres is portable, but Realtime Channels and Auth are proprietary). Low for Vercel (standard Vite build deploys anywhere). Acceptable tradeoff - migration is not a concern for a sprint project

---

## Phase 3: Post-Stack Refinement

### 12. Security Vulnerabilities
- Supabase RLS policies ensure users can only access boards they're part of
- OpenAI API key stored in Supabase Edge Function environment (never exposed to client)
- Input sanitization on text content (sticky notes, labels) to prevent XSS in rendered HTML overlays
- **Common misconfigurations**: Overly permissive RLS policies, exposing Supabase service key on the client, CORS misconfiguration on Edge Functions. Mitigated by using Supabase's default secure patterns and only the anon key client-side
- **Dependency risks**: React-Konva is actively maintained but has a smaller ecosystem than Fabric.js. Supabase JS SDK is well-maintained. `npm audit` will be run before deployment to catch known vulnerabilities

### 13. File Structure & Project Organization
```
collabboard/
  src/
    components/       # React components
      canvas/         # Board canvas components (Stage, Layers, Objects)
      ui/             # Toolbar, panels, presence indicators
      auth/           # Login/auth screens
    hooks/            # Custom hooks (useBoard, usePresence, useAI)
    store/            # Zustand stores (boardStore, uiStore)
    lib/              # Supabase client, OpenAI client, utilities
    types/            # TypeScript type definitions
  public/
  supabase/
    migrations/       # SQL migrations
    functions/        # Edge Functions (AI proxy)
```
- Monorepo: No. Single Vite app is sufficient
- Feature-based organization within `components/`

### 14. Naming Conventions
- **Components**: PascalCase (`StickyNote.tsx`, `BoardCanvas.tsx`)
- **Hooks**: camelCase with `use` prefix (`useBoard.ts`, `usePresence.ts`)
- **Types**: PascalCase with descriptive names (`BoardObject`, `CursorPosition`)
- **Linting**: ESLint + Prettier, standard React config

### 15. Testing Strategy
- **Philosophy**: Tests ship alongside features from day 1. ~80% feature code, ~20% test code. Not extreme, but proportional
- **Unit tests**: Vitest - test store logic, utility functions, object transforms with each feature
- **E2E tests**: Playwright - scaffolded early. Key scenario: open 2 browsers, create object in one, verify it appears in the other (proves real-time sync works)
- **Stress tests**: k6 - scaffolded early. Simulate concurrent WebSocket connections to validate multi-user performance targets
- **Coverage target**: No formal target. Focus on testing the tricky parts (real-time sync, state management) not trivial UI
- **Mocking patterns**: Supabase client mocked via `vi.mock()`. Realtime channel events simulated via mock event emitters
- **Manual verification**: Claude-in-Chrome extension for visual feature verification during development

### 16. Tooling & DX
- **Claude Code**: Primary coding agent for implementation
- **Cursor**: Secondary IDE with AI assistance
- **VS Code extensions**: ESLint, Prettier, Tailwind CSS IntelliSense, Supabase VS Code extension (schema explorer)
- **Browser DevTools**: Network tab for WebSocket inspection, Performance tab for FPS monitoring
- **Debugging setup**: React DevTools for component inspection, Zustand DevTools middleware for state debugging, Supabase Dashboard for real-time channel monitoring and DB queries

---

## Architecture Decision Summary

| Layer | Choice | Key Reason |
|-------|--------|------------|
| Backend | Supabase (hosted) | Auth + Realtime + DB in one, free tier, fastest to MVP |
| Database | Postgres + JSONB | Relational model, flexible JSON properties, SQL power |
| Real-time | Supabase Realtime (Broadcast + Postgres Changes) | Built-in presence, channels, no custom WS server |
| Frontend | Vite + React | No SSR needed, fast builds, simple |
| Canvas | React-Konva | Declarative React API, good event handling, sufficient perf |
| State | Zustand | Lightweight, no boilerplate, easy to sync with Supabase |
| Auth | Google OAuth (Supabase Auth) | One-click, managed sessions, free |
| AI | OpenAI GPT-4 function calling | Mature API, good structured output |
| Deploy | Vercel + Supabase | Zero-config, auto-deploy from GitHub, free tiers |

## Conflict Resolution Strategy
- **Approach**: Last-write-wins at the object level
- **Why**: Simplest to implement. Each object has an `updated_at` timestamp. Supabase Realtime delivers changes in order. For the MVP scale (5-10 users), conflicts on the same object are rare since users typically work on different parts of the board
- **Future**: Could upgrade to CRDTs (Yjs) if needed for text co-editing within a single sticky note
