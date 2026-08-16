import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import type { BatchProgress } from './components/FileUpload';
import { PrivacyZoneList } from './components/PrivacyZoneList';
import { AIConfigCard } from './components/AIConfigCard';
import type { PrivacyZone } from './utils/privacyScrubber';
import { parseActivityFile } from './utils/activityParser';
import { scrubPrivacyZones } from './utils/privacyScrubber';
import { uploadRide, fetchPrivacyZones } from './utils/apiClient';

function App() {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [batchProgress, setBatchProgress] = useState<BatchProgress | undefined>(undefined);
  const [zones, setZones] = useState<PrivacyZone[]>([]);

  useEffect(() => {
    fetchPrivacyZones().then(setZones).catch(console.error);
  }, []);

  const handleBatchFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    setUploadStatus('uploading');
    setErrorMessage('');

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
        const text = await file.text();
        const rawData = parseActivityFile(text, file.name);
        const scrubbedData = scrubPrivacyZones(rawData, zones);

        // Optional Smart Title & Tagging suggestion
        try {
          const aiTitleRes = await fetch('/api/ai/rides/suggest-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_time: scrubbedData.start_time,
              distance_km: Number(((scrubbedData.distance_meters || 0) / 1000).toFixed(1)),
              avg_speed_kmh: scrubbedData.avg_speed_kmh || 0,
              total_ascent_meters: scrubbedData.total_ascent_meters || 0,
              city: (scrubbedData.start_lat || 0) > 22.8 ? '广州' : '深圳',
            }),
          });
          const aiTitleData = await aiTitleRes.json();
          if (aiTitleData.title && !aiTitleData.title.includes('undefined')) {
            scrubbedData.title = aiTitleData.title;
          }
        } catch {
          // Fallback to raw parsed title silently
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
      setErrorMessage(`已成功导入 ${successCount} 个文件，${failedCount} 个文件失败。`);
    } else {
      setUploadStatus('error');
      setErrorMessage(errors.slice(0, 3).join('; '));
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans flex items-center justify-center">
      {/* Outer Floating Card Container */}
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-200/80 overflow-hidden">
        {/* Header Bar */}
        <header className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">骑行数据同步与脱敏中心</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">本地隐私擦除 · 自动纠偏 · 智能命名 · 云端入库</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              aria-label="查看系统通知"
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-50 cursor-pointer active:scale-95"
            >
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-semibold shadow-inner">
              AD
            </div>
          </div>
        </header>

        {/* 2-Column Grid Layout */}
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Upload Box */}
            <div className="lg:col-span-7 flex flex-col justify-center h-full">
              <FileUpload
                onFilesSelect={handleBatchFileSelect}
                status={uploadStatus}
                batchProgress={batchProgress}
                errorMessage={errorMessage}
              />
            </div>

            {/* Right Column: Privacy Zones */}
            <div className="lg:col-span-5">
              <PrivacyZoneList zones={zones} />
            </div>
          </div>

          {/* Model Configuration Card */}
          <AIConfigCard />
        </div>
      </div>
    </div>
  );
}

export default App;
