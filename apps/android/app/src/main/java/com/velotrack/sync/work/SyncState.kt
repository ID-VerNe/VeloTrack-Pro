package com.velotrack.sync.work

/**
 * 骑行同步状态机:由 [ShareSyncViewModel] 从 WorkManager WorkInfo 映射而来,
 * [com.velotrack.sync.ui.ShareReceiverActivity] 据此渲染进度条/成功/失败 UI。
 */
sealed class SyncState {
    /** 空闲,尚未入队任何同步任务 */
    object Idle : SyncState()

    /** 运行中(含排队/阻塞),[stepText] 用于显示当前阶段文案 */
    data class Running(val requestId: String, val stepText: String) : SyncState()

    /**
     * 主记录已成功入库。
     * [detailWarning] 非空表示明细点位入库失败,详情页将退化为示意曲线。
     */
    data class Success(
        val requestId: String,
        val rideId: String,
        val title: String,
        val distanceKm: Double,
        val detailWarning: String?
    ) : SyncState()

    /** 失败或已取消,[errorText] 展示给用户 */
    data class Failed(val requestId: String, val errorText: String) : SyncState()
}
