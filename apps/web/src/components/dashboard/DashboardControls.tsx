import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ListFilter } from 'lucide-react';
import type { CityInfo } from '../../utils/geoUtils';
import { MAP_STYLES, type MapStyleKey } from '../../utils/mapStyles';
import IconButton from '../common/IconButton';
import CitySwitcher from './CitySwitcher';

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

  const styleMenuRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  // Global click-outside & Escape key handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (styleMenuRef.current && !styleMenuRef.current.contains(e.target as Node)) {
        setIsStyleMenuOpen(false);
      }
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setIsLegendOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsStyleMenuOpen(false);
        setIsLegendOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

        {/* Dynamic City Switcher */}
        <CitySwitcher
          availableCities={availableCities}
          selectedCity={selectedCity}
          onCitySelect={onCitySelect}
        />
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
