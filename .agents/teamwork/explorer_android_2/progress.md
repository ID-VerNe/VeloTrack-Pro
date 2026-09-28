# Progress — explorer_android_2

- Last visited: 2026-09-28T08:23:30Z
- Status: Audit completed. Deliverable written to handoff.md.
- Current task: Notifying parent orchestrator via send_message.
- Explored components:
  1. `app/src/main/java/com/velotrack/sync/core/`: ActivityAggregator.kt, GeoCalculations.kt, PolylineEncoder.kt, PrivacyScrubber.kt, TcxParser.kt
  2. `app/src/main/java/com/velotrack/sync/data/`: ApiService.kt, ConfigRepository.kt, Models.kt
  3. `app/src/main/java/com/velotrack/sync/ui/`: MainActivity.kt, QrScannerActivity.kt, ShareReceiverActivity.kt
  4. Build & configuration: AndroidManifest.xml, app/build.gradle.kts, sample_ride.tcx
  5. Cross-subsystem contracts: php_backend routes (admin_rides.php, privacy_zones.php, rides.php, dbInit.php) and Web/Admin services (apiClient.ts, rideTitleService.ts)

