import { useEffect, useCallback, useState } from 'react';
import type { PrivacyZone } from '../utils/privacyScrubber';
import { fetchPrivacyZones } from '../utils/apiClient';

/**
 * 隐私圈拉取 + 激活集合管理 Hook
 * 职责:从后端拉取隐私圈,维护激活集合,区分未加载/加载中/失败/成功四态
 */
export function usePrivacyZones(adminToken: string) {
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [isZonesReady, setIsZonesReady] = useState(false);
  const [activeZoneIds, setActiveZoneIds] = useState<Set<string>>(new Set());

  const loadZones = useCallback(async () => {
    setZonesError(null);
    setIsZonesReady(false);
    try {
      const fetched = await fetchPrivacyZones();
      setZones(fetched);
      setActiveZoneIds(new Set(fetched.map((z) => z.id)));
      setIsZonesReady(true);
    } catch (err: any) {
      setZones([]);
      setActiveZoneIds(new Set());
      setZonesError(err?.message || '隐私圈配置加载失败');
      setIsZonesReady(false);
    }
  }, []);

  useEffect(() => {
    loadZones();
  }, [loadZones, adminToken]);

  const handleToggleZone = useCallback((id: string) => {
    setActiveZoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return {
    zones,
    zonesError,
    isZonesReady,
    activeZoneIds,
    loadZones,
    handleToggleZone,
  };
}
