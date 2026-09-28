# VeloTrack-Pro UX/UI Design Engineering Audit Plan

## Objective
Execute an exhaustive, code-grounded UX and UI design engineering audit across `apps/web` and `apps/admin` in VeloTrack-Pro, strictly applying Apple Design Engineering principles (The Look, The Feel, Materials & Typography, Accessibility), and deliver a production-ready audit report to `docs/audit/UX_UI_AUDIT_REPORT.md`.

## Methodology & References
- **Domain Skill**: `C:\Users\VerNe\.gemini\config\skills\apple-ui-principles\SKILL.md`
- **Core Pillars**:
  1. **The Look (Static Visual Polish & Optical Correction)**:
     - Geometric center vs visual center (optical alignment of icons, chevrons, play buttons, badges).
     - Visual weight balance and negative space compensation.
     - Proximity as syntax ($Distance_{internal} < Distance_{external}$).
     - Dark mode typography rendering, white text bleeding compensation, antialiasing.
     - Curvature continuity and squircle / smooth corner treatment.
  2. **The Feel (Fluid Motion & Interactive Physics)**:
     - Immediate visual feedback on `pointerdown` vs delayed `click`/`pointerup`.
     - Interruptible spring physics models (`damping: 1.0`, `response: 0.3-0.4`) replacing rigid CSS transitions.
     - Direct manipulation, touch/gesture responsiveness, boundary rubber-banding, velocity inheritance.
  3. **Materials, Typography & Accessibility**:
     - Translucent surfaces (`backdrop-filter: blur`), prohibiting illegal stacking of light translucent materials.
     - Dynamic typography hierarchies, size-specific letter tracking (negative for display, positive for micro labels), heading leading.
     - System preference fallbacks: `@media (prefers-reduced-motion: reduce)` and `@media (prefers-reduced-transparency: reduce)`.

## Execution Phases

### Phase 1: Deep Codebase Exploration (3 Parallel Explorers)
- **Explorer 1 (`apps/web`)**: Audit pages, components, cycling tracking UI, modal sheets, workout/dashboard views in `apps/web`.
- **Explorer 2 (`apps/admin`)**: Audit administrative dashboard, data grids, metrics widgets, status badges, forms in `apps/admin`.
- **Explorer 3 (`packages/*` & Shared Design Infra)**: Audit `packages/ui` (or shared components), Tailwind configs, global CSS, animations, theme tokens, typography setup.

### Phase 2: Synthesis & Report Generation
- **Worker (`teamwork_preview_worker`)**: Aggregate all explorer findings, verify exact code locations and line ranges, formulate production-ready Before/After code snippets, construct prioritized remediation roadmap, and write `docs/audit/UX_UI_AUDIT_REPORT.md`.

### Phase 3: Review & Forensic Verification
- **Reviewer 1 & 2 (`teamwork_preview_reviewer`)**: Independently verify report completeness, code diff accuracy, Apple principle fidelity, and roadmap prioritization.
- **Forensic Auditor (`teamwork_preview_auditor`)**: Perform integrity verification to ensure zero fabricated paths, genuine code analysis, and high rigor.

### Phase 4: Final Synthesis & Sentinel Reporting
- Consolidate verdicts in `GATE_STATUS.md` and send comprehensive completion report to the Sentinel.
