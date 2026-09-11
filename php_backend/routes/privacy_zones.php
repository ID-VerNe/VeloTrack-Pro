<?php

// php_backend/routes/privacy_zones.php
// 照搬 packages/api/src/routes/admin.ts:7-32

route('GET', '/api/admin/privacy-zones', function (array $p) {
    $pdo = get_db_connection();
    $rows = db_all($pdo, 'SELECT * FROM privacy_zones')['results'];
    send_json(['zones' => $rows]);
});

route('POST', '/api/admin/privacy-zones', function (array $p) {
    $body = read_json_body();
    $id = $body['id'] ?? '';
    $name = trim($body['name'] ?? '');
    if ($id === '' || $name === '') send_error('id 与 name 不能为空', 400);

    $lat = (float)($body['latitude'] ?? NAN);
    $lng = (float)($body['longitude'] ?? NAN);
    $radius = (float)($body['radius_meters'] ?? NAN);
    if (!is_finite($lat) || $lat < -90 || $lat > 90 ||
        !is_finite($lng) || $lng < -180 || $lng > 180 ||
        !is_finite($radius) || $radius <= 0 || $radius > 10000) {
        send_error('坐标或半径数值非法', 400);
    }

    $pdo = get_db_connection();
    db_run($pdo, 'INSERT INTO privacy_zones (id, name, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude, radius_meters=excluded.radius_meters',
        [$id, $name, $lat, $lng, $radius]);
    send_json(['success' => true]);
});
