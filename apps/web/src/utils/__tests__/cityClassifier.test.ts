import { describe, it, expect } from 'vitest';
import {
  detectCityForRide,
  extractCitiesFromRides,
  getRideCities,
  isCrossCityRide,
  matchesCityFilter,
  CITY_BOUNDS,
} from '../cityClassifier';

describe('cityClassifier', () => {
  describe('CITY_BOUNDS 预设边界', () => {
    it('包含深圳、广州、东莞等核心城市配置', () => {
      const cityNames = CITY_BOUNDS.map((c) => c.name);
      expect(cityNames).toContain('深圳');
      expect(cityNames).toContain('广州');
      expect(cityNames).toContain('东莞');
      expect(cityNames).toContain('惠州');
    });
  });

  describe('detectCityForRide', () => {
    it('直接返回已有的合法 city 字段', () => {
      expect(detectCityForRide({ city: '深圳' })).toBe('深圳');
      expect(detectCityForRide({ city: '广州 → 佛山' })).toBe('广州 → 佛山');
    });

    it('根据经纬度命中广州', () => {
      expect(detectCityForRide({ start_lat: 23.12, start_lng: 113.32 })).toBe('广州');
    });

    it('无坐标时兜底返回 其他城市', () => {
      expect(detectCityForRide(null)).toBe('其他城市');
      expect(detectCityForRide({ start_lat: 0, start_lng: 0 })).toBe('其他城市');
    });
  });

  describe('isCrossCityRide & getRideCities', () => {
    it('识别箭头分隔的跨城字符串', () => {
      expect(isCrossCityRide({ city: '深圳 → 东莞' })).toBe(true);
      expect(isCrossCityRide({ city: '广州 ⇄ 佛山' })).toBe(true);
      expect(isCrossCityRide({ is_cross_city: 1 })).toBe(true);
    });

    it('单城市不为跨城', () => {
      expect(isCrossCityRide({ city: '深圳' })).toBe(false);
      expect(getRideCities({ city: '深圳' })).toEqual(['深圳']);
    });

    it('切分跨城城市列表', () => {
      expect(getRideCities({ city: '深圳 → 东莞' })).toEqual(['深圳', '东莞']);
    });
  });

  describe('matchesCityFilter', () => {
    it('all 匹配任意骑行', () => {
      expect(matchesCityFilter({ city: '深圳' }, 'all')).toBe(true);
    });

    it('cross_city 精确匹配跨城骑行', () => {
      expect(matchesCityFilter({ city: '深圳 → 东莞' }, 'cross_city')).toBe(true);
      expect(matchesCityFilter({ city: '深圳' }, 'cross_city')).toBe(false);
    });

    it('匹配单城市名', () => {
      expect(matchesCityFilter({ city: '深圳' }, '深圳')).toBe(true);
      expect(matchesCityFilter({ city: '广州' }, '深圳')).toBe(false);
      expect(matchesCityFilter({ city: '深圳 → 东莞' }, '东莞')).toBe(true);
    });
  });

  describe('extractCitiesFromRides', () => {
    it('正确聚合城市列表并生成全部城市与跨城统计', () => {
      const rides = [
        { city: '深圳' },
        { city: '深圳' },
        { city: '广州' },
        { city: '深圳 → 东莞' },
      ];
      const result = extractCitiesFromRides(rides);
      expect(result[0]).toEqual({ id: 'all', name: '全部城市', count: 4 });
      const shenzhen = result.find((c) => c.name === '深圳');
      expect(shenzhen?.count).toBe(3); // 2 个单城 + 1 个跨城
      const crossCity = result.find((c) => c.id === 'cross_city');
      expect(crossCity?.count).toBe(1);
    });
  });
});
