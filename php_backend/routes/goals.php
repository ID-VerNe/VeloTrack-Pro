<?php

// php_backend/routes/goals.php
// 照搬 packages/api/src/routes/aiProfile.ts (goals) + riderService.ts (training_goals/milestones)

// GET /api/ai/goals — 训练目标 + 档案 + 里程碑
route('GET', '/api/ai/goals', function (array $p) {
    $pdo = get_db_connection();
    $goals = db_first($pdo, 'SELECT * FROM training_goals WHERE id = 1');
    $profile = db_first($pdo, 'SELECT * FROM rider_profile WHERE id = 1');
    $milestones = db_all($pdo, 'SELECT * FROM goal_milestones ORDER BY created_at DESC LIMIT 5')['results'];
    send_json(['goals' => $goals, 'profile' => $profile, 'milestones' => $milestones]);
});

// PUT /api/ai/goals — 更新训练目标
route('PUT', '/api/ai/goals', function (array $p) {
    $body = read_json_body();
    $pdo = get_db_connection();
    $cur = db_first($pdo, 'SELECT * FROM training_goals WHERE id = 1');

    $merged = [
        'weekly_distance_km' => isset($body['weekly_distance_km']) ? (float)$body['weekly_distance_km'] : (float)$cur['weekly_distance_km'],
        'target_avg_speed_kmh' => isset($body['target_avg_speed_kmh']) ? (float)$body['target_avg_speed_kmh'] : (float)$cur['target_avg_speed_kmh'],
        'monthly_distance_km' => isset($body['monthly_distance_km']) ? (float)$body['monthly_distance_km'] : (float)$cur['monthly_distance_km'],
        'annual_distance_km' => isset($body['annual_distance_km']) ? (float)$body['annual_distance_km'] : (float)$cur['annual_distance_km'],
        'coach_notes' => $body['coach_notes'] ?? $cur['coach_notes'],
    ];

    db_run($pdo, 'UPDATE training_goals SET weekly_distance_km = ?, target_avg_speed_kmh = ?, monthly_distance_km = ?, annual_distance_km = ?, coach_notes = ?, updated_at = unixepoch() WHERE id = 1', [
        $merged['weekly_distance_km'], $merged['target_avg_speed_kmh'], $merged['monthly_distance_km'], $merged['annual_distance_km'], $merged['coach_notes'],
    ]);

    if (!empty($body['primary_goal'])) {
        db_run($pdo, 'UPDATE rider_profile SET primary_goal = ?, updated_at = unixepoch() WHERE id = 1', [$body['primary_goal']]);
    }

    send_json(['success' => true, 'message' => '训练目标已保存', 'goals' => $merged]);
});

// POST /api/ai/goals/milestones — 新增里程碑
route('POST', '/api/ai/goals/milestones', function (array $p) {
    $body = read_json_body();
    $pdo = get_db_connection();
    $weekly = (float)($body['weekly_distance_km'] ?? 60);
    $targetSpeed = (float)($body['target_avg_speed_kmh'] ?? 18);
    $monthly = isset($body['monthly_distance_km']) ? (float)$body['monthly_distance_km'] : $weekly * 3;
    $primaryGoal = $body['primary_goal'] ?? '';
    $rationale = mb_substr($body['rationale'] ?? '', 0, 100);
    $source = $body['source'] ?? 'coach';

    db_run($pdo, 'INSERT INTO goal_milestones (weekly_distance_km, target_avg_speed_kmh, monthly_distance_km, primary_goal, rationale, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, unixepoch())', [$weekly, $targetSpeed, $monthly, $primaryGoal, $rationale, $source]);
    send_json(['success' => true, 'id' => db_last_insert_id($pdo)]);
});
