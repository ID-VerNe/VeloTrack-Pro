import { useState, useMemo } from 'react';
import { detectCityForRide, extractCitiesFromRides, type CityInfo } from '../utils/geoUtils';

export type ActivitySortOption = 'date_desc' | 'dist_desc' | 'speed_desc' | 'ascent_desc';
export type ActivityDistanceOption = 'all' | 'short' | 'medium' | 'long';
export type ActivityViewMode = 'grid' | 'list';

export interface UseActivityFiltersOptions {
  rides: any[];
}

export function useActivityFilters({ rides }: UseActivityFiltersOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<ActivityDistanceOption>('all');
  const [sortBy, setSortBy] = useState<ActivitySortOption>('date_desc');
  const [viewMode, setViewMode] = useState<ActivityViewMode>('grid');

  const availableCities: CityInfo[] = useMemo(() => extractCitiesFromRides(rides), [rides]);

  const isFiltered =
    searchQuery.trim() !== '' ||
    cityFilter !== 'all' ||
    distanceFilter !== 'all' ||
    sortBy !== 'date_desc';

  const resetFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
    setDistanceFilter('all');
    setSortBy('date_desc');
  };

  const filteredRides = useMemo(() => {
    return rides
      .filter((r) => {
        const titleMatch = (r.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        const city = detectCityForRide(r);
        const cityMatch = cityFilter === 'all' || city === cityFilter;

        const distKm = (r.distance_meters || 0) / 1000;
        let distMatch = true;
        if (distanceFilter === 'short') distMatch = distKm < 15;
        else if (distanceFilter === 'medium') distMatch = distKm >= 15 && distKm <= 30;
        else if (distanceFilter === 'long') distMatch = distKm > 30;

        return titleMatch && cityMatch && distMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return (b.start_time || 0) - (a.start_time || 0);
        if (sortBy === 'dist_desc') return (b.distance_meters || 0) - (a.distance_meters || 0);
        if (sortBy === 'speed_desc') return (b.avg_speed_kmh || 0) - (a.avg_speed_kmh || 0);
        if (sortBy === 'ascent_desc') return (b.total_ascent_meters || 0) - (a.total_ascent_meters || 0);
        return 0;
      });
  }, [rides, searchQuery, cityFilter, distanceFilter, sortBy]);

  return {
    searchQuery,
    setSearchQuery,
    cityFilter,
    setCityFilter,
    distanceFilter,
    setDistanceFilter,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    availableCities,
    filteredRides,
    isFiltered,
    resetFilters,
  };
}
