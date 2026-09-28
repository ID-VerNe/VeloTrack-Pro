# BRIEFING — 2026-09-28T08:30:00Z

## Mission
Perform an exhaustive code audit of `apps/web/` for VeloTrack-Pro across R1 (Bugs & boundary exceptions), R2 (Async, state machine, BLE, concurrency races), R3 (SRP & architectural decoupling), and R4 (DRY audit), delivering concrete refactoring code.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Web Frontend Specialist, Code Auditor
- Working directory: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_web_2
- Original parent: 630f3007-c637-4ab5-b180-4bb7313688c3
- Milestone: Full-stack Code Audit - Web Frontend (apps/web)

## 🔒 Key Constraints
- Read-only investigation — do NOT modify any source code or logic
- Write only to working directory: `c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_web_2\`
- Must communicate via `send_message` with recipient `630f3007-c637-4ab5-b180-4bb7313688c3`
- Provide exact relative file paths, line number ranges, severity, impact, and concrete TypeScript/React refactoring code for all Critical/High issues

## Current Parent
- Conversation ID: 630f3007-c637-4ab5-b180-4bb7313688c3
- Updated: 2026-09-28T08:30:00Z

## Investigation State
- **Explored paths**: `apps/web/src` (pages, components, hooks, services, utils), `php_backend` (index.php, routes)
- **Key findings**:
  1. Critical: API write requests missing auth tokens in `coachApi.ts`, `rideService.ts`, `aiInsights.ts` causing 401 failures under ADMIN_TOKEN.
  2. Critical: Lack of global ErrorBoundary + undefined title dereference in `RideCard.tsx:34` causing app-wide blank screen.
  3. Critical: IndexedDB hanging promises on `onblocked` and aborted transactions causing permanent locks.
  4. High: Missing AbortController causing race conditions in `useCoachChat.ts`, `useApi.ts`, `usePeriodicReport.ts`.
  5. High: Natural language string match `reply.includes('异常')` in `useCoachChat.ts:156` falsely cutting off valid coaching insights.
  6. High: Bypassing `riderService.getRiderProfile()` in `useRiderProfileDrawer.ts` leaves string cogs unparsed, blanking profile drawer.
  7. High: Unbounded array spread in `Math.max(...items)` risking V8 stack overflow.
  8. High: MapLibre mouse event listener memory leaks in `RideDetailMap.tsx`.
- **Unexplored areas**: None for `apps/web`. Exhaustive audit completed.

## Key Decisions Made
- Confirmed `apps/web` does not implement live GPS/BLE tracking; it functions as an offline-first telemetry analytics and AI coaching dashboard.
- All Critical/High issues supplied with concrete Before/After TypeScript/React code.

## Artifact Index
- `handoff.md` — Final 5-component handoff report
- `progress.md` — Liveness and progress tracking
- `DISPATCH.md` — Incoming dispatch log
