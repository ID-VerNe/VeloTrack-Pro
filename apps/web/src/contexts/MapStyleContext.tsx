import React, { createContext, useCallback, useContext, useState } from 'react';
import type { MapStyleKey } from '../utils/mapStyles';

const STORAGE_KEY = 'velotrack_map_style';

interface MapStyleContextValue {
  /** 当前底图样式（全局共享，跨页面持久） */
  mapStyle: MapStyleKey;
  /** 切换底图样式并写入 localStorage */
  setMapStyle: (style: MapStyleKey) => void;
}

const MapStyleContext = createContext<MapStyleContextValue | null>(null);

function readInitialStyle(): MapStyleKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'satellite') {
      return saved;
    }
  } catch {
    /* localStorage 不可用时静默回退默认值 */
  }
  return 'light';
}

export function MapStyleProvider({ children }: { children: React.ReactNode }) {
  const [mapStyle, setMapStyleState] = useState<MapStyleKey>(readInitialStyle);

  const setMapStyle = useCallback((style: MapStyleKey) => {
    setMapStyleState(style);
    try {
      localStorage.setItem(STORAGE_KEY, style);
    } catch {
      /* 忽略持久化失败（如隐私模式） */
    }
  }, []);

  return (
    <MapStyleContext.Provider value={{ mapStyle, setMapStyle }}>
      {children}
    </MapStyleContext.Provider>
  );
}

export function useMapStyle(): MapStyleContextValue {
  const ctx = useContext(MapStyleContext);
  if (!ctx) {
    throw new Error('useMapStyle 必须在 MapStyleProvider 内使用');
  }
  return ctx;
}
