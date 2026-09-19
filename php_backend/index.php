<?php

// php_backend/index.php — 前置控制器

header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/dbInit.php';
require_once __DIR__ . '/router.php';

// ---------------------------------------------------------------------------
// 输出与输入辅助
// ---------------------------------------------------------------------------

function send_json($data = null, int $code = 200): void
{
    http_response_code($code);
    if ($data !== null) {
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    exit;
}

function send_error(string $message, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/** 读取 application/json 请求体为关联数组，空/非法时返回 [] */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ---------------------------------------------------------------------------
// 自举表
// ---------------------------------------------------------------------------

$pdo = get_db_connection();
ensure_tables($pdo);

// ---------------------------------------------------------------------------
// 鉴权：Bearer token，hash_equals 防时序。未配置 ADMIN_TOKEN = 开放模式（本地开发）。
// 规则照搬 packages/api/src/index.ts:56-71 的 authMiddleware：
//   - /api/admin/* 全方法鉴权（含 GET，防隐私圈坐标泄露）
//   - 其余 /api/* 的非 GET 写操作鉴权
// ---------------------------------------------------------------------------

function check_auth(): void
{
    $token = ADMIN_TOKEN;
    if ($token === '') return; // 开放模式

    // 兼容各类 Apache / FastCGI / InfinityFree 剥除 Authorization 头的场景
    $authHeader = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? $_SERVER['HTTP_X_ADMIN_TOKEN']
        ?? $_SERVER['HTTP_X_AUTHORIZATION']
        ?? '';

    if ($authHeader === '') {
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] 
                ?? $headers['authorization'] 
                ?? $headers['X-Admin-Token'] 
                ?? $headers['x-admin-token'] 
                ?? '';
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $authHeader = $headers['Authorization'] 
                ?? $headers['authorization'] 
                ?? $headers['X-Admin-Token'] 
                ?? $headers['x-admin-token'] 
                ?? '';
        }
    }

    $bearer = '';
    if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
        $bearer = trim($m[1]);
    } else {
        $bearer = trim($authHeader);
    }

    if ($bearer === '' || !hash_equals($token, $bearer)) {
        send_error('Unauthorized：请携带有效的 Authorization: Bearer 令牌', 401);
    }
}

// ---------------------------------------------------------------------------
// 路由注册（route 文件调用 route() 注册，不立即执行）
// ---------------------------------------------------------------------------

require_once __DIR__ . '/routes/rides.php';
require_once __DIR__ . '/routes/admin_rides.php';
require_once __DIR__ . '/routes/privacy_zones.php';
require_once __DIR__ . '/routes/ai_config.php';
require_once __DIR__ . '/routes/rider.php';
require_once __DIR__ . '/routes/goals.php';
require_once __DIR__ . '/routes/coach.php';
require_once __DIR__ . '/routes/ride_insights.php';
require_once __DIR__ . '/routes/reports.php';
require_once __DIR__ . '/routes/sync.php';

// ---------------------------------------------------------------------------
// 分发
// ---------------------------------------------------------------------------

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// 子目录部署剥离：若部署在 https://host/cycling/ 这样的子目录下，
// REQUEST_URI 会是 /cycling/api/rides，但内部路由表全是 /api/...。
// 用 SCRIPT_NAME（= /cycling/php_backend/index.php）推出 app 根 /cycling 并剥掉。
// 兜底：SCRIPT_NAME 不可靠时，从路径里第一个 /api 出现位置截断。
$scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
if (str_ends_with($scriptName, '/index.php')) {
    $appRoot = rtrim(dirname(dirname($scriptName)), '/'); // /cycling 或 空串
    if ($appRoot !== '' && $appRoot !== '/' && str_starts_with($path, $appRoot)) {
        $path = substr($path, strlen($appRoot));
    }
}
if (($apiPos = strpos($path, '/api')) !== false && $apiPos > 0) {
    // 兜底：路径前缀仍残留（如 SCRIPT_NAME 不可靠）→ 从 /api 处截断
    $path = substr($path, $apiPos);
}
if ($path === '') $path = '/';

// 规范化路径（去尾斜杠，根除外）
if ($path !== '/' && str_ends_with($path, '/')) {
    $path = rtrim($path, '/');
}

// CORS preflight：同域部署不需要，但直连时给个 204
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$isAdminRoute = str_starts_with($path, '/api/admin');
$isWrite = !in_array($method, ['GET', 'HEAD'], true);
if ($isAdminRoute || $isWrite) {
    check_auth();
}

dispatch($method, $path);
