# Project: VeloTrack-Pro Full-Stack Code Audit

## Architecture Overview
VeloTrack-Pro is a full-stack cycling telemetry and fleet management platform consisting of:
1. `apps/web`: Web tracking and rider portal (React, TypeScript, Vite, Geolocation, Web Bluetooth, offline storage).
2. `apps/admin`: Fleet & system administration dashboard (React, TypeScript, Vite, analytics, user/device management).
3. `apps/android`: Mobile cycling computer & tracker (Kotlin, Android SDK, Foreground Services, BLE GATT, GPS, Room/SQLite).
4. `php_backend`: Core REST API & persistence engine (PHP, PDO SQLite `cycling.db`, JWT/session auth, telemetry ingest, GPX processing).

## Feature Inventory & Audit Dimensions
| # | Dimension | Description | Scope |
|---|-----------|-------------|-------|
| 1 | R1: Bugs & Boundary Exceptions | NPE/undefined deref, unsafe type assertions, weak type conversions, array out-of-bounds, API contract discrepancies, unhandled timeouts/exceptions/silent failures, SQL injection risks in SQLite/PDO, uncommitted/unrolled transactions, connection leaks | Full stack (`web`, `admin`, `android`, `php_backend`) |
| 2 | R2: Async, Deadlocks & Concurrency | Hanging Promise chains, missing resolve/reject, infinite await, invalid state transitions in state machines (tracking, BLE connection, geolocation streams), infinite polling, cross-thread/component concurrent write race conditions | Full stack (`web`, `admin`, `android`, `php_backend`) |
| 3 | R3: Single Responsibility Principle (SRP) | File-by-file / module SRP audit: identifying God classes/components mixing UI, I/O, orchestration, caching; evaluate separation of View, Service/Hook, Store/Repository; provide decoupling architectures and Mermaid diagrams | Full stack (`web`, `admin`, `android`, `php_backend`) |
| 4 | R4: Don't Repeat Yourself (DRY) | Cross-app (`web` vs `admin` vs `android`) and intra-app duplicate utils, formatters, constants, types, duplicate UI snippets, validation logic; provide shared package/hook extraction designs | Full stack (`web`, `admin`, `android`, `php_backend`) |
| 5 | R5: Comprehensive Deliverable | Master audit report in `docs/audit_report.md` with severity levels (Critical / High / Medium / Low), precise clickable file paths and line ranges, concrete pseudo-code / refactoring examples for all Critical and High issues, Mermaid diagrams for SRP and DRY refactoring before/after | Deliverable to `docs/audit_report.md` |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Audit (PHP + SQLite) | Audit `php_backend` across R1, R2, R3, R4 | none | DONE |
| M2 | Web App Audit (`apps/web`) | Audit `apps/web` across R1, R2, R3, R4 | none | DONE |
| M3 | Admin App Audit (`apps/admin`) | Audit `apps/admin` across R1, R2, R3, R4 | none | DONE |
| M4 | Android App Audit (`apps/android`) | Audit `apps/android` across R1, R2, R3, R4 | none | DONE |
| M5 | Cross-App DRY & SRP Architecture | Cross-system deduplication, shared package design, contracts, Mermaid models | M1, M2, M3, M4 | DONE |
| M6 | Master Report Synthesis | Author `docs/audit_report.md` compiling all findings with verified line numbers, severity, pseudo-code, Mermaid diagrams | M1, M2, M3, M4, M5 | DONE |
| M7 | Multi-Perspective Review & Forensic Audit | Reviewers and Forensic Auditor verify technical correctness, zero fabrications, real line numbers, and clean pass | M6 | DONE |
