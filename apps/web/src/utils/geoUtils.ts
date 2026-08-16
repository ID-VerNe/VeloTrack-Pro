import polyline from '@mapbox/polyline';

export interface CityInfo {
  id: string;
  name: string;
  count: number;
  center?: [number, number];
}

const CITY_BOUNDS = [
  { name: '深圳', minLat: 22.4, maxLat: 22.9, minLng: 113.7, maxLng: 114.6, center: [114.05, 22.54] as [number, number] },
  { name: '广州', minLat: 22.9, maxLat: 23.6, minLng: 113.0, maxLng: 113.8, center: [113.32, 23.12] as [number, number] },
  { name: '东莞', minLat: 22.7, maxLat: 23.2, minLng: 113.6, maxLng: 114.3, center: [113.75, 23.02] as [number, number] },
  { name: '佛山', minLat: 22.7, maxLat: 23.3, minLng: 112.7, maxLng: 113.3, center: [113.12, 23.02] as [number, number] },
  { name: '杭州', minLat: 29.9, maxLat: 30.6, minLng: 119.8, maxLng: 120.6, center: [120.15, 30.28] as [number, number] },
  { name: '上海', minLat: 30.8, maxLat: 31.6, minLng: 121.0, maxLng: 122.0, center: [121.47, 31.23] as [number, number] },
  { name: '北京', minLat: 39.4, maxLat: 40.5, minLng: 115.8, maxLng: 117.2, center: [116.40, 39.90] as [number, number] },
  { name: '成都', minLat: 30.3, maxLat: 31.0, minLng: 103.8, maxLng: 104.4, center: [104.06, 30.57] as [number, number] },
];

export function detectCityForRide(ride: any): string {
  let lat = ride.start_lat;
  let lng = ride.start_lng;

  if ((!lat || !lng) && ride.summary_polyline) {
    try {
      const coords = polyline.decode(ride.summary_polyline);
      if (coords.length > 0) {
        lat = coords[0][0];
        lng = coords[0][1];
      }
    } catch {
      // fallback
    }
  }

  if (!lat || !lng) return '其他城市';

  for (const city of CITY_BOUNDS) {
    if (lat >= city.minLat && lat <= city.maxLat && lng >= city.minLng && lng <= city.maxLng) {
      return city.name;
    }
  }

  return '其他城市';
}

export function extractCitiesFromRides(rides: any[]): CityInfo[] {
  const cityCountMap = new Map<string, number>();

  rides.forEach((ride) => {
    const cityName = detectCityForRide(ride);
    cityCountMap.set(cityName, (cityCountMap.get(cityName) || 0) + 1);
  });

  const cityList: CityInfo[] = [
    { id: 'all', name: '全部城市', count: rides.length },
  ];

  CITY_BOUNDS.forEach((c) => {
    const count = cityCountMap.get(c.name);
    if (count && count > 0) {
      cityList.push({ id: c.name, name: c.name, count, center: c.center });
    }
  });

  // Check '其他城市'
  const otherCount = cityCountMap.get('其他城市');
  if (otherCount && otherCount > 0) {
    cityList.push({ id: '其他城市', name: '其他城市', count: otherCount });
  }

  return cityList;
}
