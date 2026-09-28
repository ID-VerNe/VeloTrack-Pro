import { useEffect } from 'react';
import { KeyRound, Smartphone } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { PrivacyZoneList } from './components/PrivacyZoneList';
import { AIConfigCard } from './components/AIConfigCard';
import { PairingModal } from './components/PairingModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useBatchActivityUpload } from './hooks/useBatchActivityUpload';
import { usePrivacyZones } from './hooks/usePrivacyZones';
import { useAdminToken } from './hooks/useAdminToken';
import { usePairingModal } from './hooks/usePairingModal';

function App() {
  const { adminToken, setAdminTokenState, showTokenInput, setShowTokenInput, saveToken } =
    useAdminToken();
  const { zones, zonesError, isZonesReady, activeZoneIds, loadZones, handleToggleZone } =
    usePrivacyZones(adminToken);
  const { showPairingModal, setShowPairingModal } = usePairingModal();
  const { uploadStatus, errorMessage, batchProgress, handleBatchFileSelect, resetTimerRef } =
    useBatchActivityUpload({
      zones,
      activeZoneIds,
      zonesError,
      isZonesReady,
    });

  // 卸载时清理上传成功后的状态重置定时器,防止内存泄漏与跨组件更新告警
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [resetTimerRef]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F1F5F9] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans flex items-center justify-center">
        {/* Outer Floating Card Container */}
        <div className="max-w-4xl w-full bg-white rounded-[32px] shadow-xl shadow-slate-900/[0.03] border border-slate-200/80 overflow-hidden">
          {/* Header Bar */}
          <header className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-[-0.02em] leading-snug">骑行数据同步与脱敏中心</h1>
              <p className="text-xs text-slate-400 font-normal tracking-[0.01em] mt-1 leading-normal">本地隐私擦除 · 自动纠偏 · 智能命名 · 云端入库</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* 配对移动伴侣按钮 */}
              <button
                aria-label="配对移动端"
                title="配对移动伴侣 (VeloSync)"
                onClick={() => setShowPairingModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 active:scale-[0.98] transition-all duration-100 ease-out cursor-pointer text-xs font-semibold"
              >
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>配对手机</span>
              </button>

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
                    onClick={() => saveToken(adminToken, loadZones)}
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
                  className={`transition-all duration-100 ease-out p-2 rounded-full hover:bg-slate-100 cursor-pointer active:scale-95 ${
                    adminToken ? 'text-emerald-500' : zonesError ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <KeyRound className="w-5 h-5 -translate-x-[0.5px] -translate-y-[0.5px]" />
                </button>
              )}
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[11px] font-semibold tracking-[-0.05em] shadow-inner select-none">
                <span className="-translate-y-[0.5px]">AD</span>
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

            {/* 配对移动伴侣弹窗 */}
            <PairingModal
              isOpen={showPairingModal}
              onClose={() => setShowPairingModal(false)}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
