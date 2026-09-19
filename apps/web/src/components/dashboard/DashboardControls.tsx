import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  ListFilter,
  MapPin,
  ChevronDown,
  Check
} from 'lucide-react';
import type { CityInfo } from '../../utils/geoUtils';
import { MAP_STYLES, type MapStyleKey } from '../../utils/mapStyles';
import IconButton from '../common/IconButton';

interface Props {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  availableCities: CityInfo[];
  selectedCity: string;
  onCitySelect: (cityId: string) => void;
  currentMapStyle: MapStyleKey;
  onMapStyleChange: (style: MapStyleKey) => void;
}

export default function DashboardControls({
  searchTerm,
  onSearchChange,
  availableCities,
  selectedCity,
  onCitySelect,
  currentMapStyle,
  onMapStyleChange,
}: Props) {
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

  const styleMenuRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Global click-outside & Escape key handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (styleMenuRef.current && !styleMenuRef.current.contains(e.target as Node)) {
        setIsStyleMenuOpen(false);
      }
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setIsLegendOpen(false);
      }
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsStyleMenuOpen(false);
        setIsLegendOpen(false);
        setIsCityDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 区分主要城市与更多城市（当城市多于 5 个时自适应收折）
  const { primaryCities, overflowCities, isCurrentInOverflow } = useMemo(() => {
    if (availableCities.length <= 5) {
      return { primaryCities: availableCities, overflowCities: [], isCurrentInOverflow: false };
    }
    // 前 4 个作为主选项（通常是 全部城市 + 骑行最多的核心城市 + 跨城）
    const primary = availableCities.slice(0, 4);
    const overflow = availableCities.slice(4);
    const inOverflow = overflow.some((c) => c.id === selectedCity);
    return { primaryCities: primary, overflowCities: overflow, isCurrentInOverflow: inOverflow };
  }, [availableCities, selectedCity]);

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
      {/* Search Bar + City Switcher */}
      <div className="flex items-center space-x-2">
        <div className="relative w-44 sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 translate-x-[0.5px]" aria-hidden="true" />
          <input
            type="text"
            aria-label="搜索路线名称与地点"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索路线名称与地点..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            className="w-full pl-8 pr-7 py-1.5 bg-white/95 backdrop-blur-md rounded-lg text-base sm:text-xs font-normal text-slate-800 placeholder-slate-400 border border-slate-200/90 shadow-2xs focus:outline-none focus:border-slate-400 transition-colors"
          />
          {searchTerm && (
            <IconButton
              size="xs"
              label="清空搜索词"
              onClick={() => onSearchChange('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </IconButton>
          )}
        </div>

        {/* Dynamic City Switcher Buttons */}
        <div className="flex items-center space-x-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-200/90 shadow-2xs">
          {primaryCities.map((city) => {
            const isSelected = selectedCity === city.id;
            const isCross = city.isCrossCityCategory;
            return (
              <button
                key={city.id}
                onClick={() => {
                  onCitySelect(city.id);
                  setIsCityDropdownOpen(false);
                }}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer flex items-center space-x-1 ${
                  isSelected
                    ? isCross
                      ? 'bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-2xs'
                      : 'bg-brand-500 hover:bg-brand-600 text-white font-medium shadow-2xs'
                    : isCross
                    ? 'text-amber-800 bg-amber-50/80 hover:bg-amber-100/90 font-normal border border-amber-200/70'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-normal'
                }`}
              >
                <span>{city.name}</span>
                <span
                  className={`text-[10px] font-mono ml-0.5 px-1 py-0.5 rounded leading-none ${
                    isSelected
                      ? isCross
                        ? 'bg-amber-800 text-amber-100'
                        : 'bg-brand-700 text-brand-100'
                      : isCross
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {city.count}
                </span>
              </button>
            );
          })}

          {/* 更多城市折叠下拉 */}
          {overflowCities.length > 0 && (
            <div ref={cityDropdownRef} className="relative">
              <button
                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer flex items-center space-x-1 ${
                  isCurrentInOverflow
                    ? 'bg-brand-500 hover:bg-brand-600 text-white font-medium shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-normal'
                }`}
                title="更多骑行城市"
              >
                <span>{isCurrentInOverflow ? availableCities.find((c) => c.id === selectedCity)?.name : '更多城市'}</span>
                {isCurrentInOverflow && (
                  <span className="text-[10px] font-mono ml-0.5 px-1 py-0.5 rounded leading-none bg-brand-700 text-brand-100">
                    {availableCities.find((c) => c.id === selectedCity)?.count}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCityDropdownOpen && (
                <div className="absolute left-0 mt-1.5 min-w-[140px] bg-white rounded-lg border border-slate-200 p-1 space-y-0.5 shadow-lg z-20 font-sans">
                  <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center space-x-1">
                    <MapPin className="w-2.5 h-2.5" />
                    <span>更多骑行城市</span>
                  </div>
                  {overflowCities.map((city) => {
                    const isSelected = selectedCity === city.id;
                    const isCross = city.isCrossCityCategory;
                    return (
                      <button
                        key={city.id}
                        onClick={() => {
                          onCitySelect(city.id);
                          setIsCityDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? isCross
                              ? 'bg-amber-600 text-white font-medium'
                              : 'bg-brand-500 text-white font-medium'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{city.name}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <span
                            className={`text-[10px] font-mono px-1 py-0.5 rounded leading-none ${
                              isSelected
                                ? isCross
                                  ? 'bg-amber-800 text-amber-100'
                                  : 'bg-brand-700 text-brand-100'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {city.count}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map Layer Switcher + Legend Popover */}
      <div className="flex items-center space-x-2">
        {/* Style Switcher */}
        <div ref={styleMenuRef} className="relative">
          <button
            onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 rounded-lg text-xs font-normal border border-slate-200/90 shadow-2xs transition-colors cursor-pointer"
          >
            <span aria-hidden="true">{MAP_STYLES[currentMapStyle]?.icon || '🗺️'}</span>
            <span>{MAP_STYLES[currentMapStyle]?.name || '切换底图'}</span>
          </button>

          {isStyleMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-lg border border-slate-200 p-1 space-y-0.5 shadow-lg z-20">
              {(['light', 'satellite'] as MapStyleKey[]).map((key) => {
                const isCurrent = currentMapStyle === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      onMapStyleChange(key);
                      setIsStyleMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <span aria-hidden="true">{MAP_STYLES[key]?.icon || '🗺️'}</span>
                      <span>{MAP_STYLES[key]?.name || key}</span>
                    </span>
                    {isCurrent && <span className="text-xs">●</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend Toggle */}
        <div ref={legendRef} className="relative">
          <button
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="p-1.5 bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 rounded-lg border border-slate-200/90 shadow-2xs transition-colors cursor-pointer"
            aria-label="速度图例"
          >
            <ListFilter className="w-4 h-4" aria-hidden="true" />
          </button>

          {isLegendOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white text-slate-900 rounded-xl border border-slate-200 p-3 space-y-2 text-xs font-normal shadow-lg z-20">
              <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest pb-1.5 border-b border-slate-100">
                动力学速度谱系
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-slate-600">&lt; 12 km/h</span>
                  </span>
                  <span className="text-slate-400 font-sans text-xs">停顿/低速</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span className="text-slate-600">12 - 18 km/h</span>
                  </span>
                  <span className="text-slate-400 font-sans text-xs">起步/爬坡</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-900 font-medium">18 - 24 km/h</span>
                  </span>
                  <span className="text-slate-900 font-sans font-medium text-xs">巡航区间</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-slate-900 font-medium">&gt; 24 km/h</span>
                  </span>
                  <span className="text-slate-900 font-sans font-medium text-xs">高速冲刺</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
