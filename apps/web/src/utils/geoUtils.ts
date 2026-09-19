import polyline from '@mapbox/polyline';

/**
 * 安全解码 Google Encoded Polyline 字符串为 MapLibre / GeoJSON [lng, lat] 坐标数组
 * 若输入为空、非字符串或解析失败，安全返回空数组
 */
export function decodePolylineToLngLats(polylineStr?: string | null): [number, number][] {
  if (!polylineStr || typeof polylineStr !== 'string') return [];
  try {
    const rawCoords = polyline.decode(polylineStr);
    const result: [number, number][] = [];
    for (let i = 0; i < rawCoords.length; i++) {
      const [lat, lng] = rawCoords[i];
      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        Number.isNaN(lat) ||
        Number.isNaN(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      ) {
        return [];
      }
      result.push([lng, lat]);
    }
    return result;
  } catch {
    return [];
  }
}

// 重新导出城市判定与聚合分类器，保持对现有模块的完全兼容
export {
  CITY_BOUNDS,
  detectCityForRide,
  getRideCities,
  isCrossCityRide,
  matchesCityFilter,
  extractCitiesFromRides,
  type CityInfo,
} from './cityClassifier';
