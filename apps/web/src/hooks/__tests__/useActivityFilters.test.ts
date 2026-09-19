import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActivityFilters } from '../useActivityFilters';

const mockRides = [
  {
    id: 'r1',
    title: '早晨深圳湾巡航',
    distance_meters: 25000,
    start_time: 1700000000000,
    avg_speed_kmh: 22.5,
    total_ascent_meters: 100,
    city: '深圳',
  },
  {
    id: 'r2',
    title: '广州大学城夜骑',
    distance_meters: 10000,
    start_time: 1700100000000,
    avg_speed_kmh: 26.0,
    total_ascent_meters: 50,
    city: '广州',
  },
  {
    id: 'r3',
    title: '南山百公里拉练',
    distance_meters: 60000,
    start_time: 1700200000000,
    avg_speed_kmh: 20.0,
    total_ascent_meters: 500,
    city: '深圳',
  },
];

describe('useActivityFilters', () => {
  it('默认状态：全部城市、全部里程、时间倒序', () => {
    const { result } = renderHook(() => useActivityFilters({ rides: mockRides }));
    expect(result.current.searchQuery).toBe('');
    expect(result.current.cityFilter).toBe('all');
    expect(result.current.distanceFilter).toBe('all');
    expect(result.current.sortBy).toBe('date_desc');
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.filteredRides).toHaveLength(3);
    // 时间倒序：r3 -> r2 -> r1
    expect(result.current.filteredRides[0].id).toBe('r3');
  });

  it('按关键词过滤标题', () => {
    const { result } = renderHook(() => useActivityFilters({ rides: mockRides }));
    act(() => {
      result.current.setSearchQuery('广州');
    });
    expect(result.current.isFiltered).toBe(true);
    expect(result.current.filteredRides).toHaveLength(1);
    expect(result.current.filteredRides[0].id).toBe('r2');
  });

  it('按城市过滤', () => {
    const { result } = renderHook(() => useActivityFilters({ rides: mockRides }));
    act(() => {
      result.current.setCityFilter('深圳');
    });
    expect(result.current.filteredRides).toHaveLength(2);
  });

  it('按里程分段过滤：short (<15km), medium (15-30km), long (>30km)', () => {
    const { result } = renderHook(() => useActivityFilters({ rides: mockRides }));
    act(() => {
      result.current.setDistanceFilter('short');
    });
    expect(result.current.filteredRides).toHaveLength(1);
    expect(result.current.filteredRides[0].id).toBe('r2');

    act(() => {
      result.current.setDistanceFilter('medium');
    });
    expect(result.current.filteredRides).toHaveLength(1);
    expect(result.current.filteredRides[0].id).toBe('r1');

    act(() => {
      result.current.setDistanceFilter('long');
    });
    expect(result.current.filteredRides).toHaveLength(1);
    expect(result.current.filteredRides[0].id).toBe('r3');
  });

  it('多维度排序支持：速度降序、爬升降序、距离降序', () => {
    const { result } = renderHook(() => useActivityFilters({ rides: mockRides }));
    act(() => {
      result.current.setSortBy('speed_desc');
    });
    expect(result.current.filteredRides[0].id).toBe('r2'); // 26.0 km/h

    act(() => {
      result.current.setSortBy('ascent_desc');
    });
    expect(result.current.filteredRides[0].id).toBe('r3'); // 500m

    act(() => {
      result.current.setSortBy('dist_desc');
    });
    expect(result.current.filteredRides[0].id).toBe('r3'); // 60km
  });

  it('重置筛选还原所有条件', () => {
    const { result } = renderHook(() => useActivityFilters({ rides: mockRides }));
    act(() => {
      result.current.setSearchQuery('深圳');
      result.current.setCityFilter('深圳');
      result.current.setDistanceFilter('long');
      result.current.setSortBy('speed_desc');
    });
    expect(result.current.isFiltered).toBe(true);

    act(() => {
      result.current.resetFilters();
    });
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.cityFilter).toBe('all');
    expect(result.current.distanceFilter).toBe('all');
    expect(result.current.sortBy).toBe('date_desc');
    expect(result.current.filteredRides).toHaveLength(3);
  });

  it('按 cross_city 筛选跨城远征以及按包含在跨城中的子城市筛选', () => {
    const ridesWithCross = [
      ...mockRides,
      {
        id: 'r4',
        title: '深莞跨城远征',
        distance_meters: 80000,
        start_time: 1700300000000,
        avg_speed_kmh: 24.0,
        total_ascent_meters: 200,
        city: '深圳 → 东莞',
        is_cross_city: true,
      },
    ];
    const { result } = renderHook(() => useActivityFilters({ rides: ridesWithCross }));
    act(() => {
      result.current.setCityFilter('cross_city');
    });
    expect(result.current.filteredRides).toHaveLength(1);
    expect(result.current.filteredRides[0].id).toBe('r4');

    act(() => {
      result.current.setCityFilter('东莞');
    });
    expect(result.current.filteredRides).toHaveLength(1);
    expect(result.current.filteredRides[0].id).toBe('r4');

    act(() => {
      result.current.setCityFilter('深圳');
    });
    expect(result.current.filteredRides).toHaveLength(3);
  });
});
