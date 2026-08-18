import { useState, useEffect } from 'react';
import { Sliders, Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { getAdminToken } from '../utils/apiClient';

export function AIConfigCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('deepseek-v4-flash');
  // 修复：移除硬编码的真实 API Key 初始值（密钥只应由用户输入或后端脱敏回显）
  const [apiKey, setApiKey] = useState('');

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const headers: Record<string, string> = {};
    const token = getAdminToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/ai/config', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setBaseUrl(data.config.base_url || '');
          setModelName(data.config.model_name || 'deepseek-v4-flash');
          // 后端返回的是脱敏值（如 sk-***xxxx），仅用于展示"已配置"状态
          setApiKey(data.config.api_key || '');
        }
      })
      .catch(console.error);
  }, []);

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getAdminToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers,
        // 后端统一使用已保存的密钥，不再把输入框内容（可能是脱敏回显值）回传
        body: JSON.stringify({ base_url: baseUrl, model_name: modelName }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
        setTestMessage(`连通正常 (${data.latencyMs}ms · ${data.model})`);
      } else {
        setTestStatus('error');
        setTestMessage(data.error || '连接失败');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || '网络连接异常');
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getAdminToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ base_url: baseUrl, model_name: modelName, api_key: apiKey }),
      });
      // 修复：原先不检查 res.ok，保存失败也显示"已保存"
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      console.error(err);
      setSaveStatus('error');
      setSaveError(err.message || '保存失败');
      setTimeout(() => setSaveStatus('idle'), 3500);
    }
  };

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden transition-all">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200/80 flex items-center justify-center text-slate-700">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">语言模型与分析服务配置</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              用于单次骑行训练复盘、批量上传智能命名与顾问对话服务
            </p>
          </div>
        </div>

        <div className="text-slate-400">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-200/60 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Base URL */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                API Base URL (OpenAI 协议兼容)
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:37183/v1"
                className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Model Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                模型名称 (Model Name)
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="deepseek-v4-flash"
                className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              API Key (令牌)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
            />
          </div>

          {/* Action Bar */}
          {saveStatus === 'error' && (
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-rose-500">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>保存失败：{saveError}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${testStatus === 'testing' ? 'animate-spin text-blue-600' : ''}`} />
                <span>测试连接</span>
              </button>

              {testStatus === 'success' && (
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{testMessage}</span>
                </span>
              )}
              {testStatus === 'error' && (
                <span className="text-[11px] font-semibold text-rose-500 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{testMessage}</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
            >
              {saveStatus === 'saved' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>已保存</span>
                </>
              ) : (
                <span>保存配置</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
