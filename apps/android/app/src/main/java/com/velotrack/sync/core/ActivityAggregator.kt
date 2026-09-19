package com.velotrack.sync.core

import com.velotrack.sync.data.GeoPoint
import com.velotrack.sync.data.RideUploadPayload
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToLong

object ActivityAggregator {

    fun aggregate(
        title: String,
        points: List<GeoPoint>,
        explicitElapsedTimeSeconds: Long? = null,
        explicitDistanceMeters: Long? = null,
        explicitCalories: Long? = null,
        cumulativeClimbMeters: Long = 0,
        cumulativeDecreaseMeters: Long = 0,
        userMaxHr: Int = 188
    ): Pair<RideUploadPayload, List<GeoPoint>> {
        if (points.isEmpty()) {
            throw IllegalArgumentException("No trackpoints found in activity file.")
        }

        val sortedPoints = points.sortedBy { it.time }
        val startTime = sortedPoints.first().time
        val endTime = sortedPoints.last().time

        val calculatedElapsed = max(1L, ((endTime - startTime) / 1000.0).roundToLong())
        val elapsedTimeSeconds = explicitElapsedTimeSeconds ?: calculatedElapsed

        var movingTimeSeconds = 0.0
        var totalAscent = cumulativeClimbMeters.toDouble()
        var totalDescent = cumulativeDecreaseMeters.toDouble()
        var maxAltitude = -Double.MAX_VALUE
        var maxSpeedKmh = 0.0
        var maxHeartRate = 0
        var maxCadence = 0
        var sumHr = 0L
        var countHr = 0
        var sumCadence = 0L
        var countCadence = 0
        var calculatedDistanceMeters = 0.0

        val hrZones = LongArray(5) { 0L }

        for (i in sortedPoints.indices) {
            val pt = sortedPoints[i]
            val prev = if (i > 0) sortedPoints[i - 1] else null
            val dtSeconds = if (prev != null) (pt.time - prev.time) / 1000.0 else 0.0

            val pLat = pt.lat
            val pLng = pt.lng
            val prevLat = prev?.lat
            val prevLng = prev?.lng

            if (prev != null && pLat != null && pLng != null && prevLat != null && prevLng != null) {
                val stepDist = GeoCalculations.getHaversineDistanceMeters(prevLat, prevLng, pLat, pLng)
                calculatedDistanceMeters += stepDist

                if (pt.speed == null && dtSeconds > 0 && dtSeconds < 30) {
                    val derived = (stepDist / dtSeconds) * 3.6
                    if (derived < 90.0) {
                        pt.speed = derived
                    }
                }
            }

            pt.altitude?.let { alt ->
                if (alt > maxAltitude) maxAltitude = alt
                if (cumulativeClimbMeters == 0L && prev?.altitude != null) {
                    val diff = alt - prev.altitude!!
                    if (diff > 0) totalAscent += diff
                    else if (diff < 0) totalDescent += abs(diff)
                }
            }

            val speed = pt.speed
            if (speed != null) {
                if (speed > maxSpeedKmh && speed < 90.0) maxSpeedKmh = speed
                if (speed >= 1.5 && dtSeconds > 0 && dtSeconds < 60) {
                    movingTimeSeconds += dtSeconds
                }
            } else if (dtSeconds > 0 && dtSeconds < 60) {
                movingTimeSeconds += dtSeconds
            }

            pt.hr?.let { hr ->
                if (hr > maxHeartRate) maxHeartRate = hr
                sumHr += hr
                countHr++
                val zone = GeoCalculations.calculateHRZone(hr, userMaxHr)
                val addSec = max(1L, dtSeconds.roundToLong())
                hrZones[zone - 1] += addSec
            }

            pt.cadence?.let { cad ->
                if (cad > maxCadence) maxCadence = cad
                if (cad > 0) {
                    sumCadence += cad
                    countCadence++
                }
            }
        }

        val explicitDist = sortedPoints.mapNotNull { it.distance?.roundToLong() }.maxOrNull()
        val finalDistanceMeters = explicitDist ?: explicitDistanceMeters ?: calculatedDistanceMeters.roundToLong()

        val finalMovingTime = if (movingTimeSeconds.roundToLong() > 0) movingTimeSeconds.roundToLong() else elapsedTimeSeconds

        val movingHours = finalMovingTime / 3600.0
        val elapsedHours = elapsedTimeSeconds / 3600.0
        val distKm = finalDistanceMeters / 1000.0

        val movingAvgSpeedKmh = if (movingHours > 0) Math.round((distKm / movingHours) * 10.0) / 10.0 else 0.0
        val elapsedAvgSpeedKmh = if (elapsedHours > 0) Math.round((distKm / elapsedHours) * 10.0) / 10.0 else 0.0
        val avgSpeedKmh = if (movingAvgSpeedKmh > 0) movingAvgSpeedKmh else elapsedAvgSpeedKmh

        val validGps = sortedPoints.filter { it.lat != null && it.lng != null }
        val startLat = validGps.firstOrNull()?.lat
        val startLng = validGps.firstOrNull()?.lng

        val sampled = GeoCalculations.downsamplePoints(validGps)
        val polyline = PolylineEncoder.encode(sampled.map { Pair(it.lat!!, it.lng!!) })

        val finalTitle = title.ifBlank {
            val dateStr = SimpleDateFormat("yyyy/MM/dd", Locale.getDefault()).format(Date(startTime))
            "骑行 $dateStr"
        }

        val payload = RideUploadPayload(
            id = startTime.toString(),
            title = finalTitle,
            startTime = startTime,
            endTime = endTime,
            elapsedTimeSeconds = elapsedTimeSeconds,
            movingTimeSeconds = finalMovingTime,
            distanceMeters = finalDistanceMeters,
            maxSpeedKmh = Math.round(maxSpeedKmh * 10.0) / 10.0,
            avgSpeedKmh = avgSpeedKmh,
            totalAscentMeters = totalAscent.roundToLong(),
            totalDescentMeters = totalDescent.roundToLong(),
            maxAltitudeMeters = if (maxAltitude != -Double.MAX_VALUE) maxAltitude.roundToLong() else 0L,
            avgHeartRate = if (countHr > 0) (sumHr / countHr).toInt() else 0,
            maxHeartRate = maxHeartRate,
            avgCadence = if (countCadence > 0) (sumCadence / countCadence).toInt() else 0,
            maxCadence = maxCadence,
            calories = explicitCalories,
            hrZ1Seconds = hrZones[0],
            hrZ2Seconds = hrZones[1],
            hrZ3Seconds = hrZones[2],
            hrZ4Seconds = hrZones[3],
            hrZ5Seconds = hrZones[4],
            startLat = startLat,
            startLng = startLng,
            summaryPolyline = polyline
        )

        return Pair(payload, sortedPoints)
    }
}
