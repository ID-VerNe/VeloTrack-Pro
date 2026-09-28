/**
 * VeloTrack 城市行政区域判定、跨城远征分析与聚合分类器
 *
 * 职责：
 * 1. 矩形包围盒与球面距离就近推断骑行所在城市
 * 2. 跨城远征轨迹判定与多城市识别
 * 3. 骑行列表城市多维聚合统计与筛选匹配
 */

import { haversineDistanceKm } from './activity/geoCalculations';
import { decodePolylineToLngLats } from './geoUtils';

export interface CityInfo {
  id: string;
  name: string;
  count: number;
  center?: [number, number];
  isCrossCityCategory?: boolean;
}

export const CITY_BOUNDS = [
  { name: '深圳', minLat: 22.40, maxLat: 22.88, minLng: 113.70, maxLng: 114.65, center: [114.05, 22.54] as [number, number] },
  { name: '广州', minLat: 22.85, maxLat: 23.95, minLng: 112.95, maxLng: 114.05, center: [113.32, 23.12] as [number, number] },
  { name: '惠州', minLat: 22.40, maxLat: 23.95, minLng: 113.80, maxLng: 115.40, center: [114.41, 23.11] as [number, number] },
  { name: '东莞', minLat: 22.65, maxLat: 23.15, minLng: 113.50, maxLng: 114.25, center: [113.75, 23.02] as [number, number] },
  { name: '佛山', minLat: 22.60, maxLat: 23.35, minLng: 112.60, maxLng: 113.30, center: [113.12, 23.02] as [number, number] },
  { name: '中山', minLat: 22.15, maxLat: 22.75, minLng: 113.10, maxLng: 113.65, center: [113.38, 22.52] as [number, number] },
  { name: '珠海', minLat: 21.80, maxLat: 22.45, minLng: 113.05, maxLng: 113.70, center: [113.57, 22.27] as [number, number] },
  { name: '江门', minLat: 21.60, maxLat: 22.85, minLng: 112.00, maxLng: 113.25, center: [113.08, 22.58] as [number, number] },
  { name: '肇庆', minLat: 22.70, maxLat: 24.10, minLng: 111.30, maxLng: 112.90, center: [112.46, 23.05] as [number, number] },
  { name: '清远', minLat: 23.40, maxLat: 25.10, minLng: 111.90, maxLng: 113.95, center: [113.05, 23.68] as [number, number] },
  { name: '韶关', minLat: 23.70, maxLat: 25.50, minLng: 112.80, maxLng: 114.80, center: [113.59, 24.81] as [number, number] },
  { name: '汕头', minLat: 23.10, maxLat: 23.65, minLng: 116.20, maxLng: 117.20, center: [116.68, 23.35] as [number, number] },
  { name: '潮州', minLat: 23.40, maxLat: 24.30, minLng: 116.40, maxLng: 117.20, center: [116.62, 23.66] as [number, number] },
  { name: '揭阳', minLat: 22.80, maxLat: 23.90, minLng: 115.70, maxLng: 116.60, center: [116.37, 23.54] as [number, number] },
  { name: '汕尾', minLat: 22.60, maxLat: 23.50, minLng: 114.80, maxLng: 116.10, center: [115.37, 22.78] as [number, number] },
  { name: '湛江', minLat: 20.20, maxLat: 21.85, minLng: 109.60, maxLng: 110.75, center: [110.35, 21.27] as [number, number] },
  { name: '茂名', minLat: 21.20, maxLat: 22.45, minLng: 110.30, maxLng: 111.45, center: [110.92, 21.66] as [number, number] },
  { name: '阳江', minLat: 21.40, maxLat: 22.40, minLng: 111.20, maxLng: 112.35, center: [111.98, 21.85] as [number, number] },
  { name: '云浮', minLat: 22.30, maxLat: 23.35, minLng: 111.00, maxLng: 112.30, center: [112.04, 22.92] as [number, number] },
  { name: '梅州', minLat: 23.40, maxLat: 24.95, minLng: 115.30, maxLng: 116.90, center: [116.12, 24.28] as [number, number] },
  { name: '河源', minLat: 23.10, maxLat: 24.85, minLng: 114.20, maxLng: 115.65, center: [114.70, 23.74] as [number, number] },
  { name: '北京', minLat: 39.40, maxLat: 41.10, minLng: 115.40, maxLng: 117.50, center: [116.40, 39.90] as [number, number] },
  { name: '上海', minLat: 30.70, maxLat: 31.85, minLng: 120.85, maxLng: 122.20, center: [121.47, 31.23] as [number, number] },
  { name: '杭州', minLat: 29.80, maxLat: 30.60, minLng: 119.20, maxLng: 120.70, center: [120.15, 30.28] as [number, number] },
  { name: '成都', minLat: 30.05, maxLat: 31.45, minLng: 102.90, maxLng: 104.90, center: [104.06, 30.57] as [number, number] },
  { name: '武汉', minLat: 29.95, maxLat: 31.35, minLng: 113.70, maxLng: 115.10, center: [114.30, 30.59] as [number, number] },
  { name: '南京', minLat: 31.20, maxLat: 32.65, minLng: 118.35, maxLng: 119.25, center: [118.79, 32.06] as [number, number] },
  { name: '苏州', minLat: 30.75, maxLat: 32.05, minLng: 119.90, maxLng: 121.35, center: [120.58, 31.29] as [number, number] },
  { name: '厦门', minLat: 24.40, maxLat: 24.90, minLng: 117.85, maxLng: 118.45, center: [118.08, 24.48] as [number, number] },
  { name: '海口', minLat: 19.50, maxLat: 20.20, minLng: 110.10, maxLng: 110.75, center: [110.32, 20.04] as [number, number] },
  { name: '三亚', minLat: 18.15, maxLat: 18.65, minLng: 108.95, maxLng: 110.05, center: [109.51, 18.25] as [number, number] },
  { name: '大理', minLat: 25.30, maxLat: 26.40, minLng: 99.80, maxLng: 100.60, center: [100.22, 25.59] as [number, number] },
  { name: '桂林', minLat: 24.30, maxLat: 26.00, minLng: 109.70, maxLng: 111.40, center: [110.29, 25.27] as [number, number] },
  { name: '西安', minLat: 33.70, maxLat: 34.80, minLng: 107.65, maxLng: 109.80, center: [108.93, 34.34] as [number, number] },
  { name: '重庆', minLat: 28.15, maxLat: 32.20, minLng: 105.25, maxLng: 110.20, center: [106.55, 29.56] as [number, number] },
  { name: '长沙', minLat: 27.80, maxLat: 28.70, minLng: 111.85, maxLng: 114.25, center: [112.93, 28.22] as [number, number] },
  { name: '青岛', minLat: 35.55, maxLat: 37.15, minLng: 119.50, maxLng: 121.00, center: [120.38, 36.06] as [number, number] },
  { name: '昆明', minLat: 24.35, maxLat: 26.55, minLng: 102.15, maxLng: 103.65, center: [102.83, 24.88] as [number, number] },
  { name: '香港', minLat: 22.15, maxLat: 22.60, minLng: 113.80, maxLng: 114.45, center: [114.16, 22.31] as [number, number] },
  { name: '澳门', minLat: 22.10, maxLat: 22.25, minLng: 113.50, maxLng: 113.60, center: [113.54, 22.19] as [number, number] },
];

/**
 * 获取骑行展示用的城市字符串（如 "深圳"、"深圳 → 东莞"、"深圳 ⇄ 东莞"）
 */
export function detectCityForRide(ride: any): string {
  // 1. 优先使用后端已持久化/返回的标准 city 字段
  if (ride && typeof ride.city === 'string' && ride.city.trim() !== '') {
    return ride.city.trim();
  }

  let lat = ride?.start_lat;
  let lng = ride?.start_lng;

  if ((!lat || !lng) && ride?.summary_polyline) {
    const coords = decodePolylineToLngLats(ride.summary_polyline);
    if (coords.length > 0) {
      lng = coords[0][0];
      lat = coords[0][1];
    }
  }

  if (!lat || !lng || (lat === 0 && lng === 0)) return '其他城市';

  // 2. 矩形包围盒精准命中
  for (const city of CITY_BOUNDS) {
    if (lat >= city.minLat && lat <= city.maxLat && lng >= city.minLng && lng <= city.maxLng) {
      return city.name;
    }
  }

  // 3. 球面距离就近兜底（城郊/边缘骑行，半径 <= 55km）
  let closestCity: string | null = null;
  let minDist = Infinity;
  for (const city of CITY_BOUNDS) {
    const dist = haversineDistanceKm(lat, lng, city.center[1], city.center[0]);
    if (dist < minDist) {
      minDist = dist;
      closestCity = city.name;
    }
  }

  if (closestCity && minDist <= 55.0) {
    return closestCity;
  }

  return '其他城市';
}

/**
 * 获取单次骑行涉及的所有城市列表（去重）
 */
export function getRideCities(ride: any): string[] {
  if (ride && Array.isArray(ride.cities) && ride.cities.length > 0) {
    return ride.cities.filter((c: any) => typeof c === 'string' && c.trim() !== '');
  }

  const rawCity = detectCityForRide(ride);
  if (!rawCity || rawCity === '其他城市') {
    return ['其他城市'];
  }

  // 根据箭头连接符安全切分
  const parts = rawCity.split(/\s*(?:→|⇄|->)\s*/);
  const filtered = parts.map((p) => p.trim()).filter((p) => p !== '');
  return Array.from(new Set(filtered.length > 0 ? filtered : [rawCity]));
}

/**
 * 判断某次骑行是否为跨城远征（跨越 2 个或以上不同行政区域）
 */
export function isCrossCityRide(ride: any): boolean {
  if (!ride) return false;
  if (ride.is_cross_city === true || ride.is_cross_city === 1) return true;
  if (typeof ride.city === 'string' && (ride.city.includes('→') || ride.city.includes('⇄') || ride.city.includes('->'))) {
    return true;
  }
  const cities = getRideCities(ride);
  const knownCities = cities.filter((c) => c !== '其他城市');
  return knownCities.length > 1;
}

/**
 * 判断某条骑行记录是否匹配城市筛选条件（支持 'all'、'cross_city' 及具体城市名）
 */
export function matchesCityFilter(ride: any, cityFilter: string): boolean {
  if (!ride || !cityFilter || cityFilter === 'all') return true;
  if (cityFilter === 'cross_city') {
    return isCrossCityRide(ride);
  }
  const cities = getRideCities(ride);
  return cities.includes(cityFilter);
}

/**
 * 聚合骑行列表中的所有城市，并支持多维包含计数与跨城聚合
 */
export function extractCitiesFromRides(rides: any[]): CityInfo[] {
  const cityMap = new Map<string, number>();
  let crossCityCount = 0;

  rides.forEach((ride) => {
    const cities = getRideCities(ride);
    cities.forEach((city) => {
      cityMap.set(city, (cityMap.get(city) || 0) + 1);
    });

    if (isCrossCityRide(ride)) {
      crossCityCount++;
    }
  });

  const cityList: CityInfo[] = [
    { id: 'all', name: '全部城市', count: rides.length },
  ];

  const addedCityNames = new Set<string>();

  // 1. 优先按照标准城市表的推荐顺序展示已识别城市
  CITY_BOUNDS.forEach((c) => {
    const count = cityMap.get(c.name);
    if (count && count > 0) {
      cityList.push({ id: c.name, name: c.name, count, center: c.center });
      addedCityNames.add(c.name);
    }
  });

  // 2. 动态加入任何其他由后端解析出的城市（非 CITY_BOUNDS 预设城市）
  cityMap.forEach((count, name) => {
    if (name !== '其他城市' && !addedCityNames.has(name) && count > 0) {
      cityList.push({ id: name, name, count });
      addedCityNames.add(name);
    }
  });

  // 3. 若存在跨城骑行，加入独立的跨城远征快捷筛选
  if (crossCityCount > 0) {
    cityList.push({
      id: 'cross_city',
      name: '跨城远征',
      count: crossCityCount,
      isCrossCityCategory: true,
    });
  }

  // 4. '其他城市' 始终沉底排在最后
  const otherCount = cityMap.get('其他城市');
  if (otherCount && otherCount > 0) {
    cityList.push({ id: '其他城市', name: '其他城市', count: otherCount });
  }

  return cityList;
}
