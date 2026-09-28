package com.velotrack.sync.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Observer
import com.velotrack.sync.R
import com.velotrack.sync.databinding.DialogShareSyncBinding
import com.velotrack.sync.work.ShareSyncViewModel
import com.velotrack.sync.work.SyncState

/**
 * 骑行同步接收 Activity。
 *
 * 职责已瘦身为纯 UI 壳:接收系统分享 Intent → 把文件 Uri 喂给 [ShareSyncViewModel] →
 * 观察 [SyncState] 渲染进度/成功/失败。同步编排(解析→脱敏→命名→双阶段上传)全部下放到
 * [com.velotrack.sync.work.SyncRideWorker],由 WorkManager 保活,屏幕关闭/进程退后台不丢失数据。
 *
 * 取代原先 NonCancellable + lifecycleScope 的脆弱做法,删除内联的网络/解析/脱敏逻辑。
 *
 * ViewModel 手动持有(无需 activity-ktx 的 by viewModels 委托),其内部 MediatorLiveData
 * 与本 Activity 生命周期绑定(lifecycleOwner),随 onDestroy 自动解绑,无 observeForever 泄漏。
 */
class ShareReceiverActivity : AppCompatActivity() {

    private lateinit var binding: DialogShareSyncBinding
    private lateinit var viewModel: ShareSyncViewModel

    @Suppress("DEPRECATION")
    private fun extractUriFromIntent(intent: Intent): Uri? {
        return when (intent.action) {
            Intent.ACTION_SEND -> intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            Intent.ACTION_VIEW -> intent.data
            else -> null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = DialogShareSyncBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnClose.setOnClickListener { finish() }
        binding.root.setOnClickListener { finish() }

        val uri = extractUriFromIntent(intent)
        if (uri == null) {
            android.widget.Toast.makeText(this, "未检测到有效轨迹文件流", android.widget.Toast.LENGTH_LONG).show()
            finish()
            return
        }

        viewModel = ShareSyncViewModel(applicationContext)
        viewModel.state.observe(this, Observer { state -> render(state) })
        viewModel.enqueue(uri, getString(R.string.share_target_label))
    }

    private fun render(state: SyncState) {
        when (state) {
            is SyncState.Idle -> Unit

            is SyncState.Running -> {
                binding.progressBar.visibility = View.VISIBLE
                binding.tvSyncStep.text = state.stepText
                binding.tvSyncStep.setTextColor(getColor(R.color.text_secondary))
                binding.tvSyncSummary.visibility = View.GONE
            }

            is SyncState.Success -> {
                binding.progressBar.visibility = View.GONE
                binding.tvSyncStep.text = getString(R.string.sync_success)
                binding.tvSyncStep.setTextColor(getColor(R.color.success))

                val distKm = String.format("%.1f", state.distanceKm)
                val base = "《${state.title}》\n里程: ${distKm}km"
                binding.tvSyncSummary.text = if (state.detailWarning != null) {
                    "$base\n明细缺失: ${state.detailWarning}"
                } else {
                    base
                }
                binding.tvSyncSummary.visibility = View.VISIBLE

                // 成功后短暂停留再关闭,让用户看到结果
                binding.root.postDelayed({ if (!isFinishing) finish() }, 1800)
            }

            is SyncState.Failed -> {
                binding.progressBar.visibility = View.GONE
                binding.tvSyncStep.text = "同步失败"
                binding.tvSyncStep.setTextColor(getColor(R.color.error))
                binding.tvSyncSummary.text = state.errorText
                binding.tvSyncSummary.visibility = View.VISIBLE
                binding.btnClose.visibility = View.VISIBLE
            }
        }
    }
}

