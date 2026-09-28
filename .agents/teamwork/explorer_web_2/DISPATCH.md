## 2026-09-28T08:16:24Z
You are Explorer Web (explorer_web_2) for VeloTrack-Pro full-stack code audit.
Your working directory is: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_web_2
Your original user request is in: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\ORIGINAL_REQUEST.md (under section ## 2026-09-28T08:12:31Z).

STRICT CONSTRAINTS:
1. Source code is strictly READ-ONLY. Do NOT modify any existing source code or logic.
2. Only write metadata/reports in your own directory: `c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_web_2\`.

YOUR TASK:
Exhaustively investigate `apps/web/`:
1. R1: Bugs & boundary exceptions:
   - Null pointer / undefined dereferences (e.g. accessing properties of optional objects without optional chaining `?.`), unsafe type assertions (`as any`, `as unknown as X`), array out-of-bounds, NaN/Infinity in calculations.
   - API contract discrepancy: Check client fetch/API calls vs `php_backend` response formats (missing fields, type mismatches).
   - Error handling & silent failures: Missing catch blocks, empty `.catch(() => {})`, unhandled network timeouts, lack of error boundary fallback.
2. R2: Async control flow, deadlocks, and concurrency race conditions:
   - Hanging Promise chains, missing resolve/reject in custom Promises, unhandled async errors.
   - Geolocation stream & Tracking state machine: `navigator.geolocation.watchPosition` management, missing clearWatch on unmount/stop, GPS dropout handling, invalid state transitions between IDLE, RECORDING, PAUSED, STOPPED.
   - Web Bluetooth (BLE) flow: GATT server connection/disconnection lifecycle, missing event listener cleanup (`characteristicvaluechanged`), reconnect race conditions, deadlocks when multiple GATT operations run concurrently.
   - Data write races: Concurrent writes to LocalStorage / IndexedDB or Zustand/Redux stores; out-of-order API responses without AbortController.
3. R3: Single Responsibility Principle (SRP):
   - Identify God components/hooks mixing UI rendering, sensor I/O (GPS/BLE), calculation logic, and persistence.
   - Detail View vs Hook vs Store separation, propose decoupling architecture.
4. R4: DRY Audit:
   - Intra-app duplicated formatters (speed, distance, pace, elevation, time), duplicated calculations (Haversine formula, calorie, power), duplicate UI widgets/components.
5. Concrete Refactoring:
   - For all Critical and High issues, provide exact relative file paths, line number ranges (e.g. `apps/web/src/features/tracking/useTracking.ts:35-50`), severity, impact, and concrete TypeScript/React refactoring code.

Deliver your detailed report to `c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_web_2\handoff.md` and send a completion message with summary to parent.
