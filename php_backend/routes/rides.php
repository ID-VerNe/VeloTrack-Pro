<?php

// php_backend/routes/rides.php
// 骑行记录 CRUD，照搬 packages/api/src/routes/rides.ts

// GET /api/rides — 列表（摘要字段，不含 detail_points，排除软删除墓碑）
route('GET', '/api/rides', function (array $p) {
    require_once __DIR__ . '/../utils/ride_helper.php';
    $pdo = get_db_connection();
    $rows = db_all($pdo, '
        SELECT id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds,
               distance_meters, summary_polyline, total_ascent_meters, avg_speed_kmh,
               max_speed_kmh, avg_heart_rate, start_lat, start_lng, city, cities, is_cross_city,
               updated_at, created_at
        FROM rides 
        WHERE deleted_at IS NULL 
        ORDER BY start_time DESC
    ')['results'];

    foreach ($rows as &$row) {
        format_ride_row($row);
    }
    unset($row);

    send_json(['rides' => $rows]);
});

// GET /api/migrate-cities — 重新用高德官方多边形与跨城算法校准所有骑行记录
route('GET', '/api/migrate-cities', function (array $p) {
    @set_time_limit(0);
    $pdo = get_db_connection();
    require_once __DIR__ . '/../utils/geo_resolver.php';
    $stmt = $pdo->query("SELECT id, title, start_lat, start_lng, summary_polyline, city, cities, is_cross_city FROM rides");
    $rides = $stmt->fetchAll();
    $updateStmt = $pdo->prepare("UPDATE rides SET city = ?, cities = ?, is_cross_city = ? WHERE id = ?");
    $cityStats = [];
    $crossCityCount = 0;
    $updatedCount = 0;
    foreach ($rides as $ride) {
        $info = resolve_ride_cities($ride['start_lat'], $ride['start_lng'], $ride['summary_polyline']);
        $resolvedCity = $info['city'];
        $resolvedCitiesJson = json_encode($info['cities'], JSON_UNESCAPED_UNICODE);
        $resolvedIsCross = $info['is_cross_city'] ? 1 : 0;

        $cityStats[$resolvedCity] = ($cityStats[$resolvedCity] ?? 0) + 1;
        if ($info['is_cross_city']) {
            $crossCityCount++;
        }

        if ($ride['city'] !== $resolvedCity || ($ride['cities'] ?? null) !== $resolvedCitiesJson || (int)($ride['is_cross_city'] ?? 0) !== $resolvedIsCross) {
            $updateStmt->execute([$resolvedCity, $resolvedCitiesJson, $resolvedIsCross, $ride['id']]);
            $updatedCount++;
        }
    }
    send_json([
        'success' => true,
        'total' => count($rides),
        'updated' => $updatedCount,
        'crossCityCount' => $crossCityCount,
        'cityStats' => $cityStats
    ]);
});

// GET /api/rides/:id — 详情（含 detail_points TEXT，json_decode 返回）
route('GET', '/api/rides/:id', function (array $p) {
    require_once __DIR__ . '/../utils/ride_helper.php';
    $pdo = get_db_connection();
    $ride = db_first($pdo, 'SELECT * FROM rides WHERE id = ? AND deleted_at IS NULL', [$p['id']]);
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

    format_ride_row($ride);

    send_json(['ride' => $ride, 'detailPoints' => $detailPoints]);
});

// PATCH /api/rides/:id — 改标题（更新 updated_at 毫秒时间戳）
route('PATCH', '/api/rides/:id', function (array $p) {
    $pdo = get_db_connection();
    $body = read_json_body();
    $title = trim($body['title'] ?? '');
    if ($title === '') send_error('Title cannot be empty', 400);
    $now = (int)(microtime(true) * 1000);
    db_run($pdo, 'UPDATE rides SET title = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [$title, $now, $p['id']]);
    send_json(['success' => true, 'title' => $title, 'updated_at' => $now]);
});

// DELETE /api/rides/:id — 软删除墓碑（更新 deleted_at 与 updated_at）
route('DELETE', '/api/rides/:id', function (array $p) {
    $pdo = get_db_connection();
    $ride = db_first($pdo, 'SELECT id FROM rides WHERE id = ? AND deleted_at IS NULL', [$p['id']]);
    if (!$ride) send_error('Ride not found', 404);
    $now = (int)(microtime(true) * 1000);
    db_run($pdo, 'UPDATE rides SET deleted_at = ?, updated_at = ? WHERE id = ?', [$now, $now, $p['id']]);
    send_json(['success' => true, 'id' => $p['id'], 'deleted_at' => $now]);
});
