<?php

// php_backend/routes/rider.php
// 照搬 packages/api/src/services/riderService.ts + routes/aiProfile.ts（profile/memories 部分）

// GET /api/ai/rider/profile — 档案 + 记忆（照搬 aiProfile.ts:18-28，前端 RiderProfileDrawer 同请求取两者）
route('GET', '/api/ai/rider/profile', function (array $p) {
    $pdo = get_db_connection();
    $profile = db_first($pdo, 'SELECT * FROM rider_profile WHERE id = 1');
    if (!$profile) send_json(['profile' => null, 'memories' => []]);

    $profile['bike_weight_kg'] = (isset($profile['bike_weight_kg']) && is_numeric($profile['bike_weight_kg']))
        ? (float)$profile['bike_weight_kg']
        : 11.5;
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
        if (is_array($decoded)) {
            $mergedSpecs = $decoded;
        } else {
            $mergedSpecs = ['notes' => $rawCur];
        }
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

    $tires = $data['tires'] ?? $cur['tires'];
    $bikeWeight = (isset($data['bike_weight_kg']) && is_numeric($data['bike_weight_kg']))
        ? (float)$data['bike_weight_kg']
        : ((isset($cur['bike_weight_kg']) && is_numeric($cur['bike_weight_kg'])) ? (float)$cur['bike_weight_kg'] : 11.5);

    // 结构化传动参数（替代自由文本 gear_ratio/bike_specs）
    $chainring = isset($data['chainring']) ? (int)$data['chainring'] : (int)$cur['chainring'];
    $wheelSpec = $data['wheel_spec'] ?? $cur['wheel_spec'];
    // cogs：前端传数组则 json_encode 存，否则保留既有 JSON 文本
    $cogsRaw = $cur['cogs'] ?? '[11,13,15,17,19,21,24,28]';
    if (isset($data['cogs'])) {
        if (is_array($data['cogs'])) {
            $cogsJson = json_encode(array_values(array_map('intval', $data['cogs'])));
        } else {
            $decoded = json_decode($data['cogs'], true);
            $cogsJson = is_array($decoded)
                ? json_encode(array_values(array_map('intval', $decoded)))
                : $cogsRaw;
        }
    } else {
        $cogsJson = $cogsRaw;
    }

    $fields = ['name', 'gender', 'current_bike', 'primary_goal'];
    $vals = [];
    foreach ($fields as $f) {
        $vals[$f] = $data[$f] ?? $cur[$f];
    }

    db_run($pdo, 'UPDATE rider_profile SET
        name = ?, gender = ?, weight_kg = ?, height_cm = ?, max_hr = ?, resting_hr = ?, ftp_watts = ?,
        current_bike = ?, chainring = ?, cogs = ?, wheel_spec = ?, tires = ?, bike_weight_kg = ?, custom_specs = ?,
        primary_goal = ?, updated_at = unixepoch() WHERE id = 1', [
        $vals['name'],
        $vals['gender'],
        (isset($data['weight_kg']) && is_numeric($data['weight_kg'])) ? (float)$data['weight_kg'] : ((isset($cur['weight_kg']) && is_numeric($cur['weight_kg'])) ? (float)$cur['weight_kg'] : 75.0),
        (isset($data['height_cm']) && is_numeric($data['height_cm'])) ? (float)$data['height_cm'] : ((isset($cur['height_cm']) && is_numeric($cur['height_cm'])) ? (float)$cur['height_cm'] : 173.0),
        isset($data['max_hr']) ? (int)$data['max_hr'] : (int)$cur['max_hr'],
        isset($data['resting_hr']) ? (int)$data['resting_hr'] : (int)$cur['resting_hr'],
        isset($data['ftp_watts']) ? (int)$data['ftp_watts'] : (int)$cur['ftp_watts'],
        $vals['current_bike'],
        $chainring,
        $cogsJson,
        $wheelSpec,
        $tires,
        $bikeWeight,
        json_encode($mergedSpecs, JSON_UNESCAPED_UNICODE),
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
// 软删防回流：命中 is_active=0 的已删行时不复活，拒绝写入（triggerMemoryReflection 再提炼同内容也存不回）
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
    $existing = db_first($pdo, 'SELECT id, content, is_active FROM rider_memories WHERE memory_key = ? OR content = ? LIMIT 1', [$key, $content]);
    if ($existing) {
        // 命中软删行：尊重删除决定，不复活、不更新，静默拒绝
        if ((int)$existing['is_active'] === 0) {
            send_json(['success' => true, 'id' => (int)$existing['id'], 'suppressed' => true]);
        }
        db_run($pdo, 'UPDATE rider_memories SET category = ?, content = ?, source = ?, importance = ?, is_active = 1, updated_at = unixepoch() WHERE id = ?',
            [$normalizedCat, $content, $source, $importance, $existing['id']]);
        send_json(['success' => true, 'id' => (int)$existing['id']]);
    }
    db_run($pdo, 'INSERT INTO rider_memories (category, memory_key, content, source, importance, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())',
        [$normalizedCat, trim($key), $content, $source, $importance]);
    send_json(['success' => true, 'id' => db_last_insert_id($pdo)]);
});

// DELETE /api/ai/rider/memories/:id — 软删（is_active=0），防止反思回流复活
route('DELETE', '/api/ai/rider/memories/:id', function (array $p) {
    $pdo = get_db_connection();
    db_run($pdo, 'UPDATE rider_memories SET is_active = 0, updated_at = unixepoch() WHERE id = ?', [(int)$p['id']]);
    send_json(['success' => true]);
});
