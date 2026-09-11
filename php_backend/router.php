<?php

// php_backend/router.php
// 极简正则路由器：:param → 命名捕获组。
// 与 bookmark 的 ?action= query 风格不同，这里用 RESTful PATH_INFO，
// 因为 Cycling 前端全是相对路径 /api/... fetch，改 query 会动所有调用点。

$GLOBALS['_ROUTES'] = [];

/**
 * 注册一条路由。
 * @param string   $method  HTTP 方法
 * @param string   $pattern 如 '/api/rides/:id'，:id 匹配 [^/]+
 * @param callable $handler 接收一个关联数组 $params（命名参数）
 */
function route(string $method, string $pattern, callable $handler): void
{
    $GLOBALS['_ROUTES'][] = [$method, $pattern, $handler];
}

/**
 * 按 method + path 分发。匹配第一条，提取命名参数，调用 handler。
 * 不匹配则 404。
 */
function dispatch(string $method, string $path): void
{
    foreach ($GLOBALS['_ROUTES'] as [$rMethod, $rPattern, $handler]) {
        if ($rMethod !== $method) continue;
        $regex = '#^' . preg_replace('/:(\w+)/', '(?<$1>[^/]+)', $rPattern) . '$#';
        if (preg_match($regex, $path, $m)) {
            // 只保留命名捕获（去掉数字键）
            $params = [];
            foreach ($m as $k => $v) {
                if (is_string($k)) $params[$k] = $v;
            }
            try {
                $handler($params);
                return;
            } catch (Throwable $e) {
                error_log('[route] ' . $method . ' ' . $path . ': ' . $e->getMessage());
                send_error('Internal Server Error', 500);
                return;
            }
        }
    }
    send_error('Not Found', 404);
}
