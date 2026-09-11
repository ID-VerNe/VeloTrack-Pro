<?php

// php_backend/routes/ai_config.php
// 只存 base_url + model_name（api_key 走 Gateway team key，不存后端）
// 照搬 packages/api/src/routes/aiConfig.ts，删除 api_key 字段

route('GET', '/api/ai/config', function (array $p) {
    $pdo = get_db_connection();
    $row = db_first($pdo, 'SELECT base_url, model_name FROM ai_config WHERE id = 1');
    $base = trim($row['base_url'] ?? '');
    $model = trim($row['model_name'] ?? AI_GATEWAY_MODEL);
    if ($base === '') $base = AI_GATEWAY_BASE;
    send_json([
        'config' => [
            'base_url' => $base,
            'model_name' => $model,
        ],
    ]);
});

route('PUT', '/api/ai/config', function (array $p) {
    $body = read_json_body();
    $baseUrl = trim($body['base_url'] ?? '');
    $modelName = trim($body['model_name'] ?? '');

    if ($baseUrl !== '') {
        $u = parse_url($baseUrl);
        if ($u === false || !isset($u['scheme']) || !in_array(strtolower($u['scheme']), ['http', 'https'], true)) {
            send_error('base_url 必须是合法的 http/https URL', 400);
        }
    }
    if ($modelName === '') send_error('model_name 不能为空', 400);

    $pdo = get_db_connection();
    db_run($pdo, 'INSERT INTO ai_config (id, base_url, model_name, updated_at)
        VALUES (1, ?, ?, unixepoch())
        ON CONFLICT(id) DO UPDATE SET base_url = excluded.base_url, model_name = excluded.model_name, updated_at = excluded.updated_at',
        [$baseUrl, $modelName]);
    send_json(['success' => true, 'message' => '配置已成功保存']);
});

route('POST', '/api/ai/test-connection', function (array $p) {
    // 连通性测试由前端直调 Gateway 完成，后端不持有 api_key，此处 405 提示
    send_error('连通性测试已移至前端直调 AI Gateway', 405);
});
