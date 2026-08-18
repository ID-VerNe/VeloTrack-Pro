/**
 * 高精度中国地理坐标系转换工具 (WGS84 <-> GCJ02 火星坐标系)
 * 解决国内高德地图 (GCJ-02) 与国际开源 OpenTopoMap/CartoDB (WGS-84) 之间的 ~500米 偏移问题。
 */

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.006693421622965943;

function transformLat(lng: number, lat: number): number {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(lng: number, lat: number): number {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/**
 * GCJ-02 (火星坐标系) 转 WGS-84 (国际标准GPS/OpenTopoMap/OSM)
 */
export function gcj02_to_wgs84(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  const mgLat = lat + dLat;
  const mgLng = lng + dLng;
  return [Number((lng * 2 - mgLng).toFixed(6)), Number((lat * 2 - mgLat).toFixed(6))];
}

/**
 * WGS-84 转 GCJ-02 (高德/腾讯)
 */
export function wgs84_to_gcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [Number((lng + dLng).toFixed(6)), Number((lat + dLat).toFixed(6))];
}

/**
 * 根据底图坐标系要求自动转换整条坐标轨迹
 * - 如果底图是 WGS84（如 OpenTopoMap / CartoDB），将 GCJ-02 坐标逆向转回 WGS84，确保与等高线/路网 100% 严丝合缝；
 * - 如果底图是 GCJ02（高德标准矢量 / 高德卫星），直接使用 GCJ-02 坐标。
 */
export function adaptCoordinatesToMapStyle(
  coords: [number, number][],
  styleKey: 'light' | 'dark' | 'satellite' | 'terrain'
): [number, number][] {
  if (!coords || coords.length === 0) return [];
  // light (AMap) and satellite (AMap) are GCJ-02
  // terrain (OpenTopoMap) and dark (CartoDB) are WGS-84
  if (styleKey === 'terrain' || styleKey === 'dark') {
    return coords.map(([lng, lat]) => gcj02_to_wgs84(lng, lat));
  }
  return coords;
}
