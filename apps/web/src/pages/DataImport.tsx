import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Check, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { FileUpload, type BatchProgress } from '../components/upload/FileUpload';
import { PrivacyZoneList } from '../components/upload/PrivacyZoneList';
import type { PrivacyZone } from '../utils/activity/privacyScrubber';
import { parseActivityFile } from '../utils/activity/activityParser';
import { scrubPrivacyZones } from '../utils/activity/privacyScrubber';
import { 
  uploadRide, 
  fetchPrivacyZones, 
  getAdminToken, 
  setAdminToken 
} from '../utils/activity/adminApiClient';
import { suggestRideTitle } from '../services/aiInsights';

export default function DataImport() {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [batchProgress, setBatchProgress] = useState<BatchProgress | undefined>(undefined);
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [activeZoneIds, setActiveZoneIds] = useState<Set<string>>(new Set());
  const [adminToken, setAdminTokenState] = useState(getAdminToken());
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenSavedToast, setTokenSavedToast] = useState(false);

  const loadZones = useCallback(async () => {
    setZonesError(null);
    try {
      const fetched = await fetchPrivacyZones();
      setZones(fetched);
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
    setTokenSavedToast(true);
    setTimeout(() => setTokenSavedToast(false), 2000);
    loadZones();
  };

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

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto bg-slate-50/50 min-w-0">
        <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-8">
          {/* Top Navigation & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mb-1.5">
                <Link to="/" className="hover:text-slate-700 flex items-center transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  返回仪表盘
                </Link>
                <span>/</span>
                <span>骑行遥测</span>
                <span>/</span>
                <span className="text-slate-600 font-medium">数据入库与脱敏</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
                <span>导入骑行数据</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  本地脱敏保护
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1">
                支持 TCX / GPX 批量解析入库 · 轨迹自动校准 GCJ-02 · 敏感起点/终点坐标本地抹除
              </p>
            </div>

            {/* Admin Token Control */}
            <div className="flex items-center space-x-3 self-start sm:self-auto">
              {tokenSavedToast && (
                <span className="text-xs font-medium text-emerald-600 flex items-center animate-in fade-in">
                  <Check className="w-3.5 h-3.5 mr-1" />
                  令牌已就绪
                </span>
              )}

              {showTokenInput ? (
                <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
                  <input
                    type="text"
                    style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                    value={adminToken}
                    onChange={(e) => setAdminTokenState(e.target.value)}
                    placeholder="粘贴 ADMIN_TOKEN"
                    className="w-44 px-2.5 py-1 text-xs border-0 focus:outline-none font-mono text-slate-800 placeholder-slate-400"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                  />
                  <button
                    type="button"
                    onClick={handleSaveToken}
                    className="text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTokenInput(true)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    adminToken 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-xs' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-xs'
                  }`}
                  title="配置自定义管理令牌（默认使用 Cloudflare Worker 环境变量中配置的 ADMIN_TOKEN）"
                >
                  <KeyRound className={`w-3.5 h-3.5 ${adminToken ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{adminToken ? '已覆盖自定义令牌' : '云端令牌已就绪'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Zones Warning if error */}
          {zonesError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-3.5 text-xs font-medium text-rose-700 flex items-center justify-between">
              <span>{zonesError}</span>
              <button 
                type="button" 
                onClick={loadZones} 
                className="font-bold underline underline-offset-2 shrink-0 ml-4 cursor-pointer hover:text-rose-900"
              >
                重试连接
              </button>
            </div>
          )}

          {/* Main 2-Column Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Upload Box */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <h2 className="text-base font-bold text-slate-800 mb-1">选择或拖入骑行文件</h2>
              <p className="text-xs text-slate-400 mb-5">
                支持单个或多个 .tcx、.gpx 文件同时导入，系统将自动解算动力学参数
              </p>
              <FileUpload
                onFilesSelect={handleBatchFileSelect}
                status={uploadStatus}
                batchProgress={batchProgress}
                errorMessage={errorMessage}
              />
            </div>

            {/* Right Column: Privacy Zones */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <PrivacyZoneList
                zones={zones}
                activeZoneIds={activeZoneIds}
                onToggleZone={handleToggleZone}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
