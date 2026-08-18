import { useState, useEffect, useCallback } from 'react';
import { KeyRound } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import type { BatchProgress } from './components/FileUpload';
import { PrivacyZoneList } from './components/PrivacyZoneList';
import { AIConfigCard } from './components/AIConfigCard';
import type { PrivacyZone } from './utils/privacyScrubber';
import { parseActivityFile } from './utils/activityParser';
import { scrubPrivacyZones } from './utils/privacyScrubber';
import { uploadRide, fetchPrivacyZones, suggestRideTitle, getAdminToken, setAdminToken } from './utils/apiClient';

function App() {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [batchProgress, setBatchProgress] = useState<BatchProgress | undefined>(undefined);
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  // 隐私圈拉取状态：区分"未加载/加载中/失败/成功"，失败时必须阻断上传
  const [zonesError, setZonesError] = useState<string | null>(null);
  // 激活（参与脱敏）的圈集合：修复原先开关为纯 UI 装饰、与上传行为脱钩的问题
  const [activeZoneIds, setActiveZoneIds] = useState<Set<string>>(new Set());
  const [adminToken, setAdminTokenState] = useState(getAdminToken());
  const [showTokenInput, setShowTokenInput] = useState(false);

  const loadZones = useCallback(async () => {
    setZonesError(null);
    try {
      const fetched = await fetchPrivacyZones();
      setZones(fetched);
      // 新拉取的圈默认全部激活
      setActiveZoneIds(new Set(fetched.map((z) => z.id)));
    } catch (err: any) {
      setZones([]);
      setActiveZoneIds(new Set());
      setZonesError(err?.message || '隐私圈配置加载失败');
    }
  }, []);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  const handleToggleZone = (id: string) => {
    setActiveZoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveToken = () => {
    setAdminToken(adminToken.trim());
    setShowTokenInput(false);
    // 令牌更新后立即重试拉取隐私圈
    loadZones();
  };

  const handleBatchFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    // 隐私圈加载失败时阻断上传：宁可不上传，也不能上传未脱敏轨迹
    if (zonesError) {
      setUploadStatus('error');
      setErrorMessage(`隐私圈配置未加载成功，已阻止上传：${zonesError}。请点击右上角钥匙图标配置令牌或稍后重试。`);
      return;
    }

    setUploadStatus('uploading');
    setErrorMessage('');

    // 仅激活的圈参与脱敏
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

        // 可选 AI 智能命名（5 秒超时，失败静默降级为解析器默认标题）
        const aiTitle = await suggestRideTitle({
          start_time: scrubbedData.start_time,
          distance_km: Number(((scrubbedData.distance_meters || 0) / 1000).toFixed(1)),
          avg_speed_kmh: scrubbedData.avg_speed_kmh || 0,
          total_ascent_meters: scrubbedData.total_ascent_meters || 0,
        });
        if (aiTitle) {
          scrubbedData.title = aiTitle;
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
            {/* 管理令牌配置：与后端 ADMIN_TOKEN Secret 配套 */}
            {showTokenInput ? (
              <div className="flex items-center space-x-2">
                <input
                  type="password"
                  value={adminToken}
                  onChange={(e) => setAdminTokenState(e.target.value)}
                  placeholder="粘贴管理令牌"
                  className="w-44 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono"
                  autoFocus
                />
                <button
                  onClick={handleSaveToken}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  保存
                </button>
              </div>
            ) : (
              <button
                aria-label="配置管理令牌"
                title="配置管理令牌（ADMIN_TOKEN）"
                onClick={() => setShowTokenInput(true)}
                className={`transition-colors p-1.5 rounded-full hover:bg-slate-50 cursor-pointer active:scale-95 ${
                  adminToken ? 'text-emerald-500' : zonesError ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <KeyRound className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-semibold shadow-inner">
              AD
            </div>
          </div>
        </header>

        {/* 2-Column Grid Layout */}
        <div className="p-8 space-y-8">
          {zonesError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-xs font-medium text-rose-600 flex items-center justify-between">
              <span>{zonesError}（上传已被阻断，以防未脱敏数据外泄）</span>
              <button onClick={loadZones} className="font-bold underline underline-offset-2 shrink-0 ml-4">
                重试
              </button>
            </div>
          )}

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
              <PrivacyZoneList
                zones={zones}
                activeZoneIds={activeZoneIds}
                onToggleZone={handleToggleZone}
              />
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
