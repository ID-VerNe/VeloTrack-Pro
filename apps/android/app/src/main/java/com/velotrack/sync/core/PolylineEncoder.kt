package com.velotrack.sync.core

import kotlin.math.roundToLong

object PolylineEncoder {

    /**
     * 编码经纬度列表为 Google Encoded Polyline 字符串 (precision = 5, 即 1e5)
     * 输入格式: Pair(lat, lng) 序列
     */
    fun encode(points: List<Pair<Double, Double>>): String {
        val result = StringBuilder()
        var lastLat = 0L
        var lastLng = 0L

        for (point in points) {
            val lat = (point.first * 1e5).roundToLong()
            val lng = (point.second * 1e5).roundToLong()

            val dLat = lat - lastLat
            val dLng = lng - lastLng

            encodeValue(dLat, result)
            encodeValue(dLng, result)

            lastLat = lat
            lastLng = lng
        }

        return result.toString()
    }

    private fun encodeValue(value: Long, result: StringBuilder) {
        var v = if (value < 0) (value.inv() shl 1) or 1 else value shl 1
        while (v >= 0x20) {
            result.append(((0x20 or (v and 0x1f).toInt()) + 63).toChar())
            v = v ushr 5
        }
        result.append((v.toInt() + 63).toChar())
    }
}
