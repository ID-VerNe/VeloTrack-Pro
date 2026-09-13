import { Shield } from 'lucide-react';
import type { PrivacyZone } from '../../utils/activity/privacyScrubber';

interface PrivacyZoneListProps {
  zones: PrivacyZone[];
  activeZoneIds: Set<string>;
  onToggleZone: (id: string) => void;
}

export function PrivacyZoneList({ zones, activeZoneIds, onToggleZone }: PrivacyZoneListProps) {
  return (
    <div className="bg-slate-50/70 rounded-3xl p-6 border border-slate-200/80">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-bold text-slate-800">隐私脱敏安全区</h2>
        </div>
        <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200/60">
          已激活 {activeZoneIds.size} 个区域
        </span>
      </div>

      <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
        在隐私圈内的轨迹点、穿越圈的连线段以及圈内起点坐标都会在上传前被本地擦除，保护家与公司住址的真实位置隐私。
      </p>

      <div className="space-y-3">
        {zones.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-white text-slate-400 text-xs font-medium">
            暂无配置隐私脱敏区域
          </div>
        ) : (
          zones.map((zone) => {
            const isActive = activeZoneIds.has(zone.id);
            return (
              <div
                key={zone.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/70 shadow-xs flex items-center justify-between transition-all"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{zone.name}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                      {zone.latitude.toFixed(4)}°, {zone.longitude.toFixed(4)}°
                    </span>
                    <span className="text-[9px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded-full">
                      {zone.radius_meters}米 保护半径
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleZone(zone.id)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    isActive ? 'bg-brand-500' : 'bg-slate-300'
                  }`}
                  title={isActive ? '点击停用该隐私脱敏区' : '点击启用该隐私脱敏区'}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      isActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
