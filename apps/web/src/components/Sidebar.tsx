import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import RiderProfileDrawer from './RiderProfileDrawer';
import type { RiderProfile } from '../types/rider';
import { getNaturalWeekRange } from '../utils/dateUtils';

interface NavSection {
  title: string;
  items: {
    name: string;
    path: string;
    badge?: string;
    external?: boolean;
  }[];
}

export default function Sidebar() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // 修复：原先硬编码一套"个人数据"（58kg/168cm/female）作为兜底，与后端
  // riderService 默认档案（75kg/male）矛盾，拉取失败时侧边栏会展示编造数据。
  // 现与后端默认值对齐
  const [profile, setProfile] = useState<RiderProfile>({
    name: '',
    gender: 'male',
    weight_kg: 75,
    height_cm: 175,
    max_hr: 188,
    resting_hr: 60,
    ftp_watts: 200,
    current_bike: '',
    bike_specs: '',
    injuries_notes: '',
    primary_goal: '',
  });
  const [ridesCount, setRidesCount] = useState(0);
  const [goalPct, setGoalPct] = useState(0);
  const location = useLocation();

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/ai/rider/profile');
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
    } catch {}
  };

  const fetchRidesAndGoals = async () => {
    try {
      const [ridesRes, goalsRes] = await Promise.all([
        fetch('/api/rides').then(r => r.json()),
        fetch('/api/ai/goals').then(r => r.json()).catch(() => ({ goals: null }))
      ]);

      const weeklyTarget = goalsRes?.goals?.weekly_distance_km || 50.0;

      if (ridesRes.rides) {
        setRidesCount(ridesRes.rides.length);

        // Real week calculation for dynamic badge
        const latestTime = Math.max(...ridesRes.rides.map((r: any) => r.start_time || 0));
        const weekRange = getNaturalWeekRange(latestTime > 0 ? latestTime : Date.now());

        const weekRides = ridesRes.rides.filter(
          (r: any) => r.start_time >= weekRange.start && r.start_time <= weekRange.end
        );
        const thisWeekKm = weekRides.reduce((acc: number, r: any) => acc + (r.distance_meters || 0), 0) / 1000;
        setGoalPct(Math.min(100, Math.round((thisWeekKm / weeklyTarget) * 100)));
      }
    } catch {}
  };

  useEffect(() => {
    fetchProfile();
    fetchRidesAndGoals();
  }, []);

  const navSections: NavSection[] = [
    {
      title: '核心概览',
      items: [
        { name: '总览仪表盘', path: '/' },
        { name: '周期与趋势', path: '/reports' },
      ],
    },
    {
      title: '骑行遥测',
      items: [
        { name: '骑行档案', path: '/rides', badge: `${ridesCount}` },
        { name: '路线探索', path: '/routes' },
      ],
    },
    {
      title: '科学训练',
      items: [
        { name: 'AI 教练', path: '/ai-coach' },
        { name: '目标与阶梯课表', path: '/goals', badge: `${goalPct}%` },
      ],
    },
    {
      title: '系统管理',
      items: [
        { name: '数据导入与脱敏', path: 'http://localhost:3001', external: true },
      ],
    },
  ];

  return (
    <>
      <aside className="w-64 bg-white border-r border-slate-200/80 p-6 flex flex-col justify-between shrink-0 h-full select-none">
        <div className="space-y-8">
          {/* Brand Logo Header */}
          <NavLink to="/" className="block px-2 group">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded border border-slate-900 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                V
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-slate-900 block font-mono">
                  VeloTrack
                </span>
                <p className="text-[11px] text-slate-400 font-normal tracking-normal">
                  科学骑行遥测与训练
                </p>
              </div>
            </div>
          </NavLink>

          {/* Grouped Navigation */}
          <div className="space-y-6">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <div className="px-2.5 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest">
                  {section.title}
                </div>

                <nav className="space-y-0.5" aria-label={section.title}>
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.path;

                    if (item.external) {
                      return (
                        <a
                          key={item.name}
                          href={item.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors group"
                        >
                          <span className="truncate">{item.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                        </a>
                      );
                    }

                    return (
                      <NavLink
                        key={item.name}
                        to={item.path}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors relative ${
                          isActive
                            ? 'font-semibold text-slate-900 bg-slate-100/80 border-l-2 border-slate-900'
                            : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>

                        {item.badge && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded tabular-nums ${
                              isActive
                                ? 'bg-slate-200/80 text-slate-900 font-medium'
                                : 'text-slate-400 font-normal'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Profile Footer Card */}
        <div className="pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            aria-label="查看车手生物力学档案与战车硬件"
            className="w-full text-left flex items-center justify-between p-2.5 rounded border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
            title="查看车手生物力学档案与战车硬件"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-6 h-6 rounded border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center font-mono font-medium text-xs shrink-0">
                {profile.name?.slice(0, 1) || 'V'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 leading-tight truncate">
                  {profile.name || '车手档案'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                  {profile.current_bike?.split(' ')[0] || '战车'} · {profile.weight_kg}kg
                </div>
              </div>
            </div>

            <div className="flex items-center text-slate-400 group-hover:text-slate-700 transition-colors">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </aside>

      {/* Slide-over Profile Drawer */}
      <RiderProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          fetchProfile();
        }}
      />
    </>
  );
}
