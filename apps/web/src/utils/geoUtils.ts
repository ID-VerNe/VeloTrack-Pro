import polyline from '@mapbox/polyline';
import { haversineDistanceKm } from './activity/geoCalculations';

export interface CityInfo {
  id: string;
  name: string;
  count: number;
  center?: [number, number];
  isCrossCityCategory?: boolean;
}

const CITY_BOUNDS = [
  { name: '深圳', minLat: 22.4, maxLat: 22.9, minLng: 113.7, maxLng: 114.6, center: [114.05, 22.54] as [number, number] },
  { name: '广州', minLat: 22.85, maxLat: 23.95, minLng: 112.95, maxLng: 114.05, center: [113.32, 23.12] as [number, number] },
  { name: '惠州', minLat: 22.4, maxLat: 23.95, minLng: 113.8, maxLng: 115.4, center: [114.41, 23.11] as [number, number] },
  { name: '东莞', minLat: 22.65, maxLat: 23.15, minLng: 113.5, maxLng: 114.25, center: [113.75, 23.02] as [number, number] },
  { name: '佛山', minLat: 22.6, maxLat: 23.35, minLng: 112.6, maxLng: 113.3, center: [113.12, 23.02] as [number, number] },
  { name: '中山', minLat: 22.15, maxLat: 22.75, minLng: 113.1, maxLng: 113.65, center: [113.38, 22.52] as [number, number] },
  { name: '珠海', minLat: 21.8, maxLat: 22.45, minLng: 113.05, maxLng: 113.7, center: [113.57, 22.27] as [number, number] },
  { name: '江门', minLat: 21.6, maxLat: 22.85, minLng: 112.0, maxLng: 113.25, center: [113.08, 22.58] as [number, number] },
  { name: '清远', minLat: 23.4, maxLat: 25.1, minLng: 111.9, maxLng: 113.95, center: [113.05, 23.68] as [number, number] },
  { name: '杭州', minLat: 29.8, maxLat: 30.6, minLng: 119.2, maxLng: 120.7, center: [120.15, 30.28] as [number, number] },
  { name: '上海', minLat: 30.7, maxLat: 31.85, minLng: 120.85, maxLng: 122.2, center: [121.47, 31.23] as [number, number] },
  { name: '北京', minLat: 39.4, maxLat: 41.1, minLng: 115.4, maxLng: 117.5, center: [116.40, 39.90] as [number, number] },
  { name: '成都', minLat: 30.05, maxLat: 31.45, minLng: 102.9, maxLng: 104.9, center: [104.06, 30.57] as [number, number] },
  { name: '武汉', minLat: 29.95, maxLat: 31.35, minLng: 113.7, maxLng: 115.1, center: [114.30, 30.59] as [number, number] },
  { name: '南京', minLat: 31.2, maxLat: 32.65, minLng: 118.35, maxLng: 119.25, center: [118.79, 32.06] as [number, number] },
  { name: '厦门', minLat: 24.4, maxLat: 24.9, minLng: 117.85, maxLng: 118.45, center: [118.08, 24.48] as [number, number] },
];

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

  // 尝试根据箭头连接符安全切分
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
