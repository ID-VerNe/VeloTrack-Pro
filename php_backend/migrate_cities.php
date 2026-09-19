<?php

// php_backend/migrate_cities.php
// 历史骑行记录城市与跨城字段回填迁移脚本

@set_time_limit(0);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/dbInit.php';
require_once __DIR__ . '/utils/geo_resolver.php';

echo "=== 开始骑行记录城市与跨城多维迁移回填 ===" . PHP_EOL;

$pdo = get_db_connection();

// 确保表结构已更新
ensure_tables($pdo);

$stmt = $pdo->query("SELECT id, title, start_lat, start_lng, summary_polyline, city, cities, is_cross_city FROM rides");
$rides = $stmt->fetchAll();

echo "总计发现 " . count($rides) . " 条骑行记录。" . PHP_EOL;

$updateStmt = $pdo->prepare("UPDATE rides SET city = ?, cities = ?, is_cross_city = ? WHERE id = ?");
$cityStats = [];
$crossCount = 0;
$updatedCount = 0;

foreach ($rides as $ride) {
    $info = resolve_ride_cities($ride['start_lat'], $ride['start_lng'], $ride['summary_polyline']);
    $resolvedCity = $info['city'];
    $resolvedCitiesJson = json_encode($info['cities'], JSON_UNESCAPED_UNICODE);
    $resolvedIsCross = $info['is_cross_city'] ? 1 : 0;

    $cityStats[$resolvedCity] = ($cityStats[$resolvedCity] ?? 0) + 1;
    if ($info['is_cross_city']) {
        $crossCount++;
    }

    if ($ride['city'] !== $resolvedCity || ($ride['cities'] ?? null) !== $resolvedCitiesJson || (int)($ride['is_cross_city'] ?? 0) !== $resolvedIsCross) {
        $updateStmt->execute([$resolvedCity, $resolvedCitiesJson, $resolvedIsCross, $ride['id']]);
        $updatedCount++;
    }
}

echo "迁移完成！本次更新行数: {$updatedCount}，其中跨城骑行: {$crossCount} 次" . PHP_EOL;
echo "--- 城市分布统计 ---" . PHP_EOL;
foreach ($cityStats as $cityName => $count) {
    echo "  {$cityName}: {$count} 次" . PHP_EOL;
}
echo "==================================" . PHP_EOL;
