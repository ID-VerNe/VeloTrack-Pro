package com.velotrack.sync.core

import kotlin.math.*

object GeoCalculations {

    private const val PI_CONSTANT = Math.PI
    private const val A = 6378245.0
    private const val EE = 0.00669342162296594323

    /**
     * WGS-84 转 GCJ-02 (火星坐标系纠偏)
     * 算法与前端 gcoord.transform(coords, gcoord.WGS84, gcoord.GCJ02) 完全一致
     */
    fun wgs84ToGcj02(lat: Double, lng: Double): Pair<Double, Double> {
        if (outOfChina(lat, lng)) {
            return Pair(lat, lng)
        }
        var dLat = transformLat(lng - 105.0, lat - 35.0)
        var dLng = transformLng(lng - 105.0, lat - 35.0)
        val radLat = lat / 180.0 * PI_CONSTANT
        var magic = sin(radLat)
        magic = 1 - EE * magic * magic
        val sqrtMagic = sqrt(magic)
        dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI_CONSTANT)
        dLng = (dLng * 180.0) / (A / sqrtMagic * cos(radLat) * PI_CONSTANT)
        val mgLat = lat + dLat
        val mgLng = lng + dLng
        return Pair(
            (round(mgLat * 1e6) / 1e6),
            (round(mgLng * 1e6) / 1e6)
        )
    }

    private fun outOfChina(lat: Double, lng: Double): Boolean {
        return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
    }

    private fun transformLat(x: Double, y: Double): Double {
        var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * PI_CONSTANT) + 20.0 * sin(2.0 * x * PI_CONSTANT)) * 2.0 / 3.0
        ret += (20.0 * sin(y * PI_CONSTANT) + 40.0 * sin(y / 3.0 * PI_CONSTANT)) * 2.0 / 3.0
        ret += (160.0 * sin(y / 12.0 * PI_CONSTANT) + 320 * sin(y * PI_CONSTANT / 30.0)) * 2.0 / 3.0
        return ret
    }

    private fun transformLng(x: Double, y: Double): Double {
        var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * PI_CONSTANT) + 20.0 * sin(2.0 * x * PI_CONSTANT)) * 2.0 / 3.0
        ret += (20.0 * sin(x * PI_CONSTANT) + 40.0 * sin(x / 3.0 * PI_CONSTANT)) * 2.0 / 3.0
        ret += (150.0 * sin(x / 12.0 * PI_CONSTANT) + 300.0 * sin(x / 30.0 * PI_CONSTANT)) * 2.0 / 3.0
        return ret
    }

    /**
     * 半正矢公式计算地表球面距离 (米)
     */
    fun getHaversineDistanceMeters(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val r = 6371e3
        val phi1 = lat1 * PI_CONSTANT / 180.0
        val phi2 = lat2 * PI_CONSTANT / 180.0
        val deltaPhi = (lat2 - lat1) * PI_CONSTANT / 180.0
        val deltaLambda = (lon2 - lon1) * PI_CONSTANT / 180.0

        val a = sin(deltaPhi / 2).pow(2) +
                cos(phi1) * cos(phi2) * sin(deltaLambda / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }

    /**
     * 点 C 到线段 AB 的最短距离 (米)，采用局部平面等距圆柱投影近似
     */
    fun distancePointToSegmentMeters(
        cLat: Double, cLng: Double,
        aLat: Double, aLng: Double,
        bLat: Double, bLng: Double
    ): Double {
        val latRef = (cLat * PI_CONSTANT) / 180.0
        val metersPerDegLat = 111320.0
        val metersPerDegLng = 111320.0 * cos(latRef)

        val ax = (aLng - cLng) * metersPerDegLng
        val ay = (aLat - cLat) * metersPerDegLat
        val bx = (bLng - cLng) * metersPerDegLng
        val by = (bLat - cLat) * metersPerDegLat

        val abx = bx - ax
        val aby = by - ay
        val lenSq = abx * abx + aby * aby
        if (lenSq == 0.0) return hypot(ax, ay)

        var t = (-(ax * abx) - (ay * aby)) / lenSq
        t = max(0.0, min(1.0, t))
        val footX = ax + t * abx
        val footY = ay + t * aby
        return hypot(footX, footY)
    }

    /**
     * 轨迹点位均匀降采样 (默认上限 500 点)
     */
    fun <T> downsamplePoints(points: List<T>, maxLimit: Int = 500): List<T> {
        if (points.size <= maxLimit) return points
        val step = ceil(points.size.toDouble() / maxLimit).toInt()
        return points.filterIndexed { index, _ -> index % step == 0 }
    }

    /**
     * 心率区间划分 (Z1 ~ Z5)
     */
    fun calculateHRZone(hr: Int, maxHR: Int = 188): Int {
        val percent = hr.toDouble() / maxHR
        return when {
            percent < 0.6 -> 1
            percent < 0.7 -> 2
            percent < 0.8 -> 3
            percent < 0.9 -> 4
            else -> 5
        }
    }
}
