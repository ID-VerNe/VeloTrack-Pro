<?php

// php_backend/routes/rides.php
// 骑行记录 CRUD，照搬 packages/api/src/routes/rides.ts

// GET /api/rides — 列表（摘要字段，不含 detail_points）
route('GET', '/api/rides', function (array $p) {
    $pdo = get_db_connection();
    $rows = db_all($pdo, '
        SELECT id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds,
               distance_meters, summary_polyline, total_ascent_meters, avg_speed_kmh,
               max_speed_kmh, avg_heart_rate
        FROM rides ORDER BY start_time DESC
    ')['results'];
    send_json(['rides' => $rows]);
});

// GET /api/rides/:id — 详情（含 detail_points TEXT，json_decode 返回）
route('GET', '/api/rides/:id', function (array $p) {
    $pdo = get_db_connection();
    $ride = db_first($pdo, 'SELECT * FROM rides WHERE id = ?', [$p['id']]);
    if (!$ride) send_error('Ride not found', 404);

    $detailPoints = null;
    if (!empty($ride['detail_points'])) {
        $decoded = json_decode($ride['detail_points'], true);
        if (isset($decoded['points']) && is_array($decoded['points'])) {
            $detailPoints = $decoded['points'];
        }
    }
    // 不回传 detail_points 原始 TEXT，前端只认 detailPoints 字段
    unset($ride['detail_points']);
    send_json(['ride' => $ride, 'detailPoints' => $detailPoints]);
});

// PATCH /api/rides/:id — 改标题
route('PATCH', '/api/rides/:id', function (array $p) {
    $pdo = get_db_connection();
    $body = read_json_body();
    $title = trim($body['title'] ?? '');
    if ($title === '') send_error('Title cannot be empty', 400);
    db_run($pdo, 'UPDATE rides SET title = ? WHERE id = ?', [$title, $p['id']]);
    send_json(['success' => true, 'title' => $title]);
});

// DELETE /api/rides/:id — 删记录（需要 ADMIN_TOKEN 鉴权）
route('DELETE', '/api/rides/:id', function (array $p) {
    $pdo = get_db_connection();
    $ride = db_first($pdo, 'SELECT id FROM rides WHERE id = ?', [$p['id']]);
    if (!$ride) send_error('Ride not found', 404);
    db_run($pdo, 'DELETE FROM rides WHERE id = ?', [$p['id']]);
    send_json(['success' => true, 'id' => $p['id']]);
});
