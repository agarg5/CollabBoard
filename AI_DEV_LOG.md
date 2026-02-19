# AI Development Log — CollabBoard

## Tools & Workflow

| Tool | Role | Integration |
|------|------|-------------|
| **Claude Code (CLI)** | Primary development agent — wrote ~95% of all code, managed git workflow, ran tests, deployed | Terminal-based; used for all coding, debugging, refactoring, and deployment tasks |
| **Claude-in-Chrome (MCP)** | Visual verification and browser-based QA during development | MCP server connected to Chrome; used to manually test UI flows, inspect real-time sync, and verify responsive layouts |
| **VoiceMode (MCP)** | Voice-to-text input for task descriptions and project management | Used for architectural discussions, Linear issue triaging, and technical quizzes |

**Workflow**: Claude Code handled the end-to-end development loop — reading requirements, scaffolding code, writing tests, committing, and creating PRs (167 commits over 2.5 days). Claude-in-Chrome was used for manual QA (verifying drag-and-drop, multi-user cursors, AI agent responses in the browser). Git worktrees kept feature branches isolated, and parallel sub-agents handled simultaneous feature implementation.

## MCP Usage

| MCP Server | What It Enabled |
|------------|----------------|
| **Claude-in-Chrome** | Browser automation for manual verification — navigating to the deployed app, clicking through auth flows, testing canvas interactions, reading console logs, and taking screenshots for visual QA. Used extensively to close the loop between code changes and visual verification (catching issues unit tests missed). |
| **VoiceMode** | Voice-to-text input for faster task descriptions, architectural discussions, and project management — the developer spoke requirements and Claude Code responded in text. Also used for technical quizzes on the CollabBoard project and syncing Linear issue statuses. |

## Effective Prompts

1. **Architecture scaffolding**: *"Create a real-time collaborative whiteboard with Supabase Realtime for sync. Use Broadcast for cursors (ephemeral), Postgres Changes for object CRUD (persistent), and Presence for online status. Zustand for state."* — This single prompt produced the entire real-time sync architecture with correct channel separation.

2. **AI agent with function calling**: *"Build an AI agent edge function that uses OpenAI GPT-4 function calling. The agent should receive board state and manipulate it through tool functions. Support multi-step tool call loops up to 5 iterations. Proxy through Supabase Edge Function."* — Generated the complete edge function with tool definitions, simulation loop, and error handling.

3. **Complex template generation**: *"Add SWOT analysis, user journey map, and retrospective board templates to the AI agent. The agent should create frames with properly positioned sticky notes inside them, using appropriate colors for each category."* — Produced pixel-accurate template layouts with correct color coding.

4. **E2E test setup**: *"Write Playwright E2E tests for multi-user collaboration. Test that two browser contexts can join the same board and see each other's cursor movements and object creation in real time."* — Generated working multi-context Playwright tests with proper Supabase auth handling.

5. **Performance optimization**: *"The canvas is janky when dragging objects with 200+ items on screen. Profile and fix — likely need to throttle Supabase writes during drag and use React-Konva layer separation."* — Identified the exact bottleneck (unthrottled DB writes on every drag pixel) and implemented 50ms throttled writes with optimistic local updates.

## Code Analysis

| Category | Estimated % |
|----------|------------|
| AI-generated (Claude Code) | ~90% |
| AI-assisted (Claude Code wrote, human edited) | ~7% |
| Hand-written (manual edits, config tweaks) | ~3% |

167 commits over 2.5 days across ~28 dedicated CollabBoard sessions. Claude Code authored virtually all application code, tests, migrations, and edge functions. The dominant language was TypeScript. Human input was primarily requirements, architecture decisions, and QA feedback.

## Strengths & Limitations

**Where AI excelled:**
- **Rapid scaffolding** — Full project structure with Vite + React + Supabase + Zustand in minutes
- **Boilerplate-heavy code** — Supabase client setup, auth flows, CRUD operations, Konva renderers
- **Multi-file refactors** — Renaming patterns, extracting shared types, updating imports across 20+ files
- **Test generation** — Unit tests (Vitest) and E2E tests (Playwright) with realistic assertions
- **Real-time sync logic** — Complex WebSocket subscription management with proper cleanup

**Where AI struggled:**
- **Canvas pixel precision** — Getting exact coordinates for overlapping objects, snap-to-grid alignment, and transform handle positioning required several iterations
- **Supabase RLS policies** — Row Level Security rules needed manual debugging when queries returned empty results silently; Claude even got repeatedly blocked by RLS when trying to clean up test data
- **Wrong-file targeting** — Claude occasionally edited the wrong component or file on the first attempt (e.g., fixing the wrong panel, editing the wrong branch), requiring redirection
- **React-Konva event edge cases** — Touch events, double-click detection, and transformer rotation had subtle bugs that needed browser-level debugging via Chrome MCP
- **Visual design** — Color choices, spacing, and overall UI aesthetics needed human direction

## Key Learnings

1. **AI-first development is viable for full-stack apps** — Claude Code handled everything from database migrations to frontend components to deployment. The bottleneck was human decision-making, not coding speed.

2. **MCP tools are a multiplier** — Claude-in-Chrome for browser QA eliminated the "works in theory but not in practice" gap. Seeing the actual rendered output caught issues that unit tests missed.

3. **Prompt specificity matters at the architecture level** — Vague prompts ("make it real-time") produced generic solutions. Specific prompts ("use Broadcast for cursors, Postgres Changes for CRUD") produced production-quality code on the first try.

4. **Git worktrees + AI = safe parallelism** — Isolating each feature in a worktree meant Claude Code could commit freely without polluting the main branch. Failed experiments were cheap to discard.

5. **The human role shifts to product management** — With AI handling implementation, the developer's highest-value contribution was deciding *what* to build, *how* to architect it, and *when* the quality was good enough. Code review became more about intent than syntax.
