package com.velotrack.sync.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PrivacyZonesResponse(
    val zones: List<PrivacyZone> = emptyList()
)

@Serializable
data class PrivacyZone(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    @SerialName("radius_meters")
    val radiusMeters: Double
)

data class GeoPoint(
    var time: Long,
    var lat: Double? = null,
    var lng: Double? = null,
    var altitude: Double? = null,
    var distance: Double? = null,
    var hr: Int? = null,
    var cadence: Int? = null,
    var speed: Double? = null
)

@Serializable
data class AppConfig(
    val baseUrl: String = "https://cycling.yuuverne.site",
    val adminToken: String = "",
    val cfClientId: String = "",
    val cfClientSecret: String = ""
)

@Serializable
data class RideUploadPayload(
    val id: String,
    val title: String,
    @SerialName("start_time") val startTime: Long,
    @SerialName("end_time") val endTime: Long,
    @SerialName("elapsed_time_seconds") val elapsedTimeSeconds: Long,
    @SerialName("moving_time_seconds") val movingTimeSeconds: Long,
    @SerialName("distance_meters") val distanceMeters: Long,
    @SerialName("max_speed_kmh") val maxSpeedKmh: Double,
    @SerialName("avg_speed_kmh") val avgSpeedKmh: Double,
    @SerialName("total_ascent_meters") val totalAscentMeters: Long,
    @SerialName("total_descent_meters") val totalDescentMeters: Long,
    @SerialName("max_altitude_meters") val maxAltitudeMeters: Long,
    @SerialName("avg_heart_rate") val avgHeartRate: Int,
    @SerialName("max_heart_rate") val maxHeartRate: Int,
    @SerialName("avg_cadence") val avgCadence: Int,
    @SerialName("max_cadence") val maxCadence: Int,
    val calories: Long? = null,
    @SerialName("hr_z1_seconds") val hrZ1Seconds: Long = 0,
    @SerialName("hr_z2_seconds") val hrZ2Seconds: Long = 0,
    @SerialName("hr_z3_seconds") val hrZ3Seconds: Long = 0,
    @SerialName("hr_z4_seconds") val hrZ4Seconds: Long = 0,
    @SerialName("hr_z5_seconds") val hrZ5Seconds: Long = 0,
    @SerialName("start_lat") val startLat: Double? = null,
    @SerialName("start_lng") val startLng: Double? = null,
    @SerialName("summary_polyline") val summaryPolyline: String? = null
)

// 逐点明细短字段名与 web/admin 端 DetailPoint 契约对齐（telemetrySegments.ts 读取 la/ln/al/cd/sp）。
// dist web 端不读，删除以减小体积。
@Serializable
data class DetailPointItem(
    val t: Long,
    @SerialName("la") val lat: Double? = null,
    @SerialName("ln") val lng: Double? = null,
    @SerialName("al") val altitude: Double? = null,
    val hr: Int? = null,
    @SerialName("cd") val cadence: Int? = null,
    @SerialName("sp") val speed: Double? = null
)

@Serializable
data class DetailPointsPayload(
    val points: List<DetailPointItem>
)
