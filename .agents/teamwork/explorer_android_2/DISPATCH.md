## 2026-09-28T08:16:24Z

You are Explorer Android (explorer_android_2) for VeloTrack-Pro full-stack code audit.
Your working directory is: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_android_2
Your original user request is in: c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\ORIGINAL_REQUEST.md (under section ## 2026-09-28T08:12:31Z).

STRICT CONSTRAINTS:
1. Source code is strictly READ-ONLY. Do NOT modify any existing source code or logic.
2. Only write metadata/reports in your own directory: `c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_android_2\`.

YOUR TASK:
Exhaustively investigate `apps/android/`:
1. R1: Bugs & boundary exceptions:
   - Kotlin null-safety violations (`!!` force unwrapping, unsafe casts `as`, platform types without null checks).
   - Array/List index out-of-bounds, empty list operations (`.first()`, `.last()` without check).
   - Room / SQLite database issues: Query errors, unhandled SQLiteException, uncommitted transactions, cursor leaks.
   - API contract discrepancy: Retrofit/OkHttp models vs `php_backend` response schemas.
   - Unhandled exceptions in background threads/coroutines leading to silent failures or app crashes.
2. R2: Coroutines, Threading, and Concurrency:
   - CoroutineScope lifecycle leaks: Using `GlobalScope` or non-lifecycle-bound scopes; uncancelled jobs when Activity/Service is destroyed.
   - Foreground Service lifecycle for ride tracking: Notification channels, wake lock leaks, partial wakelocks not released, GPS location callback registration/unregistration leaks.
   - BLE GATT concurrency: Android BLE callbacks run on binder thread. Are callbacks dispatched to proper CoroutineDispatcher / Main thread? GATT queue serialization (calling `writeCharacteristic` or `readCharacteristic` concurrently without waiting for `onCharacteristicWrite`/`onCharacteristicRead` causes silent drops).
   - State machine race conditions: Tracking state transitions (IDLE, RECORDING, PAUSED, STOPPED) with concurrent events from UI, GPS callback, and BLE sensors.
3. R3: Single Responsibility Principle (SRP):
   - Identify God Activities, God Services, or God ViewModels mixing BLE communication, GPS tracking, Room persistence, network sync, and UI handling.
   - Propose architectural decoupling: Service -> UseCase / Interactor -> Repository -> DataSource.
4. R4: DRY Audit:
   - Duplicated metric calculations (distance, speed, elevation, power), duplicated Room converters, duplicated network error handlers.
5. Concrete Refactoring:
   - For all Critical and High issues, provide exact relative file paths, line number ranges (e.g. `apps/android/app/src/main/java/.../TrackingService.kt:60-85`), severity, impact, and concrete Kotlin refactoring code.

Deliver your detailed report to `c:\Users\VerNe\Downloads\Documents\Cycling\.agents\teamwork\explorer_android_2\handoff.md` and send a completion message with summary to parent.
