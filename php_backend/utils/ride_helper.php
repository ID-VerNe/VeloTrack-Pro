<?php

// php_backend/utils/ride_helper.php
// 骑行记录辅助函数：城市解析与格式化

function format_ride_row(array &$row): void
{
    $citiesArr = [];
    if (!empty($row['cities'])) {
        $decoded = json_decode($row['cities'], true);
        if (is_array($decoded)) {
            $citiesArr = $decoded;
        }
    }
    if (empty($citiesArr)) {
        if (!empty($row['city'])) {
            $parts = preg_split('/\s*(?:→|⇄|->)\s*/u', $row['city']);
            $citiesArr = array_values(array_unique(array_filter($parts)));
        } else {
            $citiesArr = ['其他城市'];
        }
    }
    $row['cities'] = $citiesArr;
    $row['is_cross_city'] = !empty($row['is_cross_city']) || (count($citiesArr) > 1);
}
