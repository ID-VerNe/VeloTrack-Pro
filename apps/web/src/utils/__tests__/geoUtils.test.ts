import { describe, it, expect, vi, afterEach } from 'vitest';
import polyline from '@mapbox/polyline';
import {
  detectCityForRide,
  extractCitiesFromRides,
  getRideCities,
  isCrossCityRide,
} from '../geoUtils';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectCityForRide 城市识别', () => {
  it('优先使用 ride.city 字段', () => {
    expect(detectCityForRide({ city: '惠州', start_lat: 1.0, start_lng: 1.0 })).toBe('惠州');
    expect(detectCityForRide({ city: '深圳' })).toBe('深圳');
    expect(detectCityForRide({ city: '深圳 → 东莞' })).toBe('深圳 → 东莞');
  });

  it('命中惠州边界内的坐标返回 惠州', () => {
    expect(detectCityForRide({ start_lat: 23.09, start_lng: 114.39 })).toBe('惠州');
  });

  it('命中深圳边界内的坐标返回 深圳', () => {
    expect(detectCityForRide({ start_lat: 22.54, start_lng: 114.05 })).toBe('深圳');
    expect(detectCityForRide({ start_lat: 22.4, start_lng: 113.7 })).toBe('深圳');
    expect(detectCityForRide({ start_lat: 22.9, start_lng: 114.6 })).toBe('深圳');
  });

  it('命中广州边界内的坐标返回 广州', () => {
    expect(detectCityForRide({ start_lat: 23.12, start_lng: 113.32 })).toBe('广州');
  });

  it('没有 start 坐标时从 summary_polyline 解码得到起点', () => {
    const polylineStr = polyline.encode([[22.54, 114.05]]);
    expect(detectCityForRide({ summary_polyline: polylineStr })).toBe('深圳');
  });

  it('存在 start 坐标时优先使用 start，忽略 polyline', () => {
    const polylineStr = polyline.encode([[39.9, 116.4]]);
    const ride = { start_lat: 22.54, start_lng: 114.05, summary_polyline: polylineStr };
    expect(detectCityForRide(ride)).toBe('深圳');
  });

  it('polyline 解码失败时兜底返回 其他城市', () => {
    const spy = vi.spyOn(polyline, 'decode').mockImplementation(() => {
      throw new Error('polyline 解码失败');
    });
    expect(detectCityForRide({ summary_polyline: '!_invalid_!' })).toBe('其他城市');
    expect(spy).toHaveBeenCalled();
  });

  it('无任何坐标信息返回 其他城市', () => {
    expect(detectCityForRide({})).toBe('其他城市');
    expect(detectCityForRide({ title: '晨骑' })).toBe('其他城市');
  });

  it('start_lat / start_lng 为 0 或缺失时视为无坐标', () => {
    expect(detectCityForRide({ start_lat: 0, start_lng: 0 })).toBe('其他城市');
    expect(detectCityForRide({ start_lat: 22.54 })).toBe('其他城市');
  });

  it('坐标位于所有城市边界之外返回 其他城市', () => {
    expect(detectCityForRide({ start_lat: 1.3, start_lng: 103.8 })).toBe('其他城市');
  });
});

describe('getRideCities 与 isCrossCityRide 跨城判定', () => {
  it('正确解析显式 cities 数组', () => {
    expect(getRideCities({ cities: ['深圳', '东莞'] })).toEqual(['深圳', '东莞']);
  });

  it('正确解析箭头连接的跨城字符串', () => {
    expect(getRideCities({ city: '深圳 → 东莞' })).toEqual(['深圳', '东莞']);
    expect(getRideCities({ city: '深圳 ⇄ 惠州' })).toEqual(['深圳', '惠州']);
  });

  it('正确识别跨城骑行标记', () => {
    expect(isCrossCityRide({ is_cross_city: true })).toBe(true);
    expect(isCrossCityRide({ city: '深圳 → 东莞' })).toBe(true);
    expect(isCrossCityRide({ cities: ['深圳', '东莞'] })).toBe(true);
    expect(isCrossCityRide({ city: '深圳', cities: ['深圳'] })).toBe(false);
  });
});

describe('extractCitiesFromRides 城市聚合与多维包含', () => {
  it('顺序：全部城市在前、各城市按标准表顺序、跨城聚合、其他城市最后，计数正确', () => {
    const rides = [
      { id: 1, start_lat: 22.54, start_lng: 114.05 }, // 深圳
      { id: 2, start_lat: 22.55, start_lng: 114.06 }, // 深圳
      { id: 3, start_lat: 23.12, start_lng: 113.32 }, // 广州
      { id: 4, start_lat: 39.9, start_lng: 116.4 }, // 北京
      { id: 5 }, // 其他城市
    ];
    const list = extractCitiesFromRides(rides);
    expect(list.map((c) => c.id)).toEqual(['all', '深圳', '广州', '北京', '其他城市']);
    expect(list[0]).toEqual({ id: 'all', name: '全部城市', count: 5 });
    expect(list[1]).toEqual({ id: '深圳', name: '深圳', count: 2, center: [114.05, 22.54] });
    expect(list[2]).toEqual({ id: '广州', name: '广州', count: 1, center: [113.32, 23.12] });
    expect(list[3]).toEqual({ id: '北京', name: '北京', count: 1, center: [116.4, 39.9] });
    expect(list[4]).toEqual({ id: '其他城市', name: '其他城市', count: 1 });
  });

  it('跨城骑行进行多维包含计数，并生成独立的跨城远征选项', () => {
    const rides = [
      { id: 1, city: '深圳', cities: ['深圳'], is_cross_city: false },
      { id: 2, city: '东莞', cities: ['东莞'], is_cross_city: false },
      { id: 3, city: '深圳 → 东莞', cities: ['深圳', '东莞'], is_cross_city: true },
    ];
    const list = extractCitiesFromRides(rides);
    const ids = list.map((c) => c.id);

    expect(ids).toContain('深圳');
    expect(ids).toContain('东莞');
    expect(ids).toContain('cross_city');

    // 深圳：单城 1 次 + 跨城 1 次 = 2 次
    const sz = list.find((c) => c.id === '深圳');
    expect(sz?.count).toBe(2);

    // 东莞：单城 1 次 + 跨城 1 次 = 2 次
    const dg = list.find((c) => c.id === '东莞');
    expect(dg?.count).toBe(2);

    // 跨城远征：1 次
    const cross = list.find((c) => c.id === 'cross_city');
    expect(cross?.count).toBe(1);
    expect(cross?.name).toBe('跨城远征');
    expect(cross?.isCrossCityCategory).toBe(true);
  });

  it('空骑乘列表只返回 全部城市（计数 0）', () => {
    const list = extractCitiesFromRides([]);
    expect(list).toEqual([{ id: 'all', name: '全部城市', count: 0 }]);
  });
});
