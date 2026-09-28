# BRIEFING — 2026-09-28T08:27:00Z

## Mission
Cross-subsystem code duplication, API contract drift, and architectural alignment audit across apps/web, apps/admin, apps/android, and php_backend.

## 🔒 My Identity
- Archetype: explorer
- Roles: cross-app DRY auditor, API contract drift investigator, shared architecture designer
- Working directory: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_shared_2
- Original parent: 630f3007-c637-4ab5-b180-4bb7313688c3
- Milestone: M5 - Cross-App DRY & Shared Architecture

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify any project code
- Write only to working directory: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_shared_2\
- Ground all findings with exact file paths, line numbers, and verified code comparisons

## Current Parent
- Conversation ID: 630f3007-c637-4ab5-b180-4bb7313688c3
- Updated: 2026-09-28T08:27:00Z

## Investigation State
- **Explored paths**:
  * `apps/web/src/utils/activity/*`, `apps/web/src/services/*`, `apps/web/src/components/upload/*`
  * `apps/admin/src/utils/*`, `apps/admin/src/components/*`, `apps/admin/src/App.tsx`
  * `apps/android/app/src/main/java/com/velotrack/sync/*`
  * `php_backend/routes/*`, `php_backend/utils/*`, `php_backend/dbInit.php`, `php_backend/database.php`
- **Key findings**:
  * Massive copy-pasted code between `web` and `admin` (>1,200 lines across 5 utils and 3 UI components).
  * Duplicate domain algorithms in Kotlin (`ActivityAggregator.kt`, `GeoCalculations.kt`, `PrivacyScrubber.kt`, `TcxParser.kt`).
  * Inverted parameter bug: `wgs84_to_gcj02(lng, lat)` in web vs `wgs84ToGcj02(lat, lng)` in android.
  * Phantom endpoint in Android: `POST /api/ai/suggest-title` (does not exist in `php_backend`, guaranteed 404).
  * Missing schema version `v: 1` in Android detail points upload payload.
  * Inconsistent HR formulas (naive percent vs Karvonen reserve) and defaults (188 vs 190).
  * `GET /api/reports/summary` returns 501, forcing full table scans on client.
- **Unexplored areas**: None. All 4 subsystems exhaustively audited.

## Key Decisions Made
- Authored comprehensive 5-component handoff report to `handoff.md`.
- Modeled before/after architecture using detailed Mermaid diagrams.
- Outlined pnpm monorepo shared packages (`packages/types`, `packages/utils`, `packages/api-client`, `packages/ui`) and OpenAPI cross-platform codegen strategy.

## Artifact Index
- DISPATCH.md — Initial dispatch message
- BRIEFING.md — Persistent situational awareness and state
- progress.md — Liveness heartbeat and completed task checklist
- handoff.md — Complete 5-component deliverable report
