package com.velotrack.sync.core

import com.velotrack.sync.data.GeoPoint
import com.velotrack.sync.data.PrivacyZone
import com.velotrack.sync.data.RideUploadPayload
import kotlin.math.max

object PrivacyScrubber {

    private const val SEGMENT_BUFFER = 50.0
    private const val SAFE_START_BUFFER = 300.0

    private data class NearestZone(val distance: Double, val radius: Double)

    private fun nearestZoneInfo(lat: Double, lng: Double, zones: List<PrivacyZone>): NearestZone? {
        var nearest: NearestZone? = null
        for (zone in zones) {
            val d = GeoCalculations.getHaversineDistanceMeters(lat, lng, zone.latitude, zone.longitude)
            val zRadius = max(1.0, zone.radiusMeters)
            if (nearest == null || d / zRadius < nearest.distance / nearest.radius) {
                nearest = NearestZone(d, zone.radiusMeters)
            }
        }
        return nearest
    }

    /**
     * 在本地对轨迹点进行三重隐私脱敏过滤
     */
    fun scrub(
        payload: RideUploadPayload,
        points: List<GeoPoint>,
        zones: List<PrivacyZone>
    ): Pair<RideUploadPayload, List<GeoPoint>> {
        if (zones.isEmpty() || points.isEmpty()) {
            return Pair(payload, points)
        }

        val scrubFlags = BooleanArray(points.size) { false }

        // 1) 标记所有圈内点
        points.forEachIndexed { i, pt ->
            val pLat = pt.lat
            val pLng = pt.lng
            if (pLat != null && pLng != null) {
                for (zone in zones) {
                    val d = GeoCalculations.getHaversineDistanceMeters(pLat, pLng, zone.latitude, zone.longitude)
                    if (d <= zone.radiusMeters) {
                        scrubFlags[i] = true
                        break
                    }
                }
            }
        }

        // 2) 线段穿越判定：相邻两点构成的线段进入圈内（含缓冲）时两点都擦除
        for (i in 1 until points.size) {
            val a = points[i - 1]
            val b = points[i]
            val aLat = a.lat
            val aLng = a.lng
            val bLat = b.lat
            val bLng = b.lng
            if (aLat != null && aLng != null && bLat != null && bLng != null) {
                for (zone in zones) {
                    val segDist = GeoCalculations.distancePointToSegmentMeters(
                        zone.latitude, zone.longitude,
                        aLat, aLng,
                        bLat, bLng
                    )
                    if (segDist <= zone.radiusMeters + SEGMENT_BUFFER) {
                        scrubFlags[i - 1] = true
                        scrubFlags[i] = true
                        break
                    }
                }
            }
        }

        // 3) 起点保护：从开头推进，距任一圆心不足 (半径 + 安全距离) 的点全部擦除
        var safeStart: Pair<Double, Double>? = null
        for (i in points.indices) {
            val pt = points[i]
            val pLat = pt.lat
            val pLng = pt.lng
            if (pLat != null && pLng != null) {
                val info = nearestZoneInfo(pLat, pLng, zones)
                if (info != null && info.distance <= info.radius + SAFE_START_BUFFER) {
                    scrubFlags[i] = true
                    continue
                }
                safeStart = Pair(pLat, pLng)
                break
            }
        }

        // 4) 应用擦除
        val scrubbedPoints = points.mapIndexed { i, pt ->
            if (scrubFlags[i]) {
                pt.copy(lat = null, lng = null)
            } else {
                pt
            }
        }

        // 5) 重建 summary_polyline
        val wasScrubbed = scrubFlags.any { it }
        var newPolyline = payload.summaryPolyline
        if (wasScrubbed) {
            val validGps = scrubbedPoints.filter { it.lat != null && it.lng != null }
            val sampled = GeoCalculations.downsamplePoints(validGps)
            val coords = sampled.map { Pair(it.lat!!, it.lng!!) }
            newPolyline = PolylineEncoder.encode(coords)
        }

        val updatedPayload = payload.copy(
            startLat = safeStart?.first,
            startLng = safeStart?.second,
            summaryPolyline = newPolyline
        )

        return Pair(updatedPayload, scrubbedPoints)
    }
}
