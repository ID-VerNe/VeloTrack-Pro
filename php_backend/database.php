<?php

// php_backend/database.php

require_once __DIR__ . '/config.php';

/**
 * 获取 PDO 连接（SQLite 直连磁盘文件，与 bookmark 同构）。
 * ERRMODE_EXCEPTION + FETCH_ASSOC，与 D1 的返回结构对齐（first() → fetch，all() → fetchAll）。
 */
function get_db_connection(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO('sqlite:' . DATABASE_PATH);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            $pdo->exec('PRAGMA journal_mode = WAL');
            $pdo->exec('PRAGMA synchronous = NORMAL');
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA busy_timeout = 5000');
        } catch (PDOException $e) {
            error_log('[database] Connection failed: ' . $e->getMessage());
            if (function_exists('send_error')) {
                send_error('Database connection failed: ' . $e->getMessage(), 500);
            } else {
                throw $e;
            }
        }
    }
    return $pdo;
}

/**
 * 兼容 D1 的 first()：取单行，无结果返回 null。
 */
function db_first(PDO $pdo, string $sql, array $params = []): ?array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($params));
    $row = $stmt->fetch();
    return $row !== false ? $row : null;
}

/**
 * 兼容 D1 的 all()：取多行，返回 ['results' => [...]]。
 */
function db_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($params));
    return ['results' => $stmt->fetchAll()];
}

/**
 * 兼容 D1 的 run()：执行写操作（INSERT/UPDATE/DELETE），返回受影响行数。
 */
function db_run(PDO $pdo, string $sql, array $params = []): int
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($params));
    return $stmt->rowCount();
}

/**
 * 取最后插入的 row id。
 */
function db_last_insert_id(PDO $pdo): int
{
    return (int) $pdo->lastInsertId();
}
