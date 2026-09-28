package com.velotrack.sync.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.velotrack.sync.core.PrivacyScrubber
import com.velotrack.sync.core.TcxParser
import com.velotrack.sync.data.ApiService
import com.velotrack.sync.data.ConfigRepository
import com.velotrack.sync.data.GeoPoint
import com.velotrack.sync.data.RideUploadPayload
import com.velotrack.sync.data.RiderProfile

/**
 * 骑行同步 Worker:在 WorkManager 后台线程中完成解析→脱敏→命名→双阶段上传。
 *
 * 取代 [com.velotrack.sync.ui.ShareReceiverActivity] 内联的 NonCancellable 协程管线:
 * - 屏幕关闭或 Activity 被系统回收后,WorkManager 继续保活上传,不丢失骑行数据。
 * - 失败自动指数退避重试,主记录成功后明细失败不回滚主记录(区分处理)。
 *
 * 输入数据(通过 [workDataOf] 传入):
 * - KEY_FILE_URI: 待同步文件的 content/file Uri 字符串
 * - KEY_DEFAULT_TITLE: 解析兜底标题
 */
class SyncRideWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val fileUriString = inputData.getString(KEY_FILE_URI)
            ?: return Result.failure(workDataOf(KEY_ERROR to "缺少文件 Uri"))

        val title = inputData.getString(KEY_DEFAULT_TITLE) ?: "骑行记录"
        val appContext = applicationContext

        val configRepo = ConfigRepository(appContext)
        val apiService = ApiService(configRepo)

        return try {
            // 0. 拉取车手档案注入心率(失败用默认 188/55)
            val profile: RiderProfile? = apiService.fetchRiderProfile().getOrNull()
            val userMaxHr = profile?.maxHr ?: 188
            val userRestingHr = profile?.restingHr ?: 55

            // 1. 读取并流式解析 TCX/GPX
            val (rawPayload, rawPoints) = readAndParse(appContext, fileUriString, title, userMaxHr, userRestingHr)

            // 2. 拉取隐私圈并本地脱敏(失败用缓存)
            val zones = apiService.fetchPrivacyZones().getOrNull()
                ?: configRepo.getCachedZones()
            val (scrubbedPayload, scrubbedPoints) = PrivacyScrubber.scrub(rawPayload, rawPoints, zones)

            // 3. 可选 AI 命名(失败静默降级)
            val finalPayload = applyAiTitle(apiService, scrubbedPayload)

            // 4. 双阶段上传:主记录必须成功,明细失败单独标记
            apiService.uploadRide(finalPayload).getOrThrow()

            val detailResult = apiService.uploadDetailPoints(finalPayload.id, scrubbedPoints)
            if (detailResult.isFailure) {
                // 主记录已入库,明细缺失:任务整体视为成功,但回传明细 warning
                return Result.success(
                    workDataOf(
                        KEY_RIDE_ID to finalPayload.id,
                        KEY_TITLE to finalPayload.title,
                        KEY_DETAIL_WARNING to (detailResult.exceptionOrNull()?.message ?: "明细上传失败")
                    )
                )
            }

            Result.success(
                workDataOf(
                    KEY_RIDE_ID to finalPayload.id,
                    KEY_TITLE to finalPayload.title,
                    KEY_DISTANCE_KM to (finalPayload.distanceMeters / 1000.0)
                )
            )
        } catch (e: Exception) {
            // 解析/脱敏/主记录上传失败:可重试的网络错误用 retry,不可恢复的解析错误用 failure
            val msg = e.localizedMessage ?: e.toString()
            if (runAttemptCount < MAX_RETRIES && isTransient(e)) {
                // Result.retry() 不接受 outputData,失败原因在下一次 RUNNING/SUCCEEDED 时
                // 无法回传;此处仅控制重试与否,详细错误由异常堆栈进入 Logcat
                return Result.retry()
            }
            Result.failure(workDataOf(KEY_ERROR to msg))
        }
    }

    private fun readAndParse(
        context: Context,
        uriString: String,
        title: String,
        userMaxHr: Int,
        userRestingHr: Int
    ): Pair<RideUploadPayload, List<GeoPoint>> {
        val uri = android.net.Uri.parse(uriString)
        val stream = when (uri.scheme) {
            "file" -> {
                val path = uri.path ?: throw IllegalStateException("文件路径为空")
                java.io.File(path).inputStream()
            }
            else -> {
                context.contentResolver.openInputStream(uri)
                    ?: throw IllegalStateException("无法打开文件流")
            }
        }
        return stream.use { TcxParser.parse(it, title, userMaxHr, userRestingHr) }
    }

    private suspend fun applyAiTitle(
        apiService: ApiService,
        payload: RideUploadPayload
    ): RideUploadPayload {
        val distKm = payload.distanceMeters / 1000.0
        val aiTitle = apiService.suggestTitle(
            payload.startTime,
            distKm,
            payload.avgSpeedKmh,
            payload.totalAscentMeters
        )
        return if (!aiTitle.isNullOrBlank()) {
            payload.copy(title = aiTitle.trim('"', ' ', '\n', '\r'))
        } else {
            payload
        }
    }

    private fun isTransient(e: Throwable): Boolean {
        // 网络超时/连接重置等可重试;解析错误(IllegalArgumentException/IllegalStateException)不可重试
        val msg = e.localizedMessage ?: e.toString()
        return msg.contains("HTTP 5", true) ||
            msg.contains("timeout", true) ||
            msg.contains("reset", true) ||
            msg.contains("Unable to resolve host", true)
    }

    companion object {
        const val KEY_FILE_URI = "file_uri"
        const val KEY_DEFAULT_TITLE = "default_title"
        const val KEY_RIDE_ID = "ride_id"
        const val KEY_TITLE = "title"
        const val KEY_DISTANCE_KM = "distance_km"
        const val KEY_DETAIL_WARNING = "detail_warning"
        const val KEY_ERROR = "error"

        const val MAX_RETRIES = 3
    }
}
