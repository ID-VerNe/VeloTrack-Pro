package com.velotrack.sync.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiService(private val configRepo: ConfigRepository) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val request = chain.request()
            val newBuilder = request.newBuilder()
            newBuilder.header("Content-Type", "application/json")
            chain.proceed(newBuilder.build())
        }
        .build()

    private fun cleanToken(raw: String): String {
        return raw.trim()
            .replace(Regex("^(CF-Access-Client-Id|Client[-_ ]?ID)\\s*[:=]\\s*", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^(CF-Access-Client-Secret|Client[-_ ]?Secret)\\s*[:=]\\s*", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^(Authorization|Admin[-_ ]?Token|Bearer)\\s*[:=]?\\s*", RegexOption.IGNORE_CASE), "")
            .trim('"', '\'', ' ', '\n', '\r', '\t')
    }

    private suspend fun buildRequest(path: String, method: String, body: RequestBody? = null): Request {
        val config = configRepo.getConfig()
        val url = "${config.baseUrl}${if (path.startsWith("/")) path else "/$path"}"
        val builder = Request.Builder().url(url)

        val cleanId = cleanToken(config.cfClientId)
        val cleanSecret = cleanToken(config.cfClientSecret)
        val cleanAdminToken = cleanToken(config.adminToken)

        if (cleanId.isNotEmpty()) {
            builder.header("CF-Access-Client-Id", cleanId)
        }
        if (cleanSecret.isNotEmpty()) {
            builder.header("CF-Access-Client-Secret", cleanSecret)
        }
        if (cleanAdminToken.isNotEmpty()) {
            builder.header("Authorization", "Bearer $cleanAdminToken")
            builder.header("X-Admin-Token", cleanAdminToken)
        }

        when (method.uppercase()) {
            "GET" -> builder.get()
            "POST" -> builder.post(body ?: "".toRequestBody("application/json".toMediaType()))
            "PUT" -> builder.put(body ?: "".toRequestBody("application/json".toMediaType()))
        }
        return builder.build()
    }

    suspend fun fetchPrivacyZones(): Result<List<PrivacyZone>> = withContext(Dispatchers.IO) {
        try {
            val req = buildRequest("/api/admin/privacy-zones", "GET")
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    return@withContext Result.failure(IOException("拉取隐私圈失败: HTTP ${resp.code} ${resp.message}"))
                }
                val bodyStr = resp.body?.string() ?: "{}"
                val zones = try {
                    json.decodeFromString<PrivacyZonesResponse>(bodyStr).zones
                } catch (_: Exception) {
                    try {
                        json.decodeFromString<List<PrivacyZone>>(bodyStr)
                    } catch (_: Exception) {
                        emptyList()
                    }
                }
                configRepo.saveCachedZones(zones)
                Result.success(zones)
            }
        } catch (e: Exception) {
            val cached = configRepo.getCachedZones()
            if (cached.isNotEmpty()) {
                Result.success(cached)
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun uploadRide(payload: RideUploadPayload): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val jsonStr = json.encodeToString(payload)
            val body = jsonStr.toRequestBody("application/json; charset=utf-8".toMediaType())
            val req = buildRequest("/api/admin/rides", "POST", body)
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    val err = resp.body?.string() ?: ""
                    return@withContext Result.failure(IOException("主记录上传失败: HTTP ${resp.code} - $err"))
                }
                Result.success(Unit)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadDetailPoints(rideId: String, points: List<GeoPoint>): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val detailItems = points.map { pt ->
                DetailPointItem(
                    t = pt.time,
                    lat = pt.lat,
                    lng = pt.lng,
                    ele = pt.altitude,
                    dist = pt.distance,
                    hr = pt.hr,
                    cad = pt.cadence,
                    spd = pt.speed
                )
            }
            val payload = DetailPointsPayload(points = detailItems)
            val jsonStr = json.encodeToString(payload)
            val body = jsonStr.toRequestBody("application/json; charset=utf-8".toMediaType())
            val req = buildRequest("/api/admin/rides/$rideId/detail-points", "POST", body)
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    val err = resp.body?.string() ?: ""
                    return@withContext Result.failure(IOException("明细轨迹上传失败: HTTP ${resp.code} - $err"))
                }
                Result.success(Unit)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun suggestTitle(
        startTime: Long,
        distanceKm: Double,
        avgSpeedKmh: Double,
        totalAscent: Long
    ): String? = withContext(Dispatchers.IO) {
        try {
            val payloadJson = buildJsonObject {
                put("start_time", startTime)
                put("distance_km", distanceKm)
                put("avg_speed_kmh", avgSpeedKmh)
                put("total_ascent_meters", totalAscent)
            }.toString()
            val body = payloadJson.toRequestBody("application/json".toMediaType())
            val req = buildRequest("/api/ai/suggest-title", "POST", body)
            client.newBuilder()
                .readTimeout(5, TimeUnit.SECONDS)
                .build()
                .newCall(req)
                .execute()
                .use { resp ->
                    if (resp.isSuccessful) {
                        val respBody = resp.body?.string() ?: return@use null
                        val obj = json.parseToJsonElement(respBody)
                        obj.toString()
                    } else null
                }
        } catch (_: Exception) {
            null
        }
    }
}
