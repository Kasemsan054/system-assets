'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Icons } from '@/components/Icons';
import { fmtDate } from '@/lib/utils';
import { STATUS_LABELS } from '@/types';

export default function DashboardPage() {
  const { db, getAsset, getEmployee, isLoaded } = useApp();

  if (!isLoaded) {
    return <div className="empty-state">กำลังโหลดข้อมูล...</div>;
  }

  const assets = db.assets;
  const totalAssets = assets.length;
  const readyCount = assets.filter((a) => a.status === 'ready').length;
  const issuedCount = assets.filter((a) => a.status === 'issued').length;
  const repairCount = assets.filter((a) => a.status === 'repair').length;

  const byCategory = db.categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: assets.filter((a) => a.categoryId === c.id && a.status !== 'broken').length,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCat = Math.max(1, ...byCategory.map((c) => c.count));

  const statusCounts = (Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>)
    .map((key) => ({
      key,
      label: STATUS_LABELS[key].label,
      color: STATUS_LABELS[key].color,
      count: assets.filter((a) => a.status === key).length,
    }))
    .filter((s) => s.count > 0);

  const totalForDonut = statusCounts.reduce((s, x) => s + x.count, 0) || 1;
  let acc = 0;
  const gradParts = statusCounts.length
    ? statusCounts
      .map((s) => {
        const start = (acc / totalForDonut) * 360;
        acc += s.count;
        const end = (acc / totalForDonut) * 360;
        return `${s.color} ${start}deg ${end}deg`;
      })
      .join(', ')
    : '#dfe4ea 0deg 360deg';

  // Recent activity
  interface ActivityItem {
    id: string;
    date: string;
    text: string;
    icon: 'assign' | 'wrench';
  }

  const recentActivity: ActivityItem[] = [];
  [...db.assignments].reverse().slice(0, 4).forEach((a) => {
    recentActivity.push({
      id: a.id,
      date: a.dateOut,
      text: `มอบหมาย “${getAsset(a.assetId)?.name || 'ทรัพย์สิน'}” ให้ ${getEmployee(a.employeeId)?.name || 'ผู้รับมอบ'}`,
      icon: 'assign',
    });
  });

  [...db.maintenance].reverse().slice(0, 3).forEach((m) => {
    recentActivity.push({
      id: m.id,
      date: m.date,
      text: `แจ้งซ่อม “${getAsset(m.assetId)?.name || 'ทรัพย์สิน'}” — ${m.type}`,
      icon: 'wrench',
    });
  });

  recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const dueMaintenance = db.maintenance.filter((m) => m.status === 'in_progress');

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card kpi-card">
          <div className="kpi-bar" style={{ background: 'var(--navy-800)' }} />
          <div className="kpi-label">ทรัพย์สินทั้งหมด</div>
          <div className="kpi-value">{totalAssets.toLocaleString()}</div>
          <div className="kpi-sub">รายการที่ขึ้นทะเบียนในระบบ</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-bar" style={{ background: 'var(--green-700)' }} />
          <div className="kpi-label">พร้อมใช้</div>
          <div className="kpi-value">{readyCount.toLocaleString()}</div>
          <div className="kpi-sub">
            รายการ {issuedCount > 0 ? `· เบิกใช้แล้ว ${issuedCount} รายการ` : ''}
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-bar" style={{ background: 'var(--amber-700)' }} />
          <div className="kpi-label">ส่งซ่อม</div>
          <div className="kpi-value">{repairCount.toLocaleString()}</div>
          <div className="kpi-sub">รายการอยู่ระหว่างการซ่อมบำรุง</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>จำนวนทรัพย์สินตามหมวดหมู่</h3>
            <span className="hint">ไม่รวมรายการที่เสียแล้ว</span>
          </div>
          <div className="card-pad">
            {byCategory.length > 0 ? (
              byCategory.map((c) => (
                <div className="bar-row" key={c.id}>
                  <div className="bar-label" title={c.name}>
                    {c.name}
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(c.count / maxCat) * 100}%` }}
                    />
                  </div>
                  <div className="bar-count">{c.count}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Icons.category size={36} />
                <div className="et">ยังไม่มีหมวดหมู่ทรัพย์สิน</div>
                <Link href="/categories" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>
                  <Icons.plus size={14} /> เพิ่มหมวดหมู่แรก
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>สถานะทรัพย์สิน</h3>
          </div>
          <div className="card-pad">
            {totalAssets > 0 ? (
              <div className="donut-wrap">
                <div className="donut-center" style={{ background: `conic-gradient(${gradParts})` }}>
                  <div className="donut-hole">
                    <div className="n">{totalAssets}</div>
                    <div className="l">รายการ</div>
                  </div>
                </div>
                <div className="legend">
                  {statusCounts.map((s) => (
                    <div className="legend-item" key={s.key}>
                      <span className="legend-sw" style={{ background: s.color }} />
                      {s.label} ({s.count})
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <Icons.box size={36} />
                <div className="et">ยังไม่มีข้อมูลทรัพย์สิน</div>
                <Link href="/assets" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
                  <Icons.plus size={14} /> ขึ้นทะเบียนทรัพย์สิน
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity & Maintenance row */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h3>กิจกรรมล่าสุด</h3>
          </div>
          <div className="card-pad">
            <div className="timeline">
              {recentActivity.length > 0 ? (
                recentActivity.slice(0, 6).map((a) => (
                  <div className="tl-item" key={a.id}>
                    <div className="tl-dot">
                      {a.icon === 'wrench' ? <Icons.wrench size={10} /> : <Icons.check size={10} />}
                    </div>
                    <div className="tl-content">
                      <div className="tl-title">{a.text}</div>
                      <div className="tl-meta">{fmtDate(a.date)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="et">ยังไม่มีกิจกรรม</div>
                  เมื่อมีการเบิก-ยืมหรือแจ้งซ่อมบำรุง ประวัติจะแสดงที่นี่
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>รายการซ่อมบำรุงที่ยังไม่เสร็จสิ้น</h3>
            <span className="hint">{dueMaintenance.length} รายการ</span>
          </div>
          <div className="card-pad">
            {dueMaintenance.length > 0 ? (
              dueMaintenance.map((m) => (
                <div className="tl-item" key={m.id}>
                  <div className="tl-dot" style={{ background: 'var(--amber-700)' }}>
                    <Icons.wrench size={10} />
                  </div>
                  <div className="tl-content">
                    <div className="tl-title">{getAsset(m.assetId)?.name || 'ทรัพย์สิน'}</div>
                    <div className="tl-meta">
                      {m.type} · แจ้งเมื่อ {fmtDate(m.date)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="et">ไม่มีรายการค้าง</div>
                ทุกรายการซ่อมบำรุงเสร็จสิ้นแล้ว หรือยังไม่มีรายการแจ้งซ่อม
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
