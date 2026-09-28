import pathlib

base = pathlib.Path(".")
paths = [
    "apps/web/src/components/ride-detail/RideDetailMap.tsx",
    "apps/web/src/hooks/useCoachChat.ts",
    "apps/web/src/services/coach/coachTools.ts",
    "apps/admin/src/App.tsx",
    "apps/android/app/src/main/java/com/velotrack/sync/ui/ShareReceiverActivity.kt",
    "php_backend/routes/rides.php",
    "php_backend/routes/admin_rides.php",
    "php_backend/routes/sync.php",
    "php_backend/routes/rider.php",
    "php_backend/dbInit.php",
]

for p in paths:
    fp = base / p
    if fp.exists():
        lines = len(fp.read_text(encoding="utf-8", errors="ignore").splitlines())
        print(f"{p}: {lines} lines")
    else:
        print(f"{p}: NOT FOUND")
