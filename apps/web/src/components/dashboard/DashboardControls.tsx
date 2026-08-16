import React, { useState } from 'react';
import { 
  Search, 
  X, 
  MapPin, 
  Layers as MapStyleIcon, 
  ListFilter 
} from 'lucide-react';
import type { CityInfo } from '../../utils/geoUtils';
import { MAP_STYLES } from '../../utils/mapStyles';

interface Props {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  availableCities: CityInfo[];
  selectedCity: string;
  onCitySelect: (cityId: string) => void;
  currentMapStyle: 'light' | 'satellite';
  onMapStyleChange: (style: 'light' | 'satellite') => void;
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
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
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                {city.id !== 'all' && <MapPin className="w-2.5 h-2.5 mr-0.5" />}
                <span>{city.name}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded-full font-medium ${
                    isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {city.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Map Tools (Style Switcher & Legend) */}
      <div className="flex items-center space-x-2">
        {/* Style Switcher Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setIsStyleMenuOpen(!isStyleMenuOpen);
              setIsLegendOpen(false);
            }}
            className="px-2.5 py-1.5 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 font-bold text-xs rounded-xl border border-slate-200/80 shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
          >
            <MapStyleIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>{MAP_STYLES[currentMapStyle].name}</span>
          </button>

          {isStyleMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 w-36 z-20 animate-in fade-in zoom-in-95 duration-100">
              {(Object.keys(MAP_STYLES) as ('light' | 'satellite')[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    onMapStyleChange(key);
                    setIsStyleMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg font-bold transition-colors cursor-pointer flex items-center justify-between ${
                    currentMapStyle === key
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{MAP_STYLES[key].name}</span>
                  {currentMapStyle === key && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Legend Button & Floating Panel */}
        <div className="relative">
          <button
            onClick={() => {
              setIsLegendOpen(!isLegendOpen);
              setIsStyleMenuOpen(false);
            }}
            className="p-1.5 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 rounded-xl border border-slate-200/80 shadow-sm transition-all cursor-pointer active:scale-95"
            title="查看图例"
          >
            <ListFilter className="w-4 h-4 text-slate-500" />
          </button>

          {isLegendOpen && (
            <div className="absolute right-0 top-full mt-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 p-3 w-48 z-20 animate-in fade-in zoom-in-95 duration-100 text-xs">
              <div className="font-bold text-slate-800 mb-2 text-[11px] uppercase tracking-wider">
                图例说明
              </div>
              <div className="space-y-2 text-[11px] text-slate-600 font-medium">
                <div className="flex items-center space-x-2">
                  <span className="w-3.5 h-1 rounded bg-[#4F46E5]" />
                  <span>当前城市骑行轨迹</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3.5 h-1 rounded bg-[#06B6D4]" />
                  <span>正在悬停高亮轨迹</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>路线起点</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>路线终点</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
