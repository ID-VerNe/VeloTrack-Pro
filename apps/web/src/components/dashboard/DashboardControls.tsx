import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  MapPin, 
  Layers as MapStyleIcon, 
  ListFilter 
} from 'lucide-react';
import type { CityInfo } from '../../utils/geoUtils';
import { MAP_STYLES, type MapStyleKey } from '../../utils/mapStyles';

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
      {/* Search Bar + City Switcher Pills */}
      <div className="flex items-center space-x-2">
        <div className="relative w-44 sm:w-52">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索路线名称与地点..."
            className="w-full pl-8 pr-7 py-1.5 bg-white/95 backdrop-blur-md rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dynamic City Switcher Capsule Buttons */}
        <div className="flex items-center space-x-1.5 bg-white/90 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 shadow-sm">
          {availableCities.map((city) => {
            const isSelected = selectedCity === city.id;
            return (
              <button
                key={city.id}
                onClick={() => onCitySelect(city.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {city.id !== 'all' && <MapPin className="w-3 h-3 text-slate-400" />}
                <span>{city.name}</span>
                <span
                  className={`text-[10px] font-mono ml-0.5 px-1 py-0.2 rounded-full ${
                    isSelected ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {city.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Layer Switcher Capsule + Legend Popover */}
      <div className="flex items-center space-x-2">
        {/* Style Switcher */}
        <div ref={styleMenuRef} className="relative">
          <button
            onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md hover:bg-white text-slate-800 rounded-xl text-xs font-bold border border-slate-200/80 shadow-sm transition-all cursor-pointer"
          >
            <span>{MAP_STYLES[currentMapStyle]?.icon || '🗺️'}</span>
            <span>{MAP_STYLES[currentMapStyle]?.name || '切换底图'}</span>
          </button>

          {isStyleMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-36 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 z-20">
              {(['light', 'dark', 'satellite', 'terrain'] as MapStyleKey[]).map((key) => {
                const isCurrent = currentMapStyle === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      onMapStyleChange(key);
                      setIsStyleMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <span>{MAP_STYLES[key].icon}</span>
                      <span>{MAP_STYLES[key].name}</span>
                    </span>
                    {isCurrent && <span className="text-[10px]">●</span>}
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
            className="p-1.5 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 rounded-xl border border-slate-200/80 shadow-sm transition-all cursor-pointer"
            title="速度图例"
          >
            <ListFilter className="w-4 h-4" />
          </button>

          {isLegendOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-slate-800 p-3 space-y-2 text-xs font-medium z-20">
              <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider pb-1 border-b border-slate-800">
                动力学速度谱系
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                    <span className="text-slate-300 text-[11px]">&lt; 12 km/h</span>
                  </span>
                  <span className="text-slate-400 text-[10px]">停顿/低速</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                    <span className="text-slate-300 text-[11px]">12 - 18 km/h</span>
                  </span>
                  <span className="text-slate-400 text-[10px]">起步/爬坡</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                    <span className="text-emerald-400 text-[11px] font-bold">18 - 24 km/h</span>
                  </span>
                  <span className="text-emerald-400 text-[10px] font-bold">巡航甜点</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                    <span className="text-blue-400 text-[11px] font-bold">&gt; 24 km/h</span>
                  </span>
                  <span className="text-blue-400 text-[10px] font-bold">冲刺提拉</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
