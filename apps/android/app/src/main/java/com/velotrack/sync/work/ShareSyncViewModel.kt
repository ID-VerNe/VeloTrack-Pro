package com.velotrack.sync.work

import android.content.Context
import android.net.Uri
import androidx.lifecycle.LiveData
import androidx.lifecycle.MediatorLiveData
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.UUID

/**
 * 骑行同步 ViewModel:把 [com.velotrack.sync.ui.ShareReceiverActivity] 的
 * 同步编排职责下放到此处,Activity 只负责 UI 渲染与把文件 Uri 喂给本模型。
 *
 * 通过 WorkManager 入队 [SyncRideWorker],屏幕关闭/进程退后台仍继续保活上传,
 * 取代原先 NonCancellable + lifecycleScope 的脆弱做法。
 *
 * 状态流通过 [MediatorLiveData] 转发 WorkManager 的 WorkInfo LiveData,
 * Activity 用 observe(lifecycleOwner) 订阅,随生命周期自动解绑,无 observeForever 泄漏。
 */
class ShareSyncViewModel(context: Context) {

    private val workManager = WorkManager.getInstance(context)

    private val _state = MediatorLiveData<SyncState>()
    val state: LiveData<SyncState> = _state

    private var currentRequestId: UUID? = null
    private var currentSource: LiveData<WorkInfo>? = null

    /**
     * 入队一条骑行同步任务,立即转为 [SyncState.Running]。
     * 重复入队前会先取消上一条任务,避免并发串扰。
     */
    fun enqueue(uri: Uri, title: String = "骑行记录") {
        currentRequestId?.let { workManager.cancelWorkById(it) }
        currentSource?.let { _state.removeSource(it) }

        val request = OneTimeWorkRequest.Builder(SyncRideWorker::class.java)
            .setInputData(
                workDataOf(
                    SyncRideWorker.KEY_FILE_URI to uri.toString(),
                    SyncRideWorker.KEY_DEFAULT_TITLE to title
                )
            )
            .build()

        currentRequestId = request.id
        _state.value = SyncState.Running(request.id.toString(), "解析中")

        val source = workManager.getWorkInfoByIdLiveData(request.id)
        currentSource = source
        _state.addSource(source) { info ->
            if (info != null) {
                _state.value = mapWorkInfoToState(info, request.id.toString())
            }
        }

        workManager.enqueue(request)
    }

    fun cancel() {
        currentRequestId?.let { workManager.cancelWorkById(it) }
    }

    private fun mapWorkInfoToState(info: WorkInfo, requestId: String): SyncState {
        val outData = info.outputData
        val error = outData.getString(SyncRideWorker.KEY_ERROR)
        val warning = outData.getString(SyncRideWorker.KEY_DETAIL_WARNING)
        return when (info.state) {
            WorkInfo.State.RUNNING -> SyncState.Running(requestId, "同步中")
            WorkInfo.State.SUCCEEDED -> {
                val rideId = outData.getString(SyncRideWorker.KEY_RIDE_ID) ?: ""
                val title = outData.getString(SyncRideWorker.KEY_TITLE) ?: ""
                val distKm = outData.getDouble(SyncRideWorker.KEY_DISTANCE_KM, 0.0)
                SyncState.Success(requestId, rideId, title, distKm, warning)
            }
            WorkInfo.State.FAILED -> SyncState.Failed(requestId, error ?: "同步失败")
            WorkInfo.State.CANCELLED -> SyncState.Failed(requestId, "已取消")
            WorkInfo.State.ENQUEUED -> SyncState.Running(requestId, "排队中")
            WorkInfo.State.BLOCKED -> SyncState.Running(requestId, "等待中")
        }
    }
}
