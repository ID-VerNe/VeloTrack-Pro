<?php

// php_backend/utils/geo_resolver.php

/**
 * 获取高德官方行政区划多边形数据库（从 data/city_polygons.json 载入，单例静态缓存）
 */
function get_city_polygons_database(): ?array
{
    static $cityPolygons = null;
    if ($cityPolygons !== null) {
        return $cityPolygons;
    }

    $jsonPath = __DIR__ . '/../data/city_polygons.json';
    if (file_exists($jsonPath)) {
        $content = file_get_contents($jsonPath);
        if ($content !== false) {
            $data = json_decode($content, true);
            if (is_array($data)) {
                $cityPolygons = $data;
                return $cityPolygons;
            }
        }
    }
    return null;
}

/**
 * 射线法（Ray-casting / PNPOLY 算法）判断经纬度点是否在闭合多边形内部
 *
 * @param float $lng 待判定经度
 * @param float $lat 待判定纬度
 * @param array $polygon 顶点经纬度二维数组 [[lng, lat], [lng, lat], ...]
 * @return bool 是否在多边形内部
 */
function point_in_polygon(float $lng, float $lat, array $polygon): bool
{
    $inside = false;
    $count = count($polygon);
    if ($count < 3) return false;

    $j = $count - 1;
    for ($i = 0; $i < $count; $i++) {
        $xi = $polygon[$i][0];
        $yi = $polygon[$i][1];
        $xj = $polygon[$j][0];
        $yj = $polygon[$j][1];

        // 检查水平向右射线与边 (xi, yi)-(xj, yj) 是否相交
        if (($yi > $lat) !== ($yj > $lat)) {
            $intersectLng = ($xj - $xi) * ($lat - $yi) / ($yj - $yi) + $xi;
            if ($lng < $intersectLng) {
                $inside = !$inside;
            }
        }
        $j = $i;
    }

    return $inside;
}

/**
 * 优雅降级备用矩形数据库（在 city_polygons.json 缺失时兜底使用）
 */
function get_fallback_city_database(): array
{
    static $cities = [
        ['name' => '深圳', 'minLat' => 22.40, 'maxLat' => 22.88, 'minLng' => 113.70, 'maxLng' => 114.65, 'center' => [114.05, 22.54]],
        ['name' => '广州', 'minLat' => 22.85, 'maxLat' => 23.95, 'minLng' => 112.95, 'maxLng' => 114.05, 'center' => [113.32, 23.12]],
        ['name' => '东莞', 'minLat' => 22.65, 'maxLat' => 23.15, 'minLng' => 113.50, 'maxLng' => 114.25, 'center' => [113.75, 23.02]],
        ['name' => '佛山', 'minLat' => 22.60, 'maxLat' => 23.35, 'minLng' => 112.60, 'maxLng' => 113.30, 'center' => [113.12, 23.02]],
        ['name' => '惠州', 'minLat' => 22.40, 'maxLat' => 23.95, 'minLng' => 113.80, 'maxLng' => 115.40, 'center' => [114.41, 23.11]],
        ['name' => '中山', 'minLat' => 22.15, 'maxLat' => 22.75, 'minLng' => 113.10, 'maxLng' => 113.65, 'center' => [113.38, 22.52]],
        ['name' => '珠海', 'minLat' => 21.80, 'maxLat' => 22.45, 'minLng' => 113.05, 'maxLng' => 113.70, 'center' => [113.57, 22.27]],
        ['name' => '江门', 'minLat' => 21.60, 'maxLat' => 22.85, 'minLng' => 112.00, 'maxLng' => 113.25, 'center' => [113.08, 22.58]],
        ['name' => '肇庆', 'minLat' => 22.70, 'maxLat' => 24.10, 'minLng' => 111.30, 'maxLng' => 112.90, 'center' => [112.46, 23.05]],
        ['name' => '清远', 'minLat' => 23.40, 'maxLat' => 25.10, 'minLng' => 111.90, 'maxLng' => 113.95, 'center' => [113.05, 23.68]],
        ['name' => '韶关', 'minLat' => 23.70, 'maxLat' => 25.50, 'minLng' => 112.80, 'maxLng' => 114.80, 'center' => [113.59, 24.81]],
        ['name' => '汕头', 'minLat' => 23.10, 'maxLat' => 23.65, 'minLng' => 116.20, 'maxLng' => 117.20, 'center' => [116.68, 23.35]],
        ['name' => '潮州', 'minLat' => 23.40, 'maxLat' => 24.30, 'minLng' => 116.40, 'maxLng' => 117.20, 'center' => [116.62, 23.66]],
        ['name' => '揭阳', 'minLat' => 22.80, 'maxLat' => 23.90, 'minLng' => 115.70, 'maxLng' => 116.60, 'center' => [116.37, 23.54]],
        ['name' => '汕尾', 'minLat' => 22.60, 'maxLat' => 23.50, 'minLng' => 114.80, 'maxLng' => 116.10, 'center' => [115.37, 22.78]],
        ['name' => '湛江', 'minLat' => 20.20, 'maxLat' => 21.85, 'minLng' => 109.60, 'maxLng' => 110.75, 'center' => [110.35, 21.27]],
        ['name' => '茂名', 'minLat' => 21.20, 'maxLat' => 22.45, 'minLng' => 110.30, 'maxLng' => 111.45, 'center' => [110.92, 21.66]],
        ['name' => '阳江', 'minLat' => 21.40, 'maxLat' => 22.40, 'minLng' => 111.20, 'maxLng' => 112.35, 'center' => [111.98, 21.85]],
        ['name' => '云浮', 'minLat' => 22.30, 'maxLat' => 23.35, 'minLng' => 111.00, 'maxLng' => 112.30, 'center' => [112.04, 22.92]],
        ['name' => '梅州', 'minLat' => 23.40, 'maxLat' => 24.95, 'minLng' => 115.30, 'maxLng' => 116.90, 'center' => [116.12, 24.28]],
        ['name' => '河源', 'minLat' => 23.10, 'maxLat' => 24.85, 'minLng' => 114.20, 'maxLng' => 115.65, 'center' => [114.70, 23.74]],
        ['name' => '北京', 'minLat' => 39.40, 'maxLat' => 41.10, 'minLng' => 115.40, 'maxLng' => 117.50, 'center' => [116.40, 39.90]],
        ['name' => '上海', 'minLat' => 30.70, 'maxLat' => 31.85, 'minLng' => 120.85, 'maxLng' => 122.20, 'center' => [121.47, 31.23]],
        ['name' => '杭州', 'minLat' => 29.80, 'maxLat' => 30.60, 'minLng' => 119.20, 'maxLng' => 120.70, 'center' => [120.15, 30.28]],
        ['name' => '成都', 'minLat' => 30.05, 'maxLat' => 31.45, 'minLng' => 102.90, 'maxLng' => 104.90, 'center' => [104.06, 30.57]],
        ['name' => '武汉', 'minLat' => 29.95, 'maxLat' => 31.35, 'minLng' => 113.70, 'maxLng' => 115.10, 'center' => [114.30, 30.59]],
        ['name' => '南京', 'minLat' => 31.20, 'maxLat' => 32.65, 'minLng' => 118.35, 'maxLng' => 119.25, 'center' => [118.79, 32.06]],
        ['name' => '苏州', 'minLat' => 30.75, 'maxLat' => 32.05, 'minLng' => 119.90, 'maxLng' => 121.35, 'center' => [120.58, 31.29]],
        ['name' => '厦门', 'minLat' => 24.40, 'maxLat' => 24.90, 'minLng' => 117.85, 'maxLng' => 118.45, 'center' => [118.08, 24.48]],
        ['name' => '海口', 'minLat' => 19.50, 'maxLat' => 20.20, 'minLng' => 110.10, 'maxLng' => 110.75, 'center' => [110.32, 20.04]],
        ['name' => '三亚', 'minLat' => 18.15, 'maxLat' => 18.65, 'minLng' => 108.95, 'maxLng' => 110.05, 'center' => [109.51, 18.25]],
        ['name' => '大理', 'minLat' => 25.30, 'maxLat' => 26.40, 'minLng' => 99.80, 'maxLng' => 100.60, 'center' => [100.22, 25.59]],
        ['name' => '桂林', 'minLat' => 24.30, 'maxLat' => 26.00, 'minLng' => 109.70, 'maxLng' => 111.40, 'center' => [110.29, 25.27]],
        ['name' => '西安', 'minLat' => 33.70, 'maxLat' => 34.80, 'minLng' => 107.65, 'maxLng' => 109.80, 'center' => [108.93, 34.34]],
        ['name' => '重庆', 'minLat' => 28.15, 'maxLat' => 32.20, 'minLng' => 105.25, 'maxLng' => 110.20, 'center' => [106.55, 29.56]],
        ['name' => '长沙', 'minLat' => 27.80, 'maxLat' => 28.70, 'minLng' => 111.85, 'maxLng' => 114.25, 'center' => [112.93, 28.22]],
        ['name' => '青岛', 'minLat' => 35.55, 'maxLat' => 37.15, 'minLng' => 119.50, 'maxLng' => 121.00, 'center' => [120.38, 36.06]],
        ['name' => '昆明', 'minLat' => 24.35, 'maxLat' => 26.55, 'minLng' => 102.15, 'maxLng' => 103.65, 'center' => [102.83, 24.88]],
        ['name' => '香港', 'minLat' => 22.15, 'maxLat' => 22.60, 'minLng' => 113.80, 'maxLng' => 114.45, 'center' => [114.16, 22.31]],
        ['name' => '澳门', 'minLat' => 22.10, 'maxLat' => 22.25, 'minLng' => 113.50, 'maxLng' => 113.60, 'center' => [113.54, 22.19]],
    ];
    return $cities;
}

/**
 * 兼容旧方法名称
 */
function get_city_database(): array
{
    return get_fallback_city_database();
}

/**
 * 解码 Google polyline 首点坐标 [lat, lng]
 */
function decode_polyline_first_point(?string $polyline): ?array
{
    if (empty($polyline)) return null;

    $index = 0;
    $len = strlen($polyline);
    $lat = 0;
    $lng = 0;

    // 解析 lat
    $shift = 0;
    $result = 0;
    while ($index < $len) {
        $b = ord($polyline[$index++]) - 63;
        $result |= ($b & 0x1f) << $shift;
        $shift += 5;
        if ($b < 0x20) break;
    }
    $dlat = (($result & 1) ? ~($result >> 1) : ($result >> 1));
    $lat += $dlat;

    // 解析 lng
    $shift = 0;
    $result = 0;
    while ($index < $len) {
        $b = ord($polyline[$index++]) - 63;
        $result |= ($b & 0x1f) << $shift;
        $shift += 5;
        if ($b < 0x20) break;
    }
    $dlng = (($result & 1) ? ~($result >> 1) : ($result >> 1));
    $lng += $dlng;

    return [$lat * 1e-5, $lng * 1e-5];
}

/**
 * 解码完整 Google Polyline 所有折点坐标 [[lat, lng], ...]
 */
function decode_polyline_all_points(?string $polyline): array
{
    if (empty($polyline)) return [];

    $points = [];
    $index = 0;
    $len = strlen($polyline);
    $lat = 0;
    $lng = 0;

    while ($index < $len) {
        // 解码 lat
        $shift = 0;
        $result = 0;
        do {
            if ($index >= $len) break 2;
            $b = ord($polyline[$index++]) - 63;
            $result |= ($b & 0x1f) << $shift;
            $shift += 5;
        } while ($b >= 0x20);
        $dlat = (($result & 1) ? ~($result >> 1) : ($result >> 1));
        $lat += $dlat;

        // 解码 lng
        $shift = 0;
        $result = 0;
        do {
            if ($index >= $len) break 2;
            $b = ord($polyline[$index++]) - 63;
            $result |= ($b & 0x1f) << $shift;
            $shift += 5;
        } while ($b >= 0x20);
        $dlng = (($result & 1) ? ~($result >> 1) : ($result >> 1));
        $lng += $dlng;

        $points[] = [$lat * 1e-5, $lng * 1e-5];
    }

    return $points;
}

/**
 * 均匀采样折线坐标点（保留首尾及等分中途点，兼顾效率与边界穿透检测）
 */
function decode_polyline_samples(?string $polyline, int $maxSamples = 15): array
{
    $points = decode_polyline_all_points($polyline);
    $total = count($points);
    if ($total === 0) return [];
    if ($total <= $maxSamples) return $points;

    $samples = [];
    $step = ($total - 1) / ($maxSamples - 1);
    for ($i = 0; $i < $maxSamples; $i++) {
        $index = (int)round($i * $step);
        $index = min($index, $total - 1);
        $samples[] = $points[$index];
    }
    return $samples;
}

/**
 * 计算两个经纬度坐标之间的球面距离（公里）
 */
function haversine_distance_km(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $earthRadius = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) * sin($dLat / 2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLng / 2) * sin($dLng / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $earthRadius * $c;
}

/**
 * 根据单点坐标智能反查所在城市（高精度多边形判定 + 辐射兜底）
 */
function resolve_single_point_city(?float $lat, ?float $lng): string
{
    if ($lat === null || $lng === null || ($lat == 0 && $lng == 0)) {
        return '其他城市';
    }

    // 1. 优先使用高德官方真实多边形边界判定
    $cityPolygons = get_city_polygons_database();
    if (!empty($cityPolygons)) {
        // 第一阶段：多边形边界点射线法精准判定（BBox 初筛 -> 射线法检测）
        foreach ($cityPolygons as $city) {
            $bbox = $city['bbox'] ?? null;
            // bbox 格式: [minLng, minLat, maxLng, maxLat]
            if ($bbox && ($lng < $bbox[0] || $lat < $bbox[1] || $lng > $bbox[2] || $lat > $bbox[3])) {
                continue; // 超出外接矩形范围，快速跳过
            }

            // 在矩形范围内，逐个检验所有闭合多边形外环（MultiPolygon 岛屿/多区域）
            if (!empty($city['polygons'])) {
                foreach ($city['polygons'] as $poly) {
                    if (point_in_polygon($lng, $lat, $poly)) {
                        return $city['name'];
                    }
                }
            }
        }

        // 第二阶段：未严格命中任何城市多边形内部（如沿海骑行微移、边界绿道），根据城市中心点就近判定（辐射 ≤ 55km）
        $closestCity = null;
        $minDist = PHP_FLOAT_MAX;
        foreach ($cityPolygons as $city) {
            if (!empty($city['center'])) {
                $dist = haversine_distance_km($lat, $lng, $city['center'][1], $city['center'][0]);
                if ($dist < $minDist) {
                    $minDist = $dist;
                    $closestCity = $city['name'];
                }
            }
        }

        if ($closestCity !== null && $minDist <= 55.0) {
            return $closestCity;
        }

        return '其他城市';
    }

    // 2. 优雅降级：若多边形数据库文件缺失，使用原有简易包围盒与就近距离判定
    $fallbackCities = get_fallback_city_database();
    foreach ($fallbackCities as $c) {
        if ($lat >= $c['minLat'] && $lat <= $c['maxLat'] &&
            $lng >= $c['minLng'] && $lng <= $c['maxLng']) {
            return $c['name'];
        }
    }

    $closestCity = null;
    $minDist = PHP_FLOAT_MAX;
    foreach ($fallbackCities as $c) {
        $dist = haversine_distance_km($lat, $lng, $c['center'][1], $c['center'][0]);
        if ($dist < $minDist) {
            $minDist = $dist;
            $closestCity = $c['name'];
        }
    }

    if ($closestCity !== null && $minDist <= 55.0) {
        return $closestCity;
    }

    return '其他城市';
}

/**
 * 完整解析单次骑行所涉及的所有城市与展示名称（支持单向跨城、闭环折返与多城远征）
 *
 * @param float|null $startLat 起点纬度
 * @param float|null $startLng 起点经度
 * @param string|null $polyline Google polyline 编码字符串
 * @return array{
 *   city: string,          // 显示名称，如 "深圳"、"深圳 → 东莞"、"深圳 ⇄ 东莞"
 *   cities: string[],      // 涉及的所有城市列表（去重后），如 ["深圳", "东莞"]
 *   is_cross_city: bool,   // 是否为跨城骑行
 *   start_city: string,    // 起点城市
 *   end_city: string       // 终点城市
 * }
 */
function resolve_ride_cities(?float $startLat, ?float $startLng, ?string $polyline = null): array
{
    if (empty($polyline)) {
        $c = resolve_single_point_city($startLat, $startLng);
        return [
            'city' => $c,
            'cities' => [$c],
            'is_cross_city' => false,
            'start_city' => $c,
            'end_city' => $c,
        ];
    }

    $samples = decode_polyline_samples($polyline, 15);
    if (empty($samples)) {
        $c = resolve_single_point_city($startLat, $startLng);
        return [
            'city' => $c,
            'cities' => [$c],
            'is_cross_city' => false,
            'start_city' => $c,
            'end_city' => $c,
        ];
    }

    // 1. 逐点判定城市
    $rawCities = [];
    foreach ($samples as $pt) {
        $rawCities[] = resolve_single_point_city($pt[0], $pt[1]);
    }

    // 2. 相邻去重（Compress adjacent duplicates: [A, A, B, B, A] -> [A, B, A]）
    $compressed = [];
    foreach ($rawCities as $c) {
        if (empty($compressed) || end($compressed) !== $c) {
            $compressed[] = $c;
        }
    }

    // 过滤掉中途误判的 '其他城市'（若中途有已知城市，则忽略短暂的 '其他城市' 点）
    $knownCompressed = array_values(array_filter($compressed, function($c) {
        return $c !== '其他城市';
    }));

    // 若全部都是未知城市，则判定为其他城市
    if (empty($knownCompressed)) {
        return [
            'city' => '其他城市',
            'cities' => ['其他城市'],
            'is_cross_city' => false,
            'start_city' => '其他城市',
            'end_city' => '其他城市',
        ];
    }

    $uniqueCities = array_values(array_unique($knownCompressed));
    $startCity = $knownCompressed[0];
    $endCity = end($knownCompressed);
    $seqLen = count($knownCompressed);

    // 3. 判定逻辑
    // 序列去重后仅有 1 个城市 -> 单城骑行
    if (count($uniqueCities) === 1) {
        return [
            'city' => $startCity,
            'cities' => [$startCity],
            'is_cross_city' => false,
            'start_city' => $startCity,
            'end_city' => $endCity,
        ];
    }

    // 序列长度 == 2：点对点单向跨城，如 [深圳, 东莞] -> "深圳 → 东莞"
    $displayTitle = '';
    if ($seqLen === 2) {
        $displayTitle = "{$startCity} → {$endCity}";
    } elseif ($seqLen > 2 && $startCity === $endCity) {
        // 序列长度 > 2 且 首 == 尾：闭环折返跨城，如 [深圳, 东莞, 深圳] -> "深圳 ⇄ 东莞"
        $viaCity = '';
        foreach ($knownCompressed as $c) {
            if ($c !== $startCity) {
                $viaCity = $c;
                break;
            }
        }
        $displayTitle = !empty($viaCity) ? "{$startCity} ⇄ {$viaCity}" : "{$startCity} → {$endCity}";
    } else {
        // 多城远征，如 [深圳, 东莞, 广州] -> "深圳 → 广州"
        $displayTitle = "{$startCity} → {$endCity}";
    }

    return [
        'city' => $displayTitle,
        'cities' => $uniqueCities,
        'is_cross_city' => true,
        'start_city' => $startCity,
        'end_city' => $endCity,
    ];
}

/**
 * 根据起点坐标或 polyline 智能反查所在城市（向后兼容旧接口，直接返回 display city）
 */
function resolve_city(?float $lat, ?float $lng, ?string $polyline = null): string
{
    $info = resolve_ride_cities($lat, $lng, $polyline);
    return $info['city'];
}
