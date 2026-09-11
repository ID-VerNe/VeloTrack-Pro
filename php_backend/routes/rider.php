<?php

// php_backend/routes/rider.php
// 照搬 packages/api/src/services/riderService.ts + routes/aiProfile.ts（profile/memories 部分）

// GET /api/ai/rider/profile — 档案 + 记忆（照搬 aiProfile.ts:18-28，前端 RiderProfileDrawer 同请求取两者）
route('GET', '/api/ai/rider/profile', function (array $p) {
    $pdo = get_db_connection();
    $profile = db_first($pdo, 'SELECT * FROM rider_profile WHERE id = 1');
    if (!$profile) send_json(['profile' => null, 'memories' => []]);

    $profile['bike_weight_kg'] = $profile['bike_weight_kg'] ? (float)$profile['bike_weight_kg'] : 11.5;
    $memories = db_all($pdo, 'SELECT * FROM rider_memories ORDER BY is_active DESC, importance DESC, created_at DESC')['results'];
    send_json(['profile' => $profile, 'memories' => $memories]);
});

// PUT /api/ai/rider/profile — 局部合并（保留既有字段），照搬 updateRiderProfile
route('PUT', '/api/ai/rider/profile', function (array $p) {
    $data = read_json_body();
    $pdo = get_db_connection();
    $cur = db_first($pdo, 'SELECT * FROM rider_profile WHERE id = 1');
    if (!$cur) send_error('rider_profile not initialized', 500);

    // custom_specs 局部合并
    $mergedSpecs = [];
    $rawCur = $cur['custom_specs'] ?? '';
    if (is_string($rawCur) && $rawCur !== '') {
        $decoded = json_decode($rawCur, true);
        if (is_array($decoded)) $mergedSpecs = $decoded;
    } elseif (is_string($rawCur) && $rawCur !== '') {
        $mergedSpecs = ['notes' => $rawCur];
    }
    if (isset($data['custom_specs'])) {
        $cs = $data['custom_specs'];
        if (is_string($cs)) {
            $parsed = json_decode($cs, true);
            if (is_array($parsed)) $mergedSpecs = array_merge($mergedSpecs, $parsed);
            else $mergedSpecs['notes'] = $cs;
        } elseif (is_array($cs)) {
            $mergedSpecs = array_merge($mergedSpecs, $cs);
        }
    }

    $gear = $data['gear_ratio'] ?? $cur['gear_ratio'];
    $tires = $data['tires'] ?? $cur['tires'];
    $bikeWeight = isset($data['bike_weight_kg']) ? (float)$data['bike_weight_kg'] : (float)$cur['bike_weight_kg'];

    // bike_specs 综合合成
    $parts = [];
    if ($gear) $parts[] = $gear;
    if ($tires) $parts[] = $tires;
    if ($bikeWeight) $parts[] = "车重{$bikeWeight}kg";
    foreach ($mergedSpecs as $k => $v) {
        if (is_string($v) && $v !== '') $parts[] = "$k: $v";
    }
    $bikeSpecs = (isset($data['bike_specs']) && str_contains($data['bike_specs'], '|'))
        ? $data['bike_specs']
        : (count($parts) > 0 ? implode(' | ', $parts) : ($data['bike_specs'] ?? $cur['bike_specs']));

    $fields = ['name', 'gender', 'current_bike', 'injuries_notes', 'primary_goal'];
    $vals = [];
    foreach ($fields as $f) {
        $vals[$f] = $data[$f] ?? $cur[$f];
    }

    db_run($pdo, 'UPDATE rider_profile SET
        name = ?, gender = ?, weight_kg = ?, height_cm = ?, max_hr = ?, resting_hr = ?, ftp_watts = ?,
        current_bike = ?, gear_ratio = ?, tires = ?, bike_weight_kg = ?, bike_specs = ?, custom_specs = ?,
        injuries_notes = ?, primary_goal = ?, updated_at = unixepoch() WHERE id = 1', [
        $vals['name'],
        $vals['gender'],
        isset($data['weight_kg']) ? (float)$data['weight_kg'] : (float)$cur['weight_kg'],
        isset($data['height_cm']) ? (float)$data['height_cm'] : (float)$cur['height_cm'],
        isset($data['max_hr']) ? (int)$data['max_hr'] : (int)$cur['max_hr'],
        isset($data['resting_hr']) ? (int)$data['resting_hr'] : (int)$cur['resting_hr'],
        isset($data['ftp_watts']) ? (int)$data['ftp_watts'] : (int)$cur['ftp_watts'],
        $vals['current_bike'],
        $gear,
        $tires,
        $bikeWeight,
        $bikeSpecs,
        json_encode($mergedSpecs, JSON_UNESCAPED_UNICODE),
        $vals['injuries_notes'],
        $vals['primary_goal'],
    ]);

    $updated = db_first($pdo, 'SELECT * FROM rider_profile WHERE id = 1');
    send_json(['success' => true, 'message' => '车手档案已保存', 'profile' => $updated]);
});

// GET /api/ai/rider/memories
route('GET', '/api/ai/rider/memories', function (array $p) {
    $pdo = get_db_connection();
    $rows = db_all($pdo, 'SELECT * FROM rider_memories ORDER BY is_active DESC, importance DESC, created_at DESC')['results'];
    send_json(['memories' => $rows]);
});

// POST /api/ai/rider/memories — upsert（去重 + 合并），照搬 upsertRiderMemory
route('POST', '/api/ai/rider/memories', function (array $p) {
    $body = read_json_body();
    $content = trim($body['content'] ?? '');
    if ($content === '') send_error('Memory content cannot be empty', 400);

    $category = $body['category'] ?? 'habit';
    $key = $body['memory_key'] ?? 'custom_fact';
    $source = $body['source'] ?? 'manual';
    $importance = isset($body['importance']) ? (int)$body['importance'] : 3;

    // 归一化分类
    $normalizedCat = $category;
    if ($category === 'physiology') $normalizedCat = 'health';
    if ($category === 'coaching' || $category === 'goal') $normalizedCat = 'preference';

    $pdo = get_db_connection();
    $existing = db_first($pdo, 'SELECT id, content FROM rider_memories WHERE memory_key = ? OR content = ? LIMIT 1', [$key, $content]);
    if ($existing) {
        db_run($pdo, 'UPDATE rider_memories SET category = ?, content = ?, source = ?, importance = ?, is_active = 1, updated_at = unixepoch() WHERE id = ?',
            [$normalizedCat, $content, $source, $importance, $existing['id']]);
        send_json(['success' => true, 'id' => (int)$existing['id']]);
    }
    db_run($pdo, 'INSERT INTO rider_memories (category, memory_key, content, source, importance, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())',
        [$normalizedCat, trim($key), $content, $source, $importance]);
    send_json(['success' => true, 'id' => db_last_insert_id($pdo)]);
});

// DELETE /api/ai/rider/memories/:id
route('DELETE', '/api/ai/rider/memories/:id', function (array $p) {
    $pdo = get_db_connection();
    db_run($pdo, 'DELETE FROM rider_memories WHERE id = ?', [(int)$p['id']]);
    send_json(['success' => true]);
});
