'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Icons } from './Icons';
import { getTodayThaiFormatted } from '@/lib/utils';
import { ProfileDropdown } from './ProfileDropdown';
import { LoginModal } from './LoginModal';

export const Topbar: React.FC = () => {
  const pathname = usePathname();
  const { toggleSidebar } = useApp();
  const [todayText, setTodayText] = useState('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    setTodayText(getTodayThaiFormatted());
  }, []);

  const getPageInfo = () => {
    if (pathname === '/') return { breadcrumb: 'หน้าหลัก', title: 'แดชบอร์ดภาพรวมทรัพย์สิน' };
    if (pathname.startsWith('/assets/')) return { breadcrumb: 'ทะเบียนทรัพย์สิน / รายละเอียด', title: 'รายละเอียดทรัพย์สิน' };
    if (pathname === '/assets') return { breadcrumb: 'ทะเบียนทรัพย์สิน', title: 'ทะเบียนทรัพย์สินทั้งหมด' };
    if (pathname === '/categories') return { breadcrumb: 'การตั้งค่าทะเบียน', title: 'หมวดหมู่ทรัพย์สิน' };
    if (pathname === '/assignments') return { breadcrumb: 'การเบิก–ยืม/มอบหมาย', title: 'ประวัติการมอบหมายทรัพย์สิน' };
    if (pathname === '/maintenance') return { breadcrumb: 'ซ่อมบำรุง', title: 'บันทึกการซ่อมบำรุงทรัพย์สิน' };
    if (pathname === '/settings') return { breadcrumb: 'ตั้งค่าระบบ', title: 'ตั้งค่าองค์กรและระบบ' };
    return { breadcrumb: 'ระบบทะเบียนทรัพย์สิน', title: 'ระบบทะเบียนทรัพย์สิน' };
  };

  const { breadcrumb, title } = getPageInfo();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={toggleSidebar} aria-label="เมนู">
          <Icons.menu size={18} />
        </button>
        <div>
          <div className="breadcrumb">{breadcrumb}</div>
          <h1 className="page-title">{title}</h1>
        </div>
      </div>
      <div className="topbar-right">
        {todayText && <div className="today-pill">{todayText}</div>}
        <ProfileDropdown onOpenLogin={() => setIsLoginOpen(true)} />
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </header>
  );
};
