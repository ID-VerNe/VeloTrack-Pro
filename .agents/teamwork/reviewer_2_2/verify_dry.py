import pathlib
import difflib

pairs = [
    ("apps/web/src/utils/activity/activityAggregator.ts", "apps/admin/src/utils/activityAggregator.ts"),
    ("apps/web/src/utils/activity/geoCalculations.ts", "apps/admin/src/utils/geoCalculations.ts"),
    ("apps/web/src/utils/activity/privacyScrubber.ts", "apps/admin/src/utils/privacyScrubber.ts"),
    ("apps/web/src/utils/activity/tcxParser.ts", "apps/admin/src/utils/tcxParser.ts"),
    ("apps/web/src/utils/activity/activityParser.ts", "apps/admin/src/utils/activityParser.ts"),
    ("apps/web/src/components/upload/FileUpload.tsx", "apps/admin/src/components/FileUpload.tsx"),
    ("apps/web/src/components/upload/PairingModal.tsx", "apps/admin/src/components/PairingModal.tsx"),
    ("apps/web/src/components/upload/PrivacyZoneList.tsx", "apps/admin/src/components/PrivacyZoneList.tsx"),
    ("apps/web/src/utils/activity/adminApiClient.ts", "apps/admin/src/utils/apiClient.ts"),
]

base = pathlib.Path(".")
total_web_admin_dup_lines = 0

print("=== VERIFYING CODE DUPLICATION BETWEEN WEB & ADMIN ===")
for web_path, admin_path in pairs:
    w_file = base / web_path
    a_file = base / admin_path
    w_lines = w_file.read_text(encoding="utf-8", errors="ignore").splitlines()
    a_lines = a_file.read_text(encoding="utf-8", errors="ignore").splitlines()
    matcher = difflib.SequenceMatcher(None, w_lines, a_lines)
    ratio = matcher.ratio()
    total_lines = len(w_lines) + len(a_lines)
    total_web_admin_dup_lines += total_lines
    print(f"{w_file.name}: Web={len(w_lines)} Admin={len(a_lines)} Sum={total_lines} Similarity={ratio:.1%}")

print(f"\nTotal lines across these 9 pairs: {total_web_admin_dup_lines}")
