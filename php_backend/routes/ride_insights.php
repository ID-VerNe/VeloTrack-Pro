<?php

// php_backend/routes/ride_insights.php
// 照搬 packages/api/src/routes/aiInsights.ts 的缓存读写（AI 生成已移至前端）
// 前端生成 insight 后调 POST 写缓存；GET 取缓存做 content_hash 校验

// GET /api/ai/rides/:rideId/insight — 取缓存
route('GET', '/api/ai/rides/:rideId/insight', function (array $p) {
    $pdo = get_db_connection();
    $row = db_first($pdo, 'SELECT insight, content_hash FROM ride_insights WHERE ride_id = ?', [$p['rideId']]);
    if (!$row) send_json(['insight' => null, 'cached' => false]);
    send_json(['insight' => $row['insight'], 'content_hash' => $row['content_hash'], 'cached' => true]);
});

// POST /api/ai/rides/:rideId/insight — 写/更新缓存
// body: { content_hash, insight }
route('POST', '/api/ai/rides/:rideId/insight', function (array $p) {
    $body = read_json_body();
    $hash = $body['content_hash'] ?? '';
    $insight = $body['insight'] ?? '';
    if ($hash === '' || $insight === '') send_error('content_hash 与 insight 不能为空', 400);

    $pdo = get_db_connection();
    db_run($pdo, 'INSERT INTO ride_insights (ride_id, content_hash, insight, created_at)
        VALUES (?, ?, ?, unixepoch())
        ON CONFLICT(ride_id) DO UPDATE SET content_hash = excluded.content_hash, insight = excluded.insight, created_at = excluded.created_at',
        [$p['rideId'], $hash, $insight]);
    send_json(['success' => true]);
});
