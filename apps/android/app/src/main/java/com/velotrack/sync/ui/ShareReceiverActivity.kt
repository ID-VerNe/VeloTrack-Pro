package com.velotrack.sync.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.velotrack.sync.R
import com.velotrack.sync.core.PrivacyScrubber
import com.velotrack.sync.core.TcxParser
import com.velotrack.sync.data.ApiService
import com.velotrack.sync.data.ConfigRepository
import com.velotrack.sync.databinding.DialogShareSyncBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.InputStream

class ShareReceiverActivity : AppCompatActivity() {

    private lateinit var binding: DialogShareSyncBinding
    private lateinit var configRepo: ConfigRepository
    private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = DialogShareSyncBinding.inflate(layoutInflater)
        setContentView(binding.root)

        configRepo = ConfigRepository(this)
        apiService = ApiService(configRepo)

        binding.btnClose.setOnClickListener { finish() }
        binding.root.setOnClickListener { finish() }

        val uri = extractUriFromIntent(intent)
        if (uri == null) {
            Toast.makeText(this, "未检测到有效轨迹文件流", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        startSyncPipeline(uri)
    }

    private fun extractUriFromIntent(intent: Intent): Uri? {
        return when (intent.action) {
            Intent.ACTION_SEND -> {
                intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            }
            Intent.ACTION_VIEW -> {
                intent.data
            }
            else -> null
        }
    }

    private fun startSyncPipeline(uri: Uri) {
        lifecycleScope.launch {
            try {
                // 1. 读取并流式解析 TCX
                binding.tvSyncStep.text = getString(R.string.step_parsing)
                val (rawPayload, rawPoints) = withContext(Dispatchers.IO) {
                    val stream: InputStream = when (uri.scheme) {
                        "file" -> {
                            val path = uri.path ?: throw IllegalStateException("文件路径为空")
                            java.io.File(path).inputStream()
                        }
                        else -> {
                            contentResolver.openInputStream(uri)
                                ?: throw IllegalStateException("无法打开文件流")
                        }
                    }
                    stream.use { TcxParser.parse(it) }
                }

                // 2. 本地脱敏处理
                binding.tvSyncStep.text = getString(R.string.step_scrubbing)
                val zones = withContext(Dispatchers.IO) {
                    val remote = apiService.fetchPrivacyZones().getOrNull()
                    remote ?: configRepo.getCachedZones()
                }

                val (scrubbedPayload, scrubbedPoints) = withContext(Dispatchers.Default) {
                    PrivacyScrubber.scrub(rawPayload, rawPoints, zones)
                }

                // 可选 AI 建议命名
                val aiTitle = withContext(Dispatchers.IO) {
                    val distKm = scrubbedPayload.distanceMeters / 1000.0
                    apiService.suggestTitle(
                        scrubbedPayload.startTime,
                        distKm,
                        scrubbedPayload.avgSpeedKmh,
                        scrubbedPayload.totalAscentMeters
                    )
                }

                val finalPayload = if (!aiTitle.isNullOrBlank()) {
                    scrubbedPayload.copy(title = aiTitle.trim('"', ' ', '\n', '\r'))
                } else {
                    scrubbedPayload
                }

                // 3. 上传到 Cloudflare Worker (Zero Trust 通行证)
                binding.tvSyncStep.text = getString(R.string.step_uploading)
                withContext(Dispatchers.IO) {
                    val res1 = apiService.uploadRide(finalPayload)
                    if (res1.isFailure) throw res1.exceptionOrNull()!!

                    val res2 = apiService.uploadDetailPoints(finalPayload.id, scrubbedPoints)
                    if (res2.isFailure) throw res2.exceptionOrNull()!!
                }

                // 4. 同步成功反馈
                binding.progressBar.visibility = View.GONE
                binding.tvSyncStep.text = getString(R.string.sync_success)
                binding.tvSyncStep.setTextColor(getColor(R.color.success))

                val distKm = String.format("%.1f", finalPayload.distanceMeters / 1000.0)
                binding.tvSyncSummary.text = "《${finalPayload.title}》\n里程: ${distKm}km · 均速: ${finalPayload.avgSpeedKmh}km/h"
                binding.tvSyncSummary.visibility = View.VISIBLE

                delay(1800)
                finish()

            } catch (e: Exception) {
                binding.progressBar.visibility = View.GONE
                binding.tvSyncStep.text = "同步失败"
                binding.tvSyncStep.setTextColor(getColor(R.color.error))
                binding.tvSyncSummary.text = e.localizedMessage ?: "网络或解析异常"
                binding.tvSyncSummary.visibility = View.VISIBLE
                binding.btnClose.visibility = View.VISIBLE
            }
        }
    }
}
