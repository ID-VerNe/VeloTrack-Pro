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
    },
  ],
};

export const DARK_MAP_STYLE: any = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; CARTO Dark Matter',
    },
  },
  layers: [
    {
      id: 'base-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 19,
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

export const TERRAIN_MAP_STYLE: any = {
  version: 8,
  sources: {
    'opentopo-terrain': {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenTopoMap',
    },
  },
  layers: [
    {
      id: 'base-terrain-layer',
      type: 'raster',
      source: 'opentopo-terrain',
      minzoom: 0,
      maxzoom: 17,
      paint: {
        'raster-opacity': 0.82,
        'raster-saturation': -0.45,
        'raster-contrast': 0.08,
      },
    },
  ],
};

export const PASTEL_MAP_STYLE = LIGHT_MAP_STYLE;

export type MapStyleKey = 'light' | 'dark' | 'satellite' | 'terrain';

export const MAP_STYLES: Record<MapStyleKey, { name: string; icon: string; style: any }> = {
  light: {
    name: '清新浅色',
    icon: '☀️',
    style: LIGHT_MAP_STYLE,
  },
  dark: {
    name: '暗夜航道',
    icon: '🌙',
    style: DARK_MAP_STYLE,
  },
  satellite: {
    name: '高清遥感',
    icon: '🛰️',
    style: SATELLITE_MAP_STYLE,
  },
  terrain: {
    name: '等高地形',
    icon: '⛰️',
    style: TERRAIN_MAP_STYLE,
  },
};
