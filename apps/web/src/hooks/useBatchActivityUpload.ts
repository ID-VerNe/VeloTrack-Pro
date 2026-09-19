// apps/web/src/hooks/useBatchActivityUpload.ts
//
// 骑行活动批量上传工作流 Hook
// 遵循单一职责（SRP）原则，集中管理批处理状态机、文件解析、隐私圈脱敏、AI 标题润色与远端上传。

import { useState } from 'react';
import type { BatchProgress } from '../components/upload/FileUpload';
import type { PrivacyZone } from '../utils/activity/privacyScrubber';
import { parseActivityFile } from '../utils/activity/activityParser';
import { scrubPrivacyZones } from '../utils/activity/privacyScrubber';
import { uploadRide } from '../utils/activity/adminApiClient';
import { suggestRideTitle } from '../services/aiInsights';

export interface UseBatchActivityUploadParams {
  zones: PrivacyZone[];
  activeZoneIds: Set<string>;
  zonesError: string | null;
}

export type UploadStatus = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

export function useBatchActivityUpload({
  zones,
  activeZoneIds,
  zonesError,
}: UseBatchActivityUploadParams) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [batchProgress, setBatchProgress] = useState<BatchProgress | undefined>(undefined);

  const handleBatchFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    if (zonesError) {
      setUploadStatus('error');
      setErrorMessage(`隐私圈配置未加载成功，已阻止上传：${zonesError}。请检查管理令牌后重试。`);
      return;
    }

    setUploadStatus('uploading');
    setErrorMessage('');

    const activeZones = zones.filter((z) => activeZoneIds.has(z.id));
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    setBatchProgress({
      total: files.length,
      current: 0,
      currentFileName: files[0].name,
      successCount: 0,
      failedCount: 0,
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress({
        total: files.length,
        current: i + 1,
        currentFileName: file.name,
        successCount,
        failedCount,
      });

      try {
        setUploadStatus('parsing');
        const text = await file.text();
        const rawData = parseActivityFile(text, file.name);
        const scrubbedData = scrubPrivacyZones(rawData, activeZones);
        setUploadStatus('uploading');

        // 尝试 AI 智能规范命名
        try {
          const aiRes = await suggestRideTitle({
            start_time: scrubbedData.start_time,
            distance_km: Number(((scrubbedData.distance_meters || 0) / 1000).toFixed(1)),
            avg_speed_kmh: scrubbedData.avg_speed_kmh || 0,
            total_ascent_meters: scrubbedData.total_ascent_meters || 0,
          });
          if (aiRes?.title) {
            scrubbedData.title = aiRes.title;
          }
        } catch {
          // AI 命名失败静默跳过，使用原始文件名标题
        }

        await uploadRide(scrubbedData);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to upload ${file.name}:`, err);
        failedCount++;
        errors.push(`${file.name}: ${err.message || '文件解析或上传错误'}`);
      }

      setBatchProgress({
        total: files.length,
        current: i + 1,
        currentFileName: file.name,
        successCount,
        failedCount,
      });
    }

    if (failedCount === 0) {
      setUploadStatus('success');
      setTimeout(() => {
        setUploadStatus('idle');
        setBatchProgress(undefined);
      }, 4000);
    } else if (successCount > 0) {
      setUploadStatus('success');
      setErrorMessage(`已成功导入 ${successCount} 个活动，${failedCount} 个文件失败。`);
    } else {
      setUploadStatus('error');
      setErrorMessage(errors.slice(0, 3).join('; '));
    }
  };

  return {
    uploadStatus,
    errorMessage,
    batchProgress,
    handleBatchFileSelect,
  };
}
