<?php

// php_backend/config.php

require_once __DIR__ . '/vendor/autoload.php';

// 从 .env 加载环境变量。
// Dotenv::createImmutable 写入 $_ENV/$_SERVER，v5 默认不调 putenv，
// 故下方常量从 $_ENV 读（getenv 读不到 dotenv 写入的值）。
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

// 数据库配置：cycling.db 在仓库根（vhost web root），与 bookmark 同构。
define('DATABASE_PATH', __DIR__ . '/../cycling.db');

// 管理令牌：客户端携带 Authorization: Bearer <token>，PHP 用 hash_equals 校验。
// 从 $_ENV 读（dotenv v5 写入处）；未配置时为空串 → 开放模式（仅限本地开发）。
define('ADMIN_TOKEN', $_ENV['ADMIN_TOKEN'] ?? $_SERVER['ADMIN_TOKEN'] ?? '');

// AI Gateway 默认配置（前端直调 Gateway；这里只存 base_url + model_name 供前端读取与跨设备同步）。
define('AI_GATEWAY_BASE', $_ENV['AI_GATEWAY_BASE'] ?? 'https://api-gateway.yuuverne.site');
define('AI_GATEWAY_MODEL', $_ENV['AI_GATEWAY_MODEL'] ?? 'velotrack-coach');
