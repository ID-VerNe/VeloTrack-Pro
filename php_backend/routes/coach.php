<?php

// php_backend/routes/coach.php
// 照搬 packages/api/src/routes/aiCoach.ts 的会话与消息 CRUD（不含 AI 调用）
// AI tool-calling 循环已移至前端，后端只做 ai_messages 表的读写

// GET /api/ai/coach/sessions — 会话列表
route('GET', '/api/ai/coach/sessions', function (array $p) {
    $pdo = get_db_connection();
    $rows = db_all($pdo, "SELECT
        session_id,
        MAX(created_at) as last_activity,
        COUNT(*) as message_count,
        (SELECT content FROM ai_messages WHERE session_id = m.session_id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_question
        FROM ai_messages m
        GROUP BY session_id
        ORDER BY last_activity DESC
        LIMIT 30")['results'];
    send_json(['sessions' => $rows]);
});

// GET /api/ai/coach/:session/messages — 单会话历史
route('GET', '/api/ai/coach/:session/messages', function (array $p) {
    $pdo = get_db_connection();
    $rows = db_all($pdo, "SELECT id, role, content, tool_calls, created_at
        FROM ai_messages
        WHERE session_id = ? AND role IN ('user', 'assistant') AND content IS NOT NULL AND content != ''
        ORDER BY created_at ASC", [$p['session']])['results'];
    send_json(['messages' => $rows]);
});

// POST /api/ai/coach/:session/messages — 追加一条消息
// body: { role, content, tool_calls?, tool_call_id?, name? }
route('POST', '/api/ai/coach/:session/messages', function (array $p) {
    $body = read_json_body();
    $role = $body['role'] ?? '';
    if (!in_array($role, ['user', 'assistant', 'tool'], true)) send_error('role must be user/assistant/tool', 400);

    $pdo = get_db_connection();
    $content = $body['content'] ?? null;
    $toolCalls = isset($body['tool_calls']) ? json_encode($body['tool_calls'], JSON_UNESCAPED_UNICODE) : null;
    $toolCallId = $body['tool_call_id'] ?? null;
    $name = $body['name'] ?? null;

    db_run($pdo, "INSERT INTO ai_messages (session_id, role, content, tool_calls, tool_call_id, name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, unixepoch())", [$p['session'], $role, $content, $toolCalls, $toolCallId, $name]);
    send_json(['success' => true, 'id' => db_last_insert_id($pdo)]);
});

// DELETE /api/ai/coach/:session — 删会话
route('DELETE', '/api/ai/coach/:session', function (array $p) {
    $pdo = get_db_connection();
    db_run($pdo, 'DELETE FROM ai_messages WHERE session_id = ?', [$p['session']]);
    send_json(['success' => true]);
});
