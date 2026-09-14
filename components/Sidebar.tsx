'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Icons } from './Icons';

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof Icons;
  isSettings?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'แดชบอร์ด', icon: 'dashboard' },
  { href: '/assets', label: 'ทะเบียนทรัพย์สิน', icon: 'assets' },
  { href: '/categories', label: 'หมวดหมู่ทรัพย์สิน', icon: 'category' },
  { href: '/assignments', label: 'การเบิก–ยืม/มอบหมาย', icon: 'assign' },
  { href: '/maintenance', label: 'ซ่อมบำรุง', icon: 'maintenance' },
  { href: '/settings', label: 'ตั้งค่าระบบ', icon: 'settings', isSettings: true },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { db, sidebarOpen, setSidebarOpen, currentUser } = useApp();

  const orgName = db.orgName || 'องค์กรของคุณ';
  const orgSub = db.orgSub || 'ระบบทะเบียนทรัพย์สิน';

  // Compute 2-letter initials for brand mark
  const initials = orgName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'อส';

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.isSettings) {
      return currentUser?.role === 'admin';
    }
    return true;
  });

  return (
    <>
      {/* Backdrop for mobile sidebar drawer */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 35,
          }}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">{initials}</div>
          <div className="brand-text">
            <div className="brand-org">{orgName}</div>
            <div className="brand-sub">{orgSub}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);
            const IconComponent = Icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <IconComponent size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          เวอร์ชัน 2.0 (Next.js) · ข้อมูลบันทึกในเครื่องนี้
        </div>
      </aside>
    </>
  );
};
