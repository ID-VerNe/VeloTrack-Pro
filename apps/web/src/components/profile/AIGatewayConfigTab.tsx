import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2, Wifi, KeyRound, Cpu, Link2 } from 'lucide-react';
import type { AIConfig } from '../../services/aiClient';
import {
  getGatewayKey,
  setGatewayKey,
  getAIConfig,
  updateAIConfig,
  testGatewayConnection,
} from '../../services/aiClient';

interface Props {
  /** 拉到最新后端配置后回调，便于父组件同步缓存 */
  onConfigUpdated?: (config: AIConfig) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function AIGatewayConfigTab({ onConfigUpdated }: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('glm-5.2');
  const [apiKey, setApiKey] = useState('');
  // key 输入框是否明文显示（默认掩码）
  const [showKey, setShowKey] = useState(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // 挂载时拉后端配置 + 读 localStorage 的 key
  useEffect(() => {
    getAIConfig()
      .then((cfg) => {
        setBaseUrl(cfg.base_url);
        setModelName(cfg.model_name || 'glm-5.2');
        onConfigUpdated?.(cfg);
      })
      .catch((err) => {
        setSaveError(err.message || '读取配置失败');
        setSaveStatus('error');
      });
    setApiKey(getGatewayKey());
  }, [onConfigUpdated]);

  const handleSaveConfig = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      const cfg: AIConfig = { base_url: baseUrl.trim(), model_name: modelName.trim() };
      await updateAIConfig(cfg);
      onConfigUpdated?.(cfg);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err.message || '保存失败');
      setTimeout(() => setSaveStatus('idle'), 3500);
    }
  };

  const handleSaveKey = () => {
    setGatewayKey(apiKey.trim());
    setSaveStatus('saved');
    setSaveError('');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    setAvailableModels([]);
    try {
      const cfg: AIConfig = { base_url: baseUrl.trim(), model_name: modelName.trim() };
      // 用输入框当前值测试（未保存也能测），key 同理
      const keyToTest = apiKey.trim();
      setGatewayKey(keyToTest);
      const models = await testGatewayConnection(cfg, keyToTest);
      setAvailableModels(models);
      const inList = models.length === 0 || models.includes(modelName.trim());
      if (inList) {
        setTestStatus('success');
        setTestMessage(
          `连通正常，Gateway 返回 ${models.length} 个可用模型${models.length ? '：' + models.join('、') : ''}`,
        );
      } else {
        setTestStatus('error');
        setTestMessage(
          `连通正常，但当前模型 ${modelName} 不在可用列表 [${models.join('、')}] 中，请检查模型名`,
        );
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || '连通测试失败');
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs font-mono';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 [scrollbar-width:none]">
      {/* Gateway Endpoint */}
      <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3.5 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
          <Link2 className="w-4 h-4 text-blue-600" />
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
                      ? 'bg-slate-900 text-white border-slate-900'
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
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
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
          className="w-full px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
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
          <KeyRound className="w-4 h-4 text-blue-600" />
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
          className="w-full px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>保存到本机</span>
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
