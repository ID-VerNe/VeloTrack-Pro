export const PASTEL_MAP_STYLE: any = {
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
      attribution: '&copy; 高德地图 AutoNavi',
    },
  },
  layers: [
    {
      id: 'amap-light-layer',
      type: 'raster',
      source: 'amap-light',
      minzoom: 0,
      maxzoom: 18,
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
      attribution: '&copy; 高德地图卫星',
    },
  },
  layers: [
    {
      id: 'amap-satellite-layer',
      type: 'raster',
      source: 'amap-satellite',
      minzoom: 0,
      maxzoom: 18,
    },
  ],
};

export const MAP_STYLES: Record<'light' | 'satellite', { name: string; style: any }> = {
  light: {
    name: '淡雅矢量',
    style: PASTEL_MAP_STYLE,
  },
  satellite: {
    name: '高清卫星',
    style: SATELLITE_MAP_STYLE,
  },
};
