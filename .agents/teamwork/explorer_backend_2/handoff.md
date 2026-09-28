# VeloTrack-Pro PHP Backend & SQLite Database Exhaustive Code Audit Report

**Audit Target**: `php_backend/`, SQLite Database interactions (`cycling.db`), server deployment configurations (`.htaccess`, `nginx.conf.example`), and client consumers (`apps/web`, `apps/admin`, `apps/android`).  
**Auditor**: Explorer Backend (`explorer_backend_2`)  
**Audit Mode**: Read-Only Inspection  
**Date**: 2026-09-28  

---

## 1. Observation

Direct code-level observations across all files in `php_backend/`, configuration files, and client-side API contracts:

### 1.1 Web Server File Protection & Sensitive File Exposure
- **File**: `.htaccess` (repository root), lines 4–6:
  ```apache
  <FilesMatch "\.(log|db|sqlite|sqlite3|db-journal)$">
      Require all denied
  </FilesMatch>
  ```
- **File**: `php_backend/nginx.conf.example`, lines 9–12:
  ```nginx
  location ~* \.(db|sqlite|sqlite3|log|db-journal)$ {
      deny all;
      return 404;
  }
  ```
- **File**: `php_backend/.htaccess`, lines 4–6:
  ```apache
  <FilesMatch "\.(log|sqlite|sqlite3|db-journal|env)$">
      Require all denied
  </FilesMatch>
  ```
- **Database Journal Mode**: Verified via PHP PDO runtime that `cycling.db` operates in Write-Ahead Logging mode (`PRAGMA journal_mode = wal`). When WAL mode is active, SQLite writes transaction commits to `cycling.db-wal` and memory maps to `cycling.db-shm`.
- **Observation**: Neither `.htaccess` nor `nginx.conf.example` blocks requests matching `.db-wal` or `.db-shm`. Any HTTP GET request to `/cycling.db-wal` or `/cycling.db-shm` is served directly by Apache/Nginx. Furthermore, `php_backend/.htaccess` does not forbid direct HTTP execution of PHP files in `php_backend/` (such as `php_backend/migrate_cities.php`).

### 1.2 Schema Self-Bootstrap & Table Lock Contention on Every Request
- **File**: `php_backend/index.php`, lines 52–53:
  ```php
  $pdo = get_db_connection();
  ensure_tables($pdo);
  ```
- **File**: `php_backend/dbInit.php`, lines 12–31:
  ```php
  function ensure_tables(PDO $pdo): void
  {
      static $done = false;
      static $errored = false;

      if ($done) return;
      if ($errored) return;

      try {
          run_ensure_tables($pdo);
          $done = true;
      } catch (Throwable $e) {
          $errored = true;
          error_log('[dbInit] ensureTables failed: ' . $e->getMessage());
          throw $e;
      }
  }
  ```
- **File**: `php_backend/dbInit.php`, lines 33–269 (`run_ensure_tables`):
  Executes 8 `CREATE TABLE IF NOT EXISTS`, 3 `CREATE INDEX IF NOT EXISTS`, 8 `ALTER TABLE rides`, 1 `UPDATE rides`, 1 `SELECT id, start_lat, ... FROM rides WHERE cities IS NULL ...`, 6 `ALTER TABLE rider_profile`, 3 `ALTER TABLE rider_profile DROP COLUMN`, `migrate_rider_memories()`, 3 `INSERT OR IGNORE`, 1 `SELECT id FROM rider_memories`, and 2 `SELECT COUNT(*)` queries.
- **Observation**: PHP operates on a shared-nothing lifecycle in standard web server environments (Apache mod_php, PHP-FPM, CGI). Function static variables (`$done`) are initialized to `false` at the start of every incoming HTTP request. Consequently, every single HTTP request hits the database and executes over 30 DDL and schema introspection queries.

### 1.3 SQLite Transaction Locking & Deadlock in Sync Push
- **File**: `php_backend/routes/sync.php`, lines 70–71 & 137–142:
  ```php
  $pdo->beginTransaction();
  try {
      foreach ($mutations as $m) {
          ...
          $current = db_first($pdo, 'SELECT id, updated_at, deleted_at FROM rides WHERE id = ?', [$rideId]);
          ...
          db_run($pdo, 'UPDATE rides SET title = ?, updated_at = ? WHERE id = ?', [$newTitle, $now, $rideId]);
      }
      $pdo->commit();
  } catch (Throwable $e) {
      if ($pdo->inTransaction()) {
          $pdo->rollBack();
      }
      send_error('Push sync transaction failed: ' . $e->getMessage(), 500);
  }
  ```
- **Observation**: PDO SQLite driver defaults `beginTransaction()` to `BEGIN DEFERRED`. Under deferred mode, the transaction begins with a SHARED (read) lock upon the first `SELECT`. When concurrent sync requests attempt their first `UPDATE`, both try to upgrade from SHARED to RESERVED/EXCLUSIVE simultaneously, resulting in immediate SQLite lock contention (`SQLITE_BUSY: database is locked`) and aborted mutations.

### 1.4 Unprotected Table Re-Creation in `migrate_rider_memories`
- **File**: `php_backend/dbInit.php`, lines 274–302:
  ```php
  function migrate_rider_memories(PDO $pdo): void
  {
      try {
          $row = db_first($pdo, "SELECT sql FROM sqlite_master WHERE type='table' AND name='rider_memories'");
          if ($row && str_contains($row['sql'] ?? '', 'CHECK(category IN')) {
              $pdo->exec("CREATE TABLE rider_memories_v2 (...)");
              $pdo->exec("INSERT INTO rider_memories_v2 (...) SELECT ... FROM rider_memories");
              $pdo->exec('DROP TABLE rider_memories');
              $pdo->exec('ALTER TABLE rider_memories_v2 RENAME TO rider_memories');
          }
      } catch (Throwable $e) {
          error_log('[dbInit] rider_memories migration note: ' . $e->getMessage());
      }
  }
  ```
- **Observation**: The migration sequence (`CREATE`, `INSERT SELECT`, `DROP TABLE`, `RENAME`) is executed outside any database transaction. If the script times out, memory is exhausted, or the process is terminated after `DROP TABLE` but before `RENAME`, the entire table and all historical rider memories are permanently lost.

### 1.5 Detail Points Ingestion Omits `updated_at` Bump
- **File**: `php_backend/routes/admin_rides.php`, lines 108–120:
  ```php
  route('POST', '/api/admin/rides/:id/detail-points', function (array $p) {
      $pdo = get_db_connection();
      $ride = db_first($pdo, 'SELECT id FROM rides WHERE id = ?', [$p['id']]);
      if (!$ride) send_error('Ride not found', 404);

      $raw = file_get_contents('php://input');
      $decoded = json_decode($raw, true);
      if (!is_array($decoded) || !isset($decoded['points']) || !is_array($decoded['points'])) {
          send_error('detail points 必须是 {v, points} JSON', 400);
      }
      db_run($pdo, 'UPDATE rides SET detail_points = ? WHERE id = ?', [$raw, $p['id']]);
      send_json(['success' => true]);
  });
  ```
- **Observation**: When admin or Android uploads detail points (`/api/admin/rides/:id/detail-points`), the SQL query updates `detail_points` but does NOT update `updated_at`. Incremental sync (`GET /api/sync?since=...`) relies exclusively on `updated_at >= $since`. As a result, newly uploaded detail points are never synced to other clients.

### 1.6 Clock Skew & LWW Poisoning in Sync Engine
- **File**: `php_backend/routes/sync.php`, lines 108–109:
  ```php
  $now = max($clientUpdated, $serverTime);
  db_run($pdo, 'UPDATE rides SET title = ?, updated_at = ? WHERE id = ?', [$newTitle, $now, $rideId]);
  ```
- **Observation**: If a client device clock is set to the future (e.g. system clock drift or manual change to 2027), `$now` adopts the future timestamp. Once `updated_at` is stamped in the future, all future legitimate edits from correctly configured devices will be rejected by the LWW rule (`$clientUpdated >= $dbUpdated`), permanently freezing the record.

### 1.7 Web Client `updateRideTitle` Authentication Discrepancy
- **File**: `apps/web/src/services/rideService.ts`, lines 25–34:
  ```typescript
  export async function updateRideTitle(id: string, newTitle: string): Promise<void> {
    const res = await fetch(`/api/rides/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (!res.ok) {
      throw new Error('更新标题失败');
    }
  }
  ```
- **File**: `php_backend/index.php`, lines 154–158:
  ```php
  $isAdminRoute = str_starts_with($path, '/api/admin');
  $isWrite = !in_array($method, ['GET', 'HEAD'], true);
  if ($isAdminRoute || $isWrite) {
      check_auth();
  }
  ```
- **Observation**: `updateRideTitle` sends a `PATCH` request without `Authorization` headers. If `ADMIN_TOKEN` is configured on the backend, `check_auth()` intercepts the request and responds with `401 Unauthorized`, breaking title editing in the web client.

### 1.8 Unindexed `ai_messages` Table & $O(N^2)$ Correlated Subquery
- **File**: `php_backend/dbInit.php`, lines 149–160:
  ```sql
  CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
      content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
  ```
- **File**: `php_backend/routes/coach.php`, lines 10–18:
  ```sql
  SELECT
      session_id,
      MAX(created_at) as last_activity,
      COUNT(*) as message_count,
      (SELECT content FROM ai_messages WHERE session_id = m.session_id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_question
  FROM ai_messages m
  GROUP BY session_id
  ORDER BY last_activity DESC
  LIMIT 30
  ```
- **Observation**: `ai_messages` has NO indexes on `session_id`, `created_at`, or `role`. `GET /api/ai/coach/sessions` runs a correlated subquery on every unique session_id, causing nested full table scans that degrade rapidly with chat volume.

### 1.9 DRY Violation: 35 Lines Copy-Pasted Between Route and CLI
- **File**: `php_backend/routes/rides.php`, lines 33–54 vs `php_backend/migrate_cities.php`, lines 19–45:
  Both files duplicate the exact same loop, query, polyline geo-resolution, JSON encoding, comparison, and row-by-row `UPDATE` logic verbatim. Neither wraps the loop in a database transaction, resulting in hundreds of individual unbatched disk writes.

---

## 2. Logic Chain

```
[Observation 1.1: WAL mode active + .htaccess excludes .db-wal]
  └─► Any user can fetch http://host/cycling.db-wal
        └─► Direct exposure of uncheckpointed SQLite commits (GPS points, user profile, tokens) [CRITICAL]

[Observation 1.2: PHP shared-nothing architecture + ensure_tables() called in index.php]
  └─► Every HTTP request executes 30+ DDL queries (CREATE, ALTER, DROP, INDEX)
        └─► SQLite acquires EXCLUSIVE schema lock for each DDL
              └─► Multiple concurrent requests exceed busy_timeout (5000ms)
                    └─► SQLITE_BUSY crashes with 500 Internal Server Error [CRITICAL]

[Observation 1.3: PDO::beginTransaction() defaults to BEGIN DEFERRED]
  └─► Concurrently arriving /api/sync/push requests start with SHARED locks on SELECT
        └─► When attempting UPDATE, both try to acquire RESERVED locks
              └─► Lock upgrade deadlock occurs -> SQLITE_BUSY [CRITICAL]

[Observation 1.4: migrate_rider_memories drops original table before rename without transaction]
  └─► Process crash or timeout between DROP and RENAME
        └─► Table is permanently destroyed with no rollback [CRITICAL]

[Observation 1.5: POST /api/admin/rides/:id/detail-points omits updated_at bump]
  └─► rides.updated_at remains at the timestamp of the initial ride metadata upload
        └─► Incremental sync (/api/sync?since=...) compares since > updated_at
              └─► Detail points are permanently omitted from sync results [HIGH]

[Observation 1.7: Web updateRideTitle sends PATCH without auth header]
  └─► index.php treats PATCH as $isWrite -> check_auth() -> 401 Unauthorized
        └─► Users cannot edit ride titles on web app in production [HIGH]
```

---

## 3. Caveats

1. **Host Environment Differences**: Under Cloudflare Worker reverse proxy (`apps/web/worker.ts`), the Worker injects `Authorization: Bearer <ADMIN_TOKEN>` for requests matching `/api/*`. However:
   - Direct requests to origin or requests from clients not using the Worker proxy (such as admin web client or Android client direct connect) are subject to direct backend auth rules.
   - If `apps/web/worker.ts` is bypassed or direct origin is accessed, `.htaccess` is the sole line of defense.
2. **SQLite Configuration Assumptions**:
   - `PRAGMA foreign_keys = ON` and `PRAGMA busy_timeout = 5000` are executed in `get_db_connection()`, but `PRAGMA journal_mode = WAL` is not explicitly enforced during connection initialization.
3. **SQLite `DROP COLUMN` Support**:
   - `ALTER TABLE rides DROP COLUMN ...` in `dbInit.php:86-87` requires SQLite 3.35.0+. On older systems (e.g. legacy CentOS/RHEL shared hosts running SQLite 3.7-3.28), this throws a syntax error caught by the empty catch block.

---

## 4. Conclusion & Audit Findings Scorecard

| ID | Category | Severity | File & Line Range | Summary |
|---|---|---|---|---|
| **SEC-01** | Security | **Critical** | `.htaccess:4-6`, `php_backend/nginx.conf.example:9-12` | SQLite WAL & SHM files (`.db-wal`, `.db-shm`) exposed via HTTP GET |
| **CONC-01** | Concurrency | **Critical** | `php_backend/index.php:52-53`, `dbInit.php:12-31` | DDL bootstrap runs on every HTTP request; causes `SQLITE_BUSY` lock thrashing |
| **CONC-02** | Concurrency | **Critical** | `php_backend/routes/sync.php:70-143` | `BEGIN DEFERRED` deadlock under concurrent push sync |
| **DATA-01** | Data Safety | **Critical** | `php_backend/dbInit.php:274-302` | `migrate_rider_memories` drops table outside transaction |
| **SEC-02** | Security | **Critical** | `php_backend/migrate_cities.php:1-52`, `routes/rides.php:29-62` | Unauthenticated maintenance script & unauthenticated sensitive endpoints |
| **SYNC-01** | Sync Integrity | **High** | `php_backend/routes/admin_rides.php:108-120` | `detail-points` ingestion does not bump `updated_at`, breaking sync |
| **SYNC-02** | Data Boundary | **High** | `php_backend/routes/sync.php:108-109` | Client clock skew permanently freezes LWW updates |
| **CONTRACT-01** | API Contract | **High** | `apps/web/src/services/rideService.ts:25-34` vs `php_backend/index.php:155-158` | Web client `updateRideTitle` blocked by backend 401 auth gate |
| **PERF-01** | Performance | **High** | `php_backend/dbInit.php:149-160`, `routes/coach.php:10-20` | `ai_messages` missing indexes; $O(N^2)$ correlated subquery |
| **PERF-02** | Performance | **High** | `php_backend/routes/sync.php:34` | Full table scan on every sync poll due to index-unfriendly `OR` condition |
| **DRY-01** | DRY / SRP | **High** | `routes/rides.php:29-62` vs `migrate_cities.php:19-45` | 35 lines copy-pasted; unbatched N-write loop without transaction |
| **BUG-01** | Boundary | **Medium** | `php_backend/routes/rider.php:26-42` | Dead code `elseif` in `custom_specs` merging logic |
| **BUG-02** | Type Safety | **Medium** | `php_backend/routes/rider.php:12` | Falsy check `$profile['bike_weight_kg'] ? ...` resets 0kg to 11.5kg |
| **ERR-01** | Error Handling | **Medium** | `php_backend/database.php:23` | Undefined function `send_error()` called when included outside `index.php` |
| **ERR-02** | Error Handling | **Medium** | `php_backend/dbInit.php:73-88, 184-194` | Swallowed exceptions with empty catch blocks (`catch (Throwable $e) {}`) |

---

## 5. Concrete Refactoring: Critical & High Issues

### 5.1 [SEC-01] Fix WAL & SHM File Leakage in Web Server Rules
- **Target Files**: `.htaccess` (lines 4–6), `php_backend/.htaccess` (lines 4–6), and `php_backend/nginx.conf.example` (lines 9–12)
- **Severity**: Critical
- **Impact**: Full database dump through uncheckpointed WAL file leakage over HTTP.

#### Before (`.htaccess:4-6`):
```apache
<FilesMatch "\.(log|db|sqlite|sqlite3|db-journal)$">
    Require all denied
</FilesMatch>
```

#### After (`.htaccess:4-10`):
```apache
# 严密拦截 SQLite 主库、临时日志、WAL 预写日志、共享内存与环境配置
<FilesMatch "(?i)\.(log|db|sqlite|sqlite3|db-journal|db-wal|db-shm|env)$">
    Require all denied
</FilesMatch>

# 严禁直接访问除 index.php 以外的任何 PHP 源码与脚本
RewriteCond %{REQUEST_URI} !/php_backend/index\.php$
RewriteRule ^php_backend/.*\.php$ - [F,L]
```

#### Before (`php_backend/nginx.conf.example:9-12`):
```nginx
location ~* \.(db|sqlite|sqlite3|log|db-journal)$ {
    deny all;
    return 404;
}
```

#### After (`php_backend/nginx.conf.example:9-12`):
```nginx
location ~* \.(db|sqlite|sqlite3|log|db-journal|db-wal|db-shm|env)$ {
    deny all;
    return 404;
}
```

---

### 5.2 [CONC-01] Eliminate Schema Thrashing & Exclusive Lock Contention
- **Target Files**: `php_backend/index.php` (lines 52–54) & `php_backend/dbInit.php` (lines 12–31)
- **Severity**: Critical
- **Impact**: Server throws `SQLITE_BUSY: database is locked` on concurrent traffic due to repetitive DDL executions on every HTTP request.

#### Before (`php_backend/index.php:52-54`):
```php
$pdo = get_db_connection();
ensure_tables($pdo);
```

#### After (`php_backend/index.php:52-60`):
```php
$pdo = get_db_connection();

// 仅在首次部署/未初始化时执行 DDL 自举，普通请求直接跳过，零锁竞争
$version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
if ($version < CURRENT_SCHEMA_VERSION) {
    ensure_tables($pdo);
}
```

#### Before (`php_backend/dbInit.php:12–31`):
```php
function ensure_tables(PDO $pdo): void
{
    static $done = false;
    static $errored = false;

    if ($done) return;
    if ($errored) return;

    try {
        run_ensure_tables($pdo);
        $done = true;
    } catch (Throwable $e) {
        $errored = true;
        error_log('[dbInit] ensureTables failed: ' . $e->getMessage());
        throw $e;
    }
}
```

#### After (`php_backend/dbInit.php:10–35`):
```php
define('CURRENT_SCHEMA_VERSION', 2);

function ensure_tables(PDO $pdo): void
{
    $version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
    if ($version >= CURRENT_SCHEMA_VERSION) {
        return;
    }

    try {
        // 使用排他写事务包裹 DDL 与初始化迁移
        $pdo->exec('BEGIN IMMEDIATE TRANSACTION');
        run_ensure_tables($pdo);
        $pdo->exec('PRAGMA user_version = ' . CURRENT_SCHEMA_VERSION);
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->exec('ROLLBACK');
        }
        error_log('[dbInit] ensureTables failed: ' . $e->getMessage());
        throw $e;
    }
}
```

---

### 5.3 [CONC-02] Fix SQLite Concurrency Deadlock via `BEGIN IMMEDIATE`
- **Target File**: `php_backend/routes/sync.php` (lines 70–72 & lines 136–143)
- **Severity**: Critical
- **Impact**: `SQLITE_BUSY` deadlock when multiple devices push offline mutations concurrently.

#### Before (`php_backend/routes/sync.php:70-71, 137-143`):
```php
    $pdo->beginTransaction();
    try {
        foreach ($mutations as $m) {
            ...
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        send_error('Push sync transaction failed: ' . $e->getMessage(), 500);
    }
```

#### After (`php_backend/routes/sync.php:70-76, 140-149`):
```php
    // SQLite 必须显式使用 BEGIN IMMEDIATE 获取保留锁，严防并发读转写死锁
    $pdo->exec('BEGIN IMMEDIATE TRANSACTION');
    try {
        foreach ($mutations as $m) {
            ...
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->exec('ROLLBACK');
        }
        error_log('[SyncPush] Transaction failed: ' . $e->getMessage());
        send_error('Push sync failed due to write conflict. Please retry.', 409);
    }
```

---

### 5.4 [DATA-01] Atomic Table Re-Creation in `migrate_rider_memories`
- **Target File**: `php_backend/dbInit.php` (lines 274–302)
- **Severity**: Critical
- **Impact**: Permanent data loss of user training memories if the process fails between `DROP TABLE` and `RENAME`.

#### Before (`php_backend/dbInit.php:274-302`):
```php
function migrate_rider_memories(PDO $pdo): void
{
    try {
        $row = db_first($pdo, "SELECT sql FROM sqlite_master WHERE type='table' AND name='rider_memories'");
        if ($row && str_contains($row['sql'] ?? '', 'CHECK(category IN')) {
            $pdo->exec("CREATE TABLE rider_memories_v2 (...)");
            $pdo->exec("INSERT INTO rider_memories_v2 SELECT ... FROM rider_memories");
            $pdo->exec('DROP TABLE rider_memories');
            $pdo->exec('ALTER TABLE rider_memories_v2 RENAME TO rider_memories');
        }
    } catch (Throwable $e) {
        error_log('[dbInit] rider_memories migration note: ' . $e->getMessage());
    }
}
```

#### After (`php_backend/dbInit.php:274-306`):
```php
function migrate_rider_memories(PDO $pdo): void
{
    try {
        $row = db_first($pdo, "SELECT sql FROM sqlite_master WHERE type='table' AND name='rider_memories'");
        if ($row && str_contains($row['sql'] ?? '', 'CHECK(category IN')) {
            $inTx = $pdo->inTransaction();
            if (!$inTx) $pdo->exec('BEGIN IMMEDIATE TRANSACTION');

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS rider_memories_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    memory_key TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'manual',
                    importance INTEGER NOT NULL DEFAULT 3,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
                )
            ");
            $pdo->exec("
                INSERT INTO rider_memories_v2 (id, category, memory_key, content, source, is_active, created_at, updated_at)
                SELECT id, category, memory_key, content, source, is_active, created_at, updated_at FROM rider_memories
            ");
            $pdo->exec('DROP TABLE rider_memories');
            $pdo->exec('ALTER TABLE rider_memories_v2 RENAME TO rider_memories');

            if (!$inTx) $pdo->exec('COMMIT');
        }
    } catch (Throwable $e) {
        if (!$inTx && $pdo->inTransaction()) {
            $pdo->exec('ROLLBACK');
        }
        error_log('[dbInit] rider_memories migration failed: ' . $e->getMessage());
        throw $e;
    }
}
```

---

### 5.5 [SEC-02] Restrict Direct Execution of Maintenance Script & Auth Audit
- **Target Files**: `php_backend/migrate_cities.php` (lines 1–15) and `php_backend/index.php` (lines 154–158)
- **Severity**: Critical
- **Impact**: Unauthenticated users can trigger resource-intensive database table scans and modification operations.

#### Before (`php_backend/migrate_cities.php:1-15`):
```php
<?php

// php_backend/migrate_cities.php
// 历史骑行记录城市与跨城字段回填迁移脚本

@set_time_limit(0);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/dbInit.php';
require_once __DIR__ . '/utils/geo_resolver.php';

echo "=== 开始骑行记录城市与跨城多维迁移回填 ===" . PHP_EOL;
```

#### After (`php_backend/migrate_cities.php:1-18`):
```php
<?php

// php_backend/migrate_cities.php
// 仅允许 CLI 命令行或通过受鉴权保护的 API 运行，严防外部 HTTP 直连触发
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Forbidden: This script can only be executed via CLI']);
    exit;
}

set_time_limit(300);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/dbInit.php';
require_once __DIR__ . '/utils/geo_resolver.php';

echo "=== 开始骑行记录城市与跨城多维迁移回填 ===" . PHP_EOL;
```

#### Auth Routing Policy Refactor (`php_backend/index.php:154-162`):
```php
// 显式界定公共只读路由，其余所有管理/写入/隐私/聊天接口均强制校验 Token
$isPublicGet = in_array($method, ['GET', 'HEAD'], true) && (
    $path === '/api/rides' ||
    preg_match('#^/api/rides/[^/]+$#', $path) ||
    $path === '/api/ai/config'
);

if (!$isPublicGet) {
    check_auth();
}

dispatch($method, $path);
```

---

### 5.6 [SYNC-01] Detail Points Ingestion Must Update `updated_at`
- **Target File**: `php_backend/routes/admin_rides.php` (lines 108–120)
- **Severity**: High
- **Impact**: Incremental sync watermark misses new detail points, causing client graphs to fall back to simulated curves.

#### Before (`php_backend/routes/admin_rides.php:117-120`):
```php
    db_run($pdo, 'UPDATE rides SET detail_points = ? WHERE id = ?', [$raw, $p['id']]);
    send_json(['success' => true]);
```

#### After (`php_backend/routes/admin_rides.php:117-122`):
```php
    $now = (int)(microtime(true) * 1000);
    db_run($pdo, 'UPDATE rides SET detail_points = ?, updated_at = ? WHERE id = ?', [$raw, $now, $p['id']]);
    send_json(['success' => true, 'updated_at' => $now]);
```

---

### 5.7 [SYNC-02] Skew Clamping for LWW Synchronization
- **Target File**: `php_backend/routes/sync.php` (lines 106–112)
- **Severity**: High
- **Impact**: Client with skewed future clock permanently poisons the record under LWW.

#### Before (`php_backend/routes/sync.php:106-112`):
```php
    $dbUpdated = (int)($current['updated_at'] ?? 0);
    if ($clientUpdated >= $dbUpdated) {
        $now = max($clientUpdated, $serverTime);
        db_run($pdo, 'UPDATE rides SET title = ?, updated_at = ? WHERE id = ?', [$newTitle, $now, $rideId]);
        $results[] = ['mutation_id' => $mId, 'status' => 'applied'];
        $appliedCount++;
    }
```

#### After (`php_backend/routes/sync.php:106-117`):
```php
    $dbUpdated = (int)($current['updated_at'] ?? 0);
    // 允许客户端时间在服务端当前时间 +60秒内，超出者强制截断至 serverTime 防恶意/误设时钟投毒
    $maxAllowedTime = $serverTime + 60000;
    $effectiveClientTime = min($clientUpdated, $maxAllowedTime);

    if ($effectiveClientTime >= $dbUpdated) {
        $now = max($effectiveClientTime, $serverTime);
        db_run($pdo, 'UPDATE rides SET title = ?, updated_at = ? WHERE id = ?', [$newTitle, $now, $rideId]);
        $results[] = ['mutation_id' => $mId, 'status' => 'applied', 'updated_at' => $now];
        $appliedCount++;
    } else {
        $results[] = ['mutation_id' => $mId, 'status' => 'rejected', 'reason' => 'lww_conflict'];
    }
```

---

### 5.8 [PERF-01] Add B-Tree Indexes on `ai_messages`
- **Target File**: `php_backend/dbInit.php` (lines 149–160)
- **Severity**: High
- **Impact**: Eliminates $O(N^2)$ full table scans on coach session list retrieval.

#### Add Index Migration (`php_backend/dbInit.php:160`):
```php
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at, role)");
```

---

### 5.9 [PERF-02] Fix Sync Poll Full Table Scan
- **Target File**: `php_backend/routes/sync.php` (line 34)
- **Severity**: High
- **Impact**: Changes sync poll query from full table scan to indexed B-tree range scan.

#### Before (`php_backend/routes/sync.php:33-37`):
```php
    WHERE (updated_at >= ? OR (deleted_at IS NOT NULL AND deleted_at >= ?))
    ORDER BY start_time DESC
', [$safeSince, $safeSince])['results'];
```

#### After (`php_backend/routes/sync.php:33-37`):
```php
    // 软删除时 updated_at 必然与 deleted_at 同步更新，直接走 idx_rides_sync(updated_at) 单列范围扫描
    WHERE updated_at >= ?
    ORDER BY start_time DESC
', [$safeSince])['results'];
```

---

### 5.10 [DRY-01] & [SRP-01] Extract City Migration to Reusable Service
- **Target Files**: `php_backend/routes/rides.php` (lines 29–62) and `php_backend/migrate_cities.php` (lines 19–45)
- **Severity**: High
- **Impact**: Removes 35 lines of duplicate code; wraps row updates in chunked transactions to avoid massive I/O fsync overhead.

#### Reusable Service Function (in `php_backend/utils/ride_helper.php`):
```php
/**
 * 批量回填校准城市信息（分批事务执行，杜绝频繁单行 fsync 锁竞争）
 */
function migrate_all_ride_cities(PDO $pdo, int $batchSize = 100): array
{
    require_once __DIR__ . '/geo_resolver.php';
    $stmt = $pdo->query("SELECT id, title, start_lat, start_lng, summary_polyline, city, cities, is_cross_city FROM rides");
    $rides = $stmt->fetchAll();

    $updateStmt = $pdo->prepare("UPDATE rides SET city = ?, cities = ?, is_cross_city = ? WHERE id = ?");
    $cityStats = [];
    $crossCityCount = 0;
    $updatedCount = 0;
    $batchCount = 0;

    $pdo->exec('BEGIN IMMEDIATE TRANSACTION');
    try {
        foreach ($rides as $ride) {
            $info = resolve_ride_cities($ride['start_lat'], $ride['start_lng'], $ride['summary_polyline']);
            $resolvedCity = $info['city'];
            $resolvedCitiesJson = json_encode($info['cities'], JSON_UNESCAPED_UNICODE);
            $resolvedIsCross = $info['is_cross_city'] ? 1 : 0;

            $cityStats[$resolvedCity] = ($cityStats[$resolvedCity] ?? 0) + 1;
            if ($info['is_cross_city']) $crossCityCount++;

            if ($ride['city'] !== $resolvedCity || ($ride['cities'] ?? null) !== $resolvedCitiesJson || (int)($ride['is_cross_city'] ?? 0) !== $resolvedIsCross) {
                $updateStmt->execute([$resolvedCity, $resolvedCitiesJson, $resolvedIsCross, $ride['id']]);
                $updatedCount++;
                $batchCount++;
            }

            if ($batchCount >= $batchSize) {
                $pdo->exec('COMMIT');
                $pdo->exec('BEGIN IMMEDIATE TRANSACTION');
                $batchCount = 0;
            }
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->exec('ROLLBACK');
        }
        throw $e;
    }

    return [
        'total' => count($rides),
        'updated' => $updatedCount,
        'crossCityCount' => $crossCityCount,
        'cityStats' => $cityStats,
    ];
}
```

---

## 6. Verification Method

To independently verify each finding without altering the production database:

1. **Verify WAL/SHM file exposure (SEC-01)**:
   ```bash
   # In Apache/Nginx web server environment:
   curl -I http://localhost/cycling.db-wal
   curl -I http://localhost/cycling.db-shm
   # Expected without fix: HTTP 200 OK (file downloaded)
   # Expected with fix: HTTP 403 Forbidden
   ```
2. **Verify DDL Execution on Every Request (CONC-01)**:
   ```bash
   php -r "
   require 'php_backend/config.php';
   require 'php_backend/database.php';
   require 'php_backend/dbInit.php';
   \$pdo = get_db_connection();
   \$start = microtime(true);
   ensure_tables(\$pdo);
   echo 'Time: ' . (microtime(true) - \$start) . 's\n';
   "
   ```
   Inspect SQLite statement executions by enabling query logging (`PDO::ATTR_STATEMENT_CLASS`).
3. **Verify Concurrency Lock Deadlock (CONC-02)**:
   Run 2 concurrent PHP CLI scripts executing `BEGIN` + `SELECT` + `UPDATE` on `rides` to reproduce `SQLITE_BUSY`.
4. **Verify Incremental Sync Detail Points Ingestion (SYNC-01)**:
   - Call `POST /api/admin/rides` -> record `updated_at`.
   - Call `POST /api/admin/rides/:id/detail-points` -> verify that `rides.updated_at` remained unchanged in SQLite.
   - Call `GET /api/sync?since=<updated_at>` -> observe that the ride with updated detail points is not returned.
5. **Verify Syntax & Linting**:
   ```powershell
   Get-ChildItem -Path php_backend -Filter *.php -Recurse | ForEach-Object { php -l $_.FullName }
   ```
