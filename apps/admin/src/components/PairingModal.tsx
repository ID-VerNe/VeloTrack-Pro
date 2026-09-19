import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Smartphone, X, Check, Copy } from 'lucide-react';
import { getAdminToken } from '../utils/apiClient';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PairingModal({ isOpen, onClose }: PairingModalProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [adminToken, setAdminTokenState] = useState('');
  const [cfClientId, setCfClientId] = useState('');
  const [cfClientSecret, setCfClientSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://cycling.yuuverne.site';
      setBaseUrl(currentOrigin);
      setAdminTokenState(getAdminToken());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const payload = JSON.stringify({
      baseUrl: baseUrl.trim(),
      adminToken: adminToken.trim(),
      cfClientId: cfClientId.trim(),
      cfClientSecret: cfClientSecret.trim(),
    });

    QRCode.toDataURL(payload, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [baseUrl, adminToken, cfClientId, cfClientSecret, isOpen]);

  if (!isOpen) return null;

  const handleCopyPayload = () => {
    const payload = JSON.stringify({
      baseUrl: baseUrl.trim(),
      adminToken: adminToken.trim(),
      cfClientId: cfClientId.trim(),
      cfClientSecret: cfClientSecret.trim(),
    });
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">配对移动伴侣 (VeloSync)</h2>
              <p className="text-xs text-slate-400">扫码即可自动导入网关地址、管理令牌与 Zero Trust 凭据</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Pairing QR Code" className="w-56 h-56 rounded-xl shadow-sm border border-white" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                正在生成二维码...
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500 font-medium text-center">
              打开手机 VeloSync App $\rightarrow$ 点击“扫码配对电脑端”对准本码
            </p>
          </div>

          {/* Credentials Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Base URL (Cloudflare Worker 域名)
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                placeholder="https://cycling.yuuverne.site"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  CF Client ID
                </label>
                <input
                  type="text"
                  value={cfClientId}
                  onChange={(e) => setCfClientId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-mono"
                  placeholder="Service Token ID"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  CF Client Secret
                </label>
                <input
                  type="password"
                  value={cfClientSecret}
                  onChange={(e) => setCfClientSecret(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-mono"
                  placeholder="Service Token Secret"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleCopyPayload}
            className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制文本' : '复制配对 JSON'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
