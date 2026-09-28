// apps/admin/src/hooks/useBatchActivityUpload.ts
//
// 骑行活动批量上传工作流 Hook
// 遵循单一职责（SRP）原则,集中管理批处理状态机、文件解析、隐私圈脱敏、AI 标题润色与远端上传。
// 与 apps/web/src/hooks/useBatchActivityUpload.ts 对齐,差异仅在使用 admin 端 apiClient。

import { useState, useRef } from 'react';
import type { BatchProgress } from '../components/FileUpload';
import type { PrivacyZone } from '../utils/privacyScrubber';
import { parseActivityFile } from '../utils/activityParser';
import { scrubPrivacyZones } from '../utils/privacyScrubber';
import { uploadRide, fetchRiderProfile } from '../utils/apiClient';

export interface UseBatchActivityUploadParams {
  zones: PrivacyZone[];
  activeZoneIds: Set<string>;
  zonesError: string | null;
  isZonesReady: boolean;
}

export type UploadStatus = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

export function useBatchActivityUpload({
  zones,
  activeZoneIds,
  zonesError,
  isZonesReady,
}: UseBatchActivityUploadParams) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [batchProgress, setBatchProgress] = useState<BatchProgress | undefined>(undefined);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBatchFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    // 隐私圈未加载就绪或加载失败时坚决阻断上传:宁可不上传,也不能上传未脱敏轨迹
    if (!isZonesReady || zonesError) {
      setUploadStatus('error');
      setErrorMessage(
        zonesError
          ? `隐私圈配置未加载成功,已阻止上传:${zonesError}。请点击右上角钥匙图标配置令牌或稍后重试。`
          : '隐私圈配置尚未加载就绪,为防住址泄露已阻止上传,请稍候重试。'
      );
      return;
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setUploadStatus('uploading');
    setErrorMessage('');

    const activeZones = zones.filter((z) => activeZoneIds.has(z.id));

    // 拉取车手档案以注入用户自定义心率(默认 188/55 兜底)
    let userMaxHr: number | undefined;
    let userRestingHr: number | undefined;
    try {
      const profile = await fetchRiderProfile();
      userMaxHr = profile?.max_hr;
      userRestingHr = profile?.resting_hr;
    } catch (err) {
      console.error('Failed to load rider profile for HR zones, falling back to defaults:', err);
    }

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
        const rawData = parseActivityFile(text, file.name, { userMaxHr, userRestingHr });
        const scrubbedData = scrubPrivacyZones(rawData, activeZones);
        setUploadStatus('uploading');
        await uploadRide(scrubbedData);
        successCount++;
      } catch (err: any) {
        if (err?.code === 'DETAIL_POINTS_MISSING') {
          // 主记录已入库,仅明细缺失:计入成功但标注 warning
          successCount++;
          errors.push(`${file.name}: ${err.message}`);
        } else {
          console.error(`Failed to upload ${file.name}:`, err);
          failedCount++;
          errors.push(`${file.name}: ${err.message || '文件解析或上传错误'}`);
        }
      }

      setBatchProgress({
        total: files.length,
        current: i + 1,
        currentFileName: file.name,
        successCount,
        failedCount,
      });
    }

    if (failedCount === 0 && errors.length === 0) {
      setUploadStatus('success');
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setUploadStatus('idle');
        setBatchProgress(undefined);
      }, 4000);
    } else if (successCount > 0 && failedCount === 0) {
      // 全部主记录成功,但部分明细缺失(warning)
      setUploadStatus('success');
      setErrorMessage(`已导入 ${successCount} 个活动。${errors.slice(0, 3).join('; ')}`);
    } else if (successCount > 0) {
      setUploadStatus('success');
      setErrorMessage(`已成功导入 ${successCount} 个文件,${failedCount} 个文件失败。`);
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
    resetTimerRef,
  };
}
