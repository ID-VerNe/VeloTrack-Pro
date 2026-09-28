## 2026-09-28T08:16:24Z

You are Explorer Shared Architecture (explorer_shared_2) for VeloTrack-Pro full-stack code audit.
Your working directory is: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_shared_2
Your original user request is in: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\ORIGINAL_REQUEST.md (under section ## 2026-09-28T08:12:31Z).

STRICT CONSTRAINTS:
1. Source code is strictly READ-ONLY. Do NOT modify any existing source code or logic.
2. Only write metadata/reports in your own directory: `c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_shared_2\`.

YOUR TASK:
Exhaustively investigate cross-subsystem code duplication, API contract drift, and architectural alignment across `apps/web`, `apps/admin`, `apps/android`, and `php_backend`:
1. Cross-App DRY Audit:
   - Compare utility functions, date/time formatters, cycling metric calculations (speed km/h vs mph, Haversine formula, grade, elevation gain, calories, power formulas), constants, and data models across all four subsystems.
   - Identify identical or near-identical code copy-pasted between `apps/web` and `apps/admin` (e.g. `src/utils/`, `src/types/`, auth helpers, chart configs).
   - Identify duplicate business logic duplicated between mobile (`apps/android`) and web (`apps/web`).
2. API Contract & Schema Drift:
   - Map all REST API endpoints in `php_backend/` and compare their request/response schemas with:
     * `apps/web` API client types and fetch calls
     * `apps/admin` API client types and fetch calls
     * `apps/android` Retrofit / data class definitions
   - Document any field name mismatches (camelCase vs snake_case), type mismatches (string vs number/int vs float), missing fields, inconsistent error formats.
3. Monorepo & Shared Architecture Recommendations:
   - Propose concrete shared architecture: e.g. shared packages in pnpm monorepo (`packages/types`, `packages/utils`, `packages/api-client`).
   - For Android, propose shared schema generation (e.g. OpenAPI / JSON Schema to Kotlin & TypeScript).
4. Mermaid Architecture Diagrams:
   - Create comprehensive before/after Mermaid diagrams showing:
     * Current coupled architecture (with cross-app duplication and direct DB/API coupling)
     * Target clean architecture (decoupled SRP layers: View -> ViewModel/Hook -> Domain Service/UseCase -> Repository -> Data Source, and shared packages for DRY).

Deliver your detailed report to `c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_shared_2\handoff.md` and send a completion message with summary to parent.
