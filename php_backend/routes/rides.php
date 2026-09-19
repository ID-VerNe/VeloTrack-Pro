<?php

// php_backend/routes/rides.php
// 骑行记录 CRUD，照搬 packages/api/src/routes/rides.ts

// GET /api/rides — 列表（摘要字段，不含 detail_points）
route('GET', '/api/rides', function (array $p) {
    $pdo = get_db_connection();
    $rows = db_all($pdo, '
        SELECT id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds,
               distance_meters, summary_polyline, total_ascent_meters, avg_speed_kmh,
               max_speed_kmh, avg_heart_rate, start_lat, start_lng, city, cities, is_cross_city
        FROM rides ORDER BY start_time DESC
    ')['results'];

    foreach ($rows as &$row) {
        $citiesArr = [];
        if (!empty($row['cities'])) {
            $decoded = json_decode($row['cities'], true);
            if (is_array($decoded)) {
                $citiesArr = $decoded;
            }
        }
        if (empty($citiesArr)) {
            if (!empty($row['city'])) {
                $parts = preg_split('/\s*(?:→|⇄|->)\s*/u', $row['city']);
                $citiesArr = array_values(array_unique(array_filter($parts)));
            } else {
                $citiesArr = ['其他城市'];
            }
        }
        $row['cities'] = $citiesArr;
        $row['is_cross_city'] = !empty($row['is_cross_city']) || (count($citiesArr) > 1);
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

    $citiesArr = [];
    if (!empty($ride['cities'])) {
        $decoded = json_decode($ride['cities'], true);
        if (is_array($decoded)) {
            $citiesArr = $decoded;
        }
    }
    if (empty($citiesArr)) {
        if (!empty($ride['city'])) {
            $parts = preg_split('/\s*(?:→|⇄|->)\s*/u', $ride['city']);
            $citiesArr = array_values(array_unique(array_filter($parts)));
        } else {
            $citiesArr = ['其他城市'];
        }
    }
    $ride['cities'] = $citiesArr;
    $ride['is_cross_city'] = !empty($ride['is_cross_city']) || (count($citiesArr) > 1);

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
