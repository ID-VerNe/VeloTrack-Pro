import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, MapPin, Check } from 'lucide-react';
import type { CityInfo } from '../../utils/geoUtils';

export interface CitySwitcherProps {
  availableCities: CityInfo[];
  selectedCity: string;
  onCitySelect: (cityId: string) => void;
}

export default function CitySwitcher({
  availableCities,
  selectedCity,
  onCitySelect,
}: CitySwitcherProps) {
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Global click-outside & Escape key handlers for city dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
  );
}
