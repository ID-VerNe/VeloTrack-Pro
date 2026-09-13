import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Map, Activity, Route, User } from 'lucide-react';

interface MobileTabBarProps {
  onOpenProfile: () => void;
}

export default function MobileTabBar({ onOpenProfile }: MobileTabBarProps) {
  const location = useLocation();

  const navItems = [
    { name: '总览', path: '/', icon: Home },
    { name: '骑行', path: '/rides', icon: Activity },
    { name: '路线', path: '/routes', icon: Map },
    { name: '训练', path: '/goals', icon: Route },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 w-full bg-white/90 backdrop-blur border-t border-slate-200 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-none">{item.name}</span>
            </NavLink>
          );
        })}
        
        {/* Profile Button */}
        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-500 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <User className="w-5 h-5" strokeWidth={2} />
          <span className="text-[10px] font-medium leading-none">我的</span>
        </button>
      </div>
    </nav>
  );
}
