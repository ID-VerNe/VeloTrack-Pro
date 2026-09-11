# Cycling 后端部署包

这个文件夹是 PHP 后端，部署到虚拟主机站点根目录（web root）。

## 文件清单

| 文件 | 作用 |
|---|---|
| `index.php` | 前置控制器 + PATH_INFO 路由 + Bearer 鉴权 |
| `config.php` | phpdotenv 加载 + DATABASE_PATH/ADMIN_TOKEN 常量 |
| `database.php` | PDO sqlite 直连磁盘文件 |
| `dbInit.php` | DDL + seed，首次请求自动建表 |
| `router.php` | 极简正则路由器（`:param` 命名捕获） |
| `routes/*.php` | 9 个路由文件（rides/admin_rides/rider/goals/coach/ride_insights/reports/ai_config/privacy_zones） |
| `composer.json` / `composer.lock` | phpdotenv 单依赖 |
| `.htaccess` | 保护 `.env`/`.log`/`.sqlite` 不被外部访问 |
| `.env.example` | 配置模板（复制成 `.env` 填值） |
| `nginx.conf.example` | nginx 主机的等价 location 配置（Apache 不需要） |

部署时还需把这两个文件放到**站点根目录**（不是 `php_backend/` 子目录）：

| 文件 | 作用 |
|---|---|
| `cycling.db` | SQLite 数据库（含历史骑行 + seed） |
| `.htaccess`（根） | 保护 `cycling.db` + 把 `/api/*` rewrite 给 `php_backend/index.php` |

## 部署步骤

### 1. 上传文件

FTP 到虚拟主机站点根目录，结构应为：

```
<站点根>/
├── .htaccess                    # 根目录保护 + /api rewrite
├── cycling.db                   # SQLite 数据库
└── php_backend/
    ├── index.php
    ├── config.php
    ├── database.php
    ├── dbInit.php
    ├── router.php
    ├── routes/
    ├── composer.json
    ├── composer.lock
    ├── .htaccess                # php_backend 子目录保护
    ├── .env                     # 从 .env.example 复制后填值
    └── vendor/                  # composer install 产物
```

### 2. 安装 PHP 依赖

虚拟主机若支持 SSH：
```bash
cd php_backend && composer install --no-dev --no-cache
```

若无 SSH：在本地 `cd php_backend && composer install --no-dev` 后，把 `vendor/` 一起 FTP 上传。

### 3. 配置 .env

把 `php_backend/.env.example` 复制为 `php_backend/.env`，填入：
```ini
ADMIN_TOKEN=<32字节随机串，openssl rand -hex 16 的输出>
AI_GATEWAY_BASE=https://api-gateway.yuuverne.site
AI_GATEWAY_MODEL=velotrack-coach
```

`ADMIN_TOKEN` 必须配置（生产不能开放模式）。这个值要同时填到 Cloudflare Worker 的 `ADMIN_TOKEN` secret——Worker 用它注入 `Authorization: Bearer` 头回源，PHP 用 `hash_equals` 校验。

### 4. Apache rewrite（根 .htaccess 已含）

根目录 `.htaccess` 已写：
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^api/(.*)$ php_backend/index.php [QSA,L]
</IfModule>
```
所有 `/api/*` 请求交给 `php_backend/index.php`，index.php 内部按 `REQUEST_URI` 分发到 routes/。

nginx 主机参考 `php_backend/nginx.conf.example`。

### 5. 验证

```bash
curl https://<你的后端域名>/api/rides
```
预期：通过 JS challenge 门后返回 `{"rides":[...]}` JSON。
（直连会先收到 challenge HTML，这是虚拟主机防护，正常。Cloudflare Worker 会用 cookie-bridge 穿越它。）

## 与 Cloudflare Worker 的衔接

- Worker 域名：`cycling.yuuverne.site`（前端 SPA + `/api/*` 反代）
- Worker 回源目标：本后端的域名（填入 Worker 的 `VHOST_BACKEND` var）
- Worker 穿越后端的 JS challenge 门（通过 cookie-bridge 领 `__test` cookie）
- Worker 注入 `Authorization: Bearer ${ADMIN_TOKEN}`，所以浏览器侧不带 token

Worker 需配置的 secret（用 `npx wrangler secret put` 从 `apps/web/` 执行）：
```bash
npx wrangler secret put COOKIE_BRIDGE_KEY   # cookie-bridge 的 X-Api-Key（与 bookmark-frontend 同一个）
npx wrangler secret put ADMIN_TOKEN         # 与本后端 .env 的 ADMIN_TOKEN 同值
```
Worker 的明文 var（已在 wrangler.jsonc，部署后改）：
- `VHOST_BACKEND`：本后端域名（部署后填，替换 REPLACE_ME）
- `COOKIE_BRIDGE_URL`：`https://cookie.yuuverne.site/cookie`（已填好）

## AI Gateway 说明

前端直调 `https://api-gateway.yuuverne.site/v1/chat/completions`，team key 存浏览器 localStorage。
后端只存 `base_url` + `model_name`（ai_config 表），不持 key。
`model_name` 用 `glm-5.2`（ai_config 表当前值），Gateway 已配置该 model 别名映射上游。

## 安全

- `.htaccess` 保护 `.env`/`.db`/`.log`/`.sqlite` 不被外部 HTTP 访问
- `ADMIN_TOKEN` 用 `hash_equals` 防时序攻击
- `.env` 不进 git（已在 .gitignore）
- `cycling.db` 不进 git（已在 .gitignore），FTP 直接上传
