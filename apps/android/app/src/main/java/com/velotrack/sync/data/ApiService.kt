package com.velotrack.sync.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit
import com.velotrack.sync.core.GeoCalculations
import kotlinx.serialization.ExperimentalSerializationApi

@OptIn(ExperimentalSerializationApi::class)
class ApiService(private val configRepo: ConfigRepository) {

    // 与 admin web 端 MAX_DETAIL_POINTS 对齐的逐点明细降采样上限。
    private companion object {
        const val MAX_DETAIL_POINTS = 1500
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    /**
     * 拉取车手档案以注入用户自定义心率(max_hr / resting_hr)。
     * 失败时返回 null,调用方用默认 188/55 兜底。
     */
    suspend fun fetchRiderProfile(): Result<RiderProfile?> = withContext(Dispatchers.IO) {
        try {
            val req = buildRequest("/api/ai/rider/profile", "GET")
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext Result.success(null)
                val bodyStr = resp.body?.string() ?: return@withContext Result.success(null)
                val profile = json.decodeFromString<RiderProfile>(bodyStr)
                Result.success(profile)
            }
        } catch (e: Exception) {
            Result.success(null)
        }
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
        val base = config.baseUrl
        require(base.startsWith("http://") || base.startsWith("https://")) {
            "Invalid base URL scheme: $base"
        }
        val url = "$base${if (path.startsWith("/")) path else "/$path"}"
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
                    val cached = configRepo.getCachedZones()
                    return@withContext if (cached.isNotEmpty()) Result.success(cached)
                    else Result.failure(IOException("拉取隐私圈失败: HTTP ${resp.code} ${resp.message}"))
                }
                val bodyStr = resp.body?.string() ?: "{}"
                val zones = try {
                    json.decodeFromString<PrivacyZonesResponse>(bodyStr).zones
                } catch (_: Exception) {
                    json.decodeFromString<List<PrivacyZone>>(bodyStr)
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
            // 与 admin web 端 MAX_DETAIL_POINTS=1500 对齐：降采样后再序列化，
            // 避免长骑行全量上传撑爆共享虚拟主机的 post_max_size / 超时。
            val sampled = GeoCalculations.downsamplePoints(points, MAX_DETAIL_POINTS)
            val detailItems = sampled.map { pt ->
                DetailPointItem(
                    t = pt.time,
                    lat = pt.lat,
                    lng = pt.lng,
                    altitude = pt.altitude,
                    hr = pt.hr,
                    cadence = pt.cadence,
                    speed = pt.speed
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
                .readTimeout(1500, TimeUnit.MILLISECONDS)
                .connectTimeout(1500, TimeUnit.MILLISECONDS)
                .build()
                .newCall(req)
                .execute()
                .use { resp ->
                    if (!resp.isSuccessful) return@withContext null
                    val respBody = resp.body?.string() ?: return@withContext null
                    val element = json.parseToJsonElement(respBody)
                    if (element is JsonObject) {
                        element["title"]?.jsonPrimitive?.contentOrNull
                            ?: element["suggested_title"]?.jsonPrimitive?.contentOrNull
                    } else {
                        element.jsonPrimitive.contentOrNull
                    }
                }
        } catch (_: Exception) {
            null // 网络或 404 故障直接静默降级为本地规则命名，坚决不阻塞上传流程
        }
    }
}
