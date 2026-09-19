<?php

// php_backend/routes/admin_rides.php
// 骑行上传与明细，照搬 packages/api/src/routes/admin.ts

// 输入数值规范化：非法/空 → null，并 clamp 到上限，照搬 admin.ts 的 num()
function num_or_null($v, float $max = PHP_FLOAT_MAX): ?float
{
    if ($v === null || $v === '') return null;
    $n = is_numeric($v) ? (float)$v : NAN;
    if (is_nan($n)) return null;
    $n = min(max($n, -$max), $max);
    return $n;
}

// POST /api/admin/rides — upsert 主记录（ON CONFLICT，保留 title 与 created_at）
route('POST', '/api/admin/rides', function (array $p) {
    $data = read_json_body();
    if (empty($data['id']) || !is_string($data['id'])) send_error('id 不能为空', 400);
    if (!is_numeric($data['start_time'] ?? null) || (float)$data['start_time'] <= 0) {
        send_error('start_time 必须是有效时间戳', 400);
    }

    $pdo = get_db_connection();

    $id = $data['id'];
    $rawStart = (float)$data['start_time'];
    $startSec = (int)($rawStart > 1e11 ? $rawStart / 1000 : $rawStart);
    $title = !empty($data['title']) ? $data['title'] : ('骑行 ' . date('Y/m/d', $startSec));
    $startTime = num_or_null($data['start_time']);
    $endTime = num_or_null($data['end_time']);
    $elapsed = num_or_null($data['elapsed_time_seconds']);
    $moving = num_or_null($data['moving_time_seconds']);
    $distance = num_or_null($data['distance_meters']);
    $maxSpeed = num_or_null($data['max_speed_kmh']);
    $avgSpeed = num_or_null($data['avg_speed_kmh']);
    $ascent = num_or_null($data['total_ascent_meters']);
    $descent = num_or_null($data['total_descent_meters']);
    $maxAlt = num_or_null($data['max_altitude_meters']);
    $avgHr = num_or_null($data['avg_heart_rate']);
    $maxHr = num_or_null($data['max_heart_rate']);
    $avgCad = num_or_null($data['avg_cadence']);
    $maxCad = num_or_null($data['max_cadence']);
    $cal = num_or_null($data['calories']);
    $z1 = num_or_null($data['hr_z1_seconds']);
    $z2 = num_or_null($data['hr_z2_seconds']);
    $z3 = num_or_null($data['hr_z3_seconds']);
    $z4 = num_or_null($data['hr_z4_seconds']);
    $z5 = num_or_null($data['hr_z5_seconds']);
    $startLat = num_or_null($data['start_lat']);
    $startLng = num_or_null($data['start_lng']);
    $polyline = is_string($data['summary_polyline'] ?? null) ? $data['summary_polyline'] : null;
    require_once __DIR__ . '/../utils/geo_resolver.php';
    $geoInfo = resolve_ride_cities($startLat, $startLng, $polyline);
    $city = $geoInfo['city'];
    $citiesJson = json_encode($geoInfo['cities'], JSON_UNESCAPED_UNICODE);
    $isCrossCity = $geoInfo['is_cross_city'] ? 1 : 0;

    $sql = "INSERT INTO rides (
        id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds,
        distance_meters, max_speed_kmh, avg_speed_kmh, total_ascent_meters, total_descent_meters, max_altitude_meters,
        avg_heart_rate, max_heart_rate, avg_cadence, max_cadence, calories,
        hr_z1_seconds, hr_z2_seconds, hr_z3_seconds, hr_z4_seconds, hr_z5_seconds,
        start_lat, start_lng, summary_polyline, detail_points, city, cities, is_cross_city, created_at
    ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, NULL, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
        start_time=excluded.start_time, end_time=excluded.end_time,
        elapsed_time_seconds=excluded.elapsed_time_seconds, moving_time_seconds=excluded.moving_time_seconds,
        distance_meters=excluded.distance_meters, max_speed_kmh=excluded.max_speed_kmh,
        avg_speed_kmh=excluded.avg_speed_kmh, total_ascent_meters=excluded.total_ascent_meters,
        total_descent_meters=excluded.total_descent_meters, max_altitude_meters=excluded.max_altitude_meters,
        avg_heart_rate=excluded.avg_heart_rate, max_heart_rate=excluded.max_heart_rate,
        avg_cadence=excluded.avg_cadence, max_cadence=excluded.max_cadence, calories=excluded.calories,
        hr_z1_seconds=excluded.hr_z1_seconds, hr_z2_seconds=excluded.hr_z2_seconds,
        hr_z3_seconds=excluded.hr_z3_seconds, hr_z4_seconds=excluded.hr_z4_seconds, hr_z5_seconds=excluded.hr_z5_seconds,
        start_lat=excluded.start_lat, start_lng=excluded.start_lng,
        summary_polyline=excluded.summary_polyline,
        city=excluded.city,
        cities=excluded.cities,
        is_cross_city=excluded.is_cross_city
        -- title 与 created_at 不在更新列表中，重传不覆盖用户修改
    ";

    $params = [
        $id, $title, $startTime, $endTime, $elapsed, $moving,
        $distance, $maxSpeed, $avgSpeed, $ascent, $descent, $maxAlt,
        $avgHr, $maxHr, $avgCad, $maxCad, $cal,
        $z1, $z2, $z3, $z4, $z5,
        $startLat, $startLng, $polyline, $city, $citiesJson, $isCrossCity, $createdAt,
    ];

    db_run($pdo, $sql, $params);
    send_json(['success' => true]);
});

// POST /api/admin/rides/:id/detail-points — 存脱敏降采样明细 JSON（application/json）
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
