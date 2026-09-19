package com.velotrack.sync.core

import com.velotrack.sync.data.GeoPoint
import com.velotrack.sync.data.RideUploadPayload
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.*

object TcxParser {

    private val isoFormats = arrayOf(
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") },
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") },
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US),
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    )

    private fun parseIsoTime(timeStr: String): Long {
        for (format in isoFormats) {
            try {
                return format.parse(timeStr)?.time ?: continue
            } catch (_: Exception) {}
        }
        return System.currentTimeMillis()
    }

    fun parse(inputStream: InputStream, defaultTitle: String = "骑行记录"): Pair<RideUploadPayload, List<GeoPoint>> {
        val factory = XmlPullParserFactory.newInstance()
        factory.isNamespaceAware = false
        val parser = factory.newPullParser()
        parser.setInput(inputStream, "UTF-8")

        val points = mutableListOf<GeoPoint>()
        var currentPoint: GeoPoint? = null
        var currentTag = ""
        var textContent = ""

        var explicitTotalTime: Long? = null
        var explicitDistance: Long? = null
        var explicitCalories: Long? = null

        var insideTrackpoint = false
        var insideHeartRate = false

        var eventType = parser.eventType
        while (eventType != XmlPullParser.END_DOCUMENT) {
            when (eventType) {
                XmlPullParser.START_TAG -> {
                    currentTag = parser.name
                    if (currentTag.equals("Trackpoint", ignoreCase = true)) {
                        insideTrackpoint = true
                        currentPoint = GeoPoint(time = 0L)
                    } else if (currentTag.equals("HeartRateBpm", ignoreCase = true)) {
                        insideHeartRate = true
                    }
                }
                XmlPullParser.TEXT -> {
                    textContent = parser.text.trim()
                }
                XmlPullParser.END_TAG -> {
                    val endTag = parser.name
                    if (insideTrackpoint && currentPoint != null) {
                        when {
                            endTag.equals("Time", ignoreCase = true) -> {
                                if (textContent.isNotEmpty()) {
                                    currentPoint.time = parseIsoTime(textContent)
                                }
                            }
                            endTag.equals("LatitudeDegrees", ignoreCase = true) -> {
                                textContent.toDoubleOrNull()?.let { wgsLat ->
                                    val wgsLng = currentPoint.lng ?: 0.0
                                    if (currentPoint.lng != null) {
                                        val gcj = GeoCalculations.wgs84ToGcj02(wgsLat, wgsLng)
                                        currentPoint.lat = gcj.first
                                        currentPoint.lng = gcj.second
                                    } else {
                                        currentPoint.lat = wgsLat
                                    }
                                }
                            }
                            endTag.equals("LongitudeDegrees", ignoreCase = true) -> {
                                textContent.toDoubleOrNull()?.let { wgsLng ->
                                    val wgsLat = currentPoint.lat
                                    if (wgsLat != null) {
                                        val gcj = GeoCalculations.wgs84ToGcj02(wgsLat, wgsLng)
                                        currentPoint.lat = gcj.first
                                        currentPoint.lng = gcj.second
                                    } else {
                                        currentPoint.lng = wgsLng
                                    }
                                }
                            }
                            endTag.equals("AltitudeMeters", ignoreCase = true) -> {
                                currentPoint.altitude = textContent.toDoubleOrNull()
                            }
                            endTag.equals("DistanceMeters", ignoreCase = true) -> {
                                currentPoint.distance = textContent.toDoubleOrNull()
                            }
                            endTag.equals("Value", ignoreCase = true) && insideHeartRate -> {
                                currentPoint.hr = textContent.toIntOrNull()
                            }
                            endTag.equals("Cadence", ignoreCase = true) -> {
                                currentPoint.cadence = textContent.toIntOrNull()
                            }
                            endTag.equals("Speed", ignoreCase = true) -> {
                                textContent.toDoubleOrNull()?.let { mps ->
                                    currentPoint.speed = mps * 3.6
                                }
                            }
                            endTag.equals("HeartRateBpm", ignoreCase = true) -> {
                                insideHeartRate = false
                            }
                            endTag.equals("Trackpoint", ignoreCase = true) -> {
                                insideTrackpoint = false
                                if (currentPoint.time > 0L) {
                                    points.add(currentPoint)
                                }
                                currentPoint = null
                            }
                        }
                    } else {
                        when {
                            endTag.equals("TotalTimeSeconds", ignoreCase = true) -> {
                                explicitTotalTime = textContent.toDoubleOrNull()?.toLong()
                            }
                            endTag.equals("DistanceMeters", ignoreCase = true) -> {
                                explicitDistance = textContent.toDoubleOrNull()?.toLong()
                            }
                            endTag.equals("Calories", ignoreCase = true) -> {
                                explicitCalories = textContent.toLongOrNull()
                            }
                        }
                    }
                    currentTag = ""
                    textContent = ""
                }
            }
            eventType = parser.next()
        }

        return ActivityAggregator.aggregate(
            title = defaultTitle,
            points = points,
            explicitElapsedTimeSeconds = explicitTotalTime,
            explicitDistanceMeters = explicitDistance,
            explicitCalories = explicitCalories
        )
    }
}
