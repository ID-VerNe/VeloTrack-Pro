import React from 'react';
import { Check, AlertCircle, Loader2, Wifi, KeyRound, Cpu, Link2, ShieldCheck } from 'lucide-react';
import type { AIConfig } from '../../services/aiClient';
import { useAIGatewayConfig } from '../../hooks/useAIGatewayConfig';

interface Props {
  /** 拉到最新后端配置后回调，便于父组件同步缓存 */
  onConfigUpdated?: (config: AIConfig) => void;
}

export default function AIGatewayConfigTab({ onConfigUpdated }: Props) {
  const {
    baseUrl,
    setBaseUrl,
    modelName,
    setModelName,
    apiKey,
    setApiKey,
    showKey,
    setShowKey,
    adminToken,
    setAdminTokenState,
    showAdminToken,
    setShowAdminToken,
    adminTokenSaved,
    saveStatus,
    saveError,
    testStatus,
    testMessage,
    availableModels,
    handleSaveAdminToken,
    handleSaveConfig,
    handleSaveKey,
    handleTestConnection,
  } = useAIGatewayConfig({ onConfigUpdated });

  const inputCls =
    'w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs font-mono';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 [scrollbar-width:none]">
      {/* Gateway Endpoint */}
      <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3.5 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
          <Link2 className="w-4 h-4 text-brand-500" />
          <span>Gateway 端点与模型</span>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">API Base URL（OpenAI 协议兼容）</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api-gateway.yuuverne.site"
            className={inputCls}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-[10px] text-slate-400 mt-1">填到域名根即可，/v1 由前端自动拼。如 https://api-gateway.yuuverne.site</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">模型名称（Model Name）</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="glm-5.2"
            className={inputCls}
            autoComplete="off"
            spellCheck={false}
          />
          {availableModels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {availableModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModelName(m)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                    modelName === m
                      ? 'bg-brand-500 text-white border-brand-500 font-medium shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
          >
            {testStatus === 'testing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>测试连通</span>
          </button>

          {testStatus === 'success' && (
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span className="truncate max-w-[280px]">{testMessage}</span>
            </span>
          )}
          {testStatus === 'error' && (
            <span className="text-[11px] font-semibold text-rose-500 flex items-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[280px]">{testMessage}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saveStatus === 'saving'}
          className="w-full px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 disabled:bg-slate-400 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
        >
          {saveStatus === 'saved' ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>已保存到后端</span>
            </>
          ) : (
            <>
              <Cpu className="w-3.5 h-3.5" />
              <span>{saveStatus === 'saving' ? '保存中...' : '保存 URL 与模型到后端'}</span>
            </>
          )}
        </button>
      </div>

      {/* API Key */}
      <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3.5 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
          <KeyRound className="w-4 h-4 text-brand-500" />
          <span>Gateway Team Key</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          key 只存浏览器 localStorage，不进后端、不进 git。换设备需重新填写。后端只存 base_url + model_name。
        </p>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Team API Key</label>
          <div className="relative">
            <input
              type="text"
              style={showKey ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className={inputCls + ' pr-12'}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 hover:text-slate-700 px-1.5 py-1 cursor-pointer"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveKey}
          className="w-full px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>保存到本机</span>
        </button>
      </div>

      {/* Admin Token (Management & Delete Authorization) */}
      <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>系统管理令牌 (ADMIN_TOKEN)</span>
          </div>
          {adminToken && (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200/60">
              已就绪
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          用于删除骑行活动、清空推演会话等高危操作的身份校验。保存于浏览器本地，请求时携带 Authorization 头。
        </p>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">管理令牌</label>
          <div className="relative">
            <input
              type="text"
              style={showAdminToken ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
              value={adminToken}
              onChange={(e) => setAdminTokenState(e.target.value)}
              placeholder="输入与后端 ADMIN_TOKEN 一致的密钥"
              className={inputCls + ' pr-12'}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
            />
            <button
              type="button"
              onClick={() => setShowAdminToken(!showAdminToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 hover:text-slate-700 px-1.5 py-1 cursor-pointer"
            >
              {showAdminToken ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAdminToken}
          className="w-full px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{adminTokenSaved ? '管理令牌已更新' : '保存管理令牌到本机'}</span>
        </button>
      </div>

      {saveStatus === 'error' && (
        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-rose-500">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}
