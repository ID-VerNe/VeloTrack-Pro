<?php

// php_backend/routes/reports.php
// 周期汇总：SQL SUM/COUNT 聚合 + 环比。复杂的 timeline 拆解与 calorie 估算由前端补算。
// 这里只返回原始 rides 行 + 基础聚合，前端 reportService.computePeriodicSummary 复用大部分逻辑。
//
// 注：此端点保留是因为前端 PeriodicReports.tsx:32 调 fetch('/api/rides') 取全量再前端聚合，
// reports/summary 可选作为优化。第一版先不实现 summary，让前端继续用 GET /api/rides 全量聚合。

// GET /api/reports/summary?type=&timestamp= — 预留，第一版返回 501 引导前端用 /api/rides
route('GET', '/api/reports/summary', function (array $p) {
    send_error('summary 端点第一版未实现，请前端用 GET /api/rides 全量聚合', 501);
});
