export const LIGHT_MAP_STYLE: any = {
  version: 8,
  sources: {
    'amap-light': {
      type: 'raster',
      tiles: [
        'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: '&copy; 高德地图',
    },
  },
  layers: [
    {
      id: 'base-light-layer',
      type: 'raster',
      source: 'amap-light',
      minzoom: 0,
      maxzoom: 18,
      paint: {
        // 底图降噪：降低饱和度让彩色道路/林地退后，骑行轨迹成为唯一视觉焦点（与 terrain 底图同一手法）
        'raster-saturation': -0.35,
        'raster-contrast': 0.05,
      },
    },
  ],
};


export const SATELLITE_MAP_STYLE: any = {
  version: 8,
  sources: {
    'amap-satellite': {
      type: 'raster',
      tiles: [
        'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        'https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        'https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: '&copy; 高德卫星',
    },
  },
  layers: [
    {
      id: 'base-satellite-layer',
      type: 'raster',
      source: 'amap-satellite',
      minzoom: 0,
      maxzoom: 18,
    },
  ],
};

export const PASTEL_MAP_STYLE = LIGHT_MAP_STYLE;

export type MapStyleKey = 'light' | 'satellite';

export const MAP_STYLES: Record<MapStyleKey, { name: string; icon: string; style: any }> = {
  light: {
    name: '常规地图',
    icon: '🗺️',
    style: LIGHT_MAP_STYLE,
  },
  satellite: {
    name: '卫星地图',
    icon: '🛰️',
    style: SATELLITE_MAP_STYLE,
  },
};

