<?php

// php_backend/routes/sync.php
// 多端增量同步引擎：Watermark 增量拉取 + 离线发件箱推送 (LWW + 墓碑优先)

require_once __DIR__ . '/../utils/ride_helper.php';

// GET /api/sync — 增量拉取（基于高水位游标 since）
route('GET', '/api/sync', function (array $p) {
    $pdo = get_db_connection();
    $since = isset($_GET['since']) && is_numeric($_GET['since']) ? (int)$_GET['since'] : 0;
    $serverTime = (int)(microtime(true) * 1000);

    if ($since <= 0) {
        // 冷启动首屏全量初始化：只拉未删除记录，避免拉取远古墓碑
        $rows = db_all($pdo, '
            SELECT id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds,
                   distance_meters, summary_polyline, total_ascent_meters, avg_speed_kmh,
                   max_speed_kmh, avg_heart_rate, start_lat, start_lng, city, cities, is_cross_city,
                   updated_at, created_at, deleted_at
            FROM rides
            WHERE deleted_at IS NULL
            ORDER BY start_time DESC
        ')['results'];
    } else {
        // 增量同步：带 1000ms 重叠安全窗口，防止并发边界漏拉
        $safeSince = max(0, $since - 1000);
        $rows = db_all($pdo, '
            SELECT id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds,
                   distance_meters, summary_polyline, total_ascent_meters, avg_speed_kmh,
                   max_speed_kmh, avg_heart_rate, start_lat, start_lng, city, cities, is_cross_city,
                   updated_at, created_at, deleted_at
            FROM rides
            WHERE (updated_at >= ? OR (deleted_at IS NOT NULL AND deleted_at >= ?))
            ORDER BY start_time DESC
        ', [$safeSince, $safeSince])['results'];
    }

    foreach ($rows as &$row) {
        format_ride_row($row);
    }
    unset($row);

    send_json([
        'rides' => $rows,
        'server_time' => $serverTime,
        'count' => count($rows),
    ]);
});

// POST /api/sync/push — 发件箱批量处理（事务执行 + 墓碑优先 + LWW）
route('POST', '/api/sync/push', function (array $p) {
    $pdo = get_db_connection();
    $body = read_json_body();
    $mutations = $body['mutations'] ?? [];

    if (!is_array($mutations) || empty($mutations)) {
        send_json([
            'success' => true,
            'server_time' => (int)(microtime(true) * 1000),
            'applied' => 0,
            'results' => [],
        ]);
    }

    $serverTime = (int)(microtime(true) * 1000);
    $results = [];
    $appliedCount = 0;

    $pdo->beginTransaction();
    try {
        foreach ($mutations as $m) {
            $mId = $m['mutation_id'] ?? ('m_' . bin2hex(random_bytes(4)));
            $action = $m['action'] ?? '';
            $payload = $m['payload'] ?? [];
            $rideId = $payload['id'] ?? '';

            if (empty($rideId)) {
                $results[] = ['mutation_id' => $mId, 'status' => 'rejected', 'reason' => 'missing_id'];
                continue;
            }

            $current = db_first($pdo, 'SELECT id, updated_at, deleted_at FROM rides WHERE id = ?', [$rideId]);

            if ($action === 'UPDATE_TITLE') {
                $newTitle = trim($payload['title'] ?? '');
                $clientUpdated = (int)($payload['client_updated_at'] ?? 0);

                if ($newTitle === '') {
                    $results[] = ['mutation_id' => $mId, 'status' => 'rejected', 'reason' => 'empty_title'];
                    continue;
                }

                if (!$current) {
                    $results[] = ['mutation_id' => $mId, 'status' => 'rejected', 'reason' => 'not_found'];
                    continue;
                }

                // 规则 1：墓碑优先 (Delete Wins)
                if (!empty($current['deleted_at'])) {
                    $results[] = ['mutation_id' => $mId, 'status' => 'rejected', 'reason' => 'already_deleted'];
                    continue;
                }

                // 规则 2：最后写入胜出 (LWW)
                $dbUpdated = (int)($current['updated_at'] ?? 0);
                if ($clientUpdated >= $dbUpdated) {
                    $now = max($clientUpdated, $serverTime);
                    db_run($pdo, 'UPDATE rides SET title = ?, updated_at = ? WHERE id = ?', [$newTitle, $now, $rideId]);
                    $results[] = ['mutation_id' => $mId, 'status' => 'applied'];
                    $appliedCount++;
                } else {
                    $results[] = ['mutation_id' => $mId, 'status' => 'rejected', 'reason' => 'lww_conflict'];
                }

            } elseif ($action === 'DELETE_RIDE') {
                $clientDeleted = (int)($payload['client_deleted_at'] ?? 0);

                if (!$current) {
                    // 幂等：若服务端本就不存在，视为已删除成功
                    $results[] = ['mutation_id' => $mId, 'status' => 'applied', 'note' => 'already_absent'];
                    $appliedCount++;
                    continue;
                }

                // 墓碑标记
                $now = max($clientDeleted, $serverTime);
                db_run($pdo, 'UPDATE rides SET deleted_at = ?, updated_at = ? WHERE id = ?', [$now, $now, $rideId]);
                $results[] = ['mutation_id' => $mId, 'status' => 'applied'];
                $appliedCount++;

            } else {
                $results[] = ['mutation_id' => $mId, 'status' => 'rejected', 'reason' => 'unknown_action'];
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        send_error('Push sync transaction failed: ' . $e->getMessage(), 500);
    }

    send_json([
        'success' => true,
        'server_time' => $serverTime,
        'applied' => $appliedCount,
        'results' => $results,
    ]);
});
