import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MobileTabBar from './components/MobileTabBar';
import RiderProfileDrawer from './components/RiderProfileDrawer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Custom event to sync profile open state across components
  useEffect(() => {
    const handleOpenProfile = () => setIsProfileOpen(true);
    window.addEventListener('open-profile', handleOpenProfile);
    return () => window.removeEventListener('open-profile', handleOpenProfile);
  }, []);

  return (
    <div className="h-[100dvh] w-screen bg-[#F8FAFC] flex flex-col md:flex-row overflow-hidden font-sans">
      {/* 桌面端：左侧边栏 */}
      <Sidebar className="hidden md:flex shrink-0 border-r border-slate-200/80 h-full" />
      
      {/* 主体内容区域 - padding-bottom 适配移动端底部导航，md 以上无 padding */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      {/* 移动端：底部导航栏 */}
      <MobileTabBar onOpenProfile={() => setIsProfileOpen(true)} />

      {/* Slide-over Profile Drawer - 统一放在顶层 */}
      <RiderProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          window.dispatchEvent(new CustomEvent('profile-updated'));
        }}
      />
    </div>
  );
}
