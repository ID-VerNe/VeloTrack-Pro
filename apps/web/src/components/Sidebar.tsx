import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Bike, 
  LayoutGrid, 
  Layers, 
  Compass, 
  Target, 
  Activity, 
  BarChart3, 
  SlidersHorizontal,
  UploadCloud,
  ExternalLink
} from 'lucide-react';
import RiderProfileDrawer from './RiderProfileDrawer';
import type { RiderProfile } from '../types/rider';
import { getNaturalWeekRange } from '../utils/dateUtils';

interface NavSection {
  title: string;
  items: {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
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
        { name: '总览仪表盘', icon: LayoutGrid, path: '/' },
        { name: '周期与趋势', icon: BarChart3, path: '/reports' },
      ],
    },
    {
      title: '骑行遥测',
      items: [
        { name: '骑行档案', icon: Layers, path: '/rides', badge: `${ridesCount}` },
        { name: '路线探索', icon: Compass, path: '/routes' },
      ],
    },
    {
      title: '科学训练',
      items: [
        { name: 'AI 教练', icon: Activity, path: '/ai-coach' },
        { name: '目标与阶梯课表', icon: Target, path: '/goals', badge: `${goalPct}%` },
      ],
    },
    {
      title: '系统管理',
      items: [
        { name: '数据导入与脱敏', icon: UploadCloud, path: 'http://localhost:3001', external: true },
      ],
    },
  ];

  return (
    <>
      <aside className="w-60 bg-white border-r border-slate-200/80 p-5 flex flex-col justify-between shrink-0 h-full select-none shadow-xs">
        <div className="space-y-6">
          {/* Brand Logo Header */}
          <NavLink to="/" className="flex items-center space-x-3 px-1 group">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Bike className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900">VeloTrack</span>
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-wide">科学骑行遥测与训练</p>
            </div>
          </NavLink>

          {/* Grouped Navigation */}
          <div className="space-y-5">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="px-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {section.title}
                </div>

                <nav className="space-y-0.5" aria-label={section.title}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    if (item.external) {
                      return (
                        <a
                          key={item.name}
                          href={item.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 group"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-slate-900 transition-colors" />
                            <span className="truncate">{item.name}</span>
                          </div>

                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-600" />
                        </a>
                      );
                    }

                    return (
                      <NavLink
                        key={item.name}
                        to={item.path}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-sky-400' : 'text-slate-500'
                            }`}
                          />
                          <span className="truncate">{item.name}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-xs font-bold px-1.5 py-0.2 rounded-md shrink-0 tabular-nums ${
                              isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
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
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            aria-label="查看车手生物力学档案与战车硬件"
            className="w-full text-left flex items-center justify-between p-2 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/70 transition-all cursor-pointer group shadow-xs active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            title="查看车手生物力学档案与战车硬件"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {profile.name?.slice(0, 1) || 'V'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 leading-tight truncate">
                  {profile.name || '车手档案'}
                </div>
                <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {profile.current_bike?.split(' ')[0] || '战车'} · {profile.weight_kg}kg
                </div>
              </div>
            </div>

            <div className="flex items-center text-slate-500 group-hover:text-slate-800 transition-colors">
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
