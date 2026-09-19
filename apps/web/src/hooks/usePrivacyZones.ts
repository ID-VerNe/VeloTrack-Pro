import { useState, useEffect, useCallback } from 'react';
import type { PrivacyZone } from '../utils/activity/privacyScrubber';
import { 
  fetchPrivacyZones, 
  getAdminToken, 
  setAdminToken 
} from '../utils/activity/adminApiClient';

export function usePrivacyZones() {
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [activeZoneIds, setActiveZoneIds] = useState<Set<string>>(new Set());
  const [adminToken, setAdminTokenState] = useState(getAdminToken());
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenSavedToast, setTokenSavedToast] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);

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

  return {
    zones,
    zonesError,
    activeZoneIds,
    adminToken,
    setAdminTokenState,
    showTokenInput,
    setShowTokenInput,
    tokenSavedToast,
    showPairingModal,
    setShowPairingModal,
    loadZones,
    handleToggleZone,
    handleSaveToken,
  };
}
