'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';
import { Icons } from '@/components/Icons';
import { Modal } from '@/components/Modal';
import { CustomSelect } from '@/components/CustomSelect';
import { Pagination } from '@/components/Pagination';
import { FloatingBatchBar } from '@/components/FloatingBatchBar';
import { fmtDate } from '@/lib/utils';
import { MaintenanceRecord } from '@/types';

export default function MaintenancePage() {
  const {
    db,
    isLoaded,
    getAsset,
    addMaintenance,
    completeMaintenance,
    confirmDialog,
    showToast,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<MaintenanceRecord | null>(null);
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().slice(0, 10));

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Search, Filter & Pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [form, setForm] = useState({
    assetId: '',
    type: 'ตรวจเช็คตามระยะ',
    date: new Date().toISOString().slice(0, 10),
    vendor: '',
    description: '',
  });

  const filteredRows = useMemo(() => {
    return [...db.maintenance]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((m) => {
        if (filterStatus === 'in_progress' && m.status !== 'in_progress') return false;
        if (filterStatus === 'completed' && m.status !== 'done') return false;

        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const asset = getAsset(m.assetId);

        return (
          asset?.name.toLowerCase().includes(q) ||
          asset?.serial?.toLowerCase().includes(q) ||
          m.type.toLowerCase().includes(q) ||
          m.vendor?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
        );
      });
  }, [db.maintenance, filterStatus, searchTerm, getAsset]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const isAllCurrentPageSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((m) => selectedIds.includes(m.id));

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = paginatedRows.map((m) => m.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedRows.map((m) => m.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const inProgressCount = db.maintenance.filter((m) => m.status === 'in_progress').length;

  const openAddModal = () => {
    setForm({
      assetId: db.assets[0]?.id || '',
      type: 'ตรวจเช็คตามระยะ',
      date: new Date().toISOString().slice(0, 10),
      vendor: '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetId) return;

    addMaintenance({
      assetId: form.assetId,
      type: form.type,
      date: form.date,
      vendor: form.vendor.trim(),
      description: form.description.trim(),
    });
    setIsModalOpen(false);
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (completeTarget) {
      completeMaintenance(completeTarget.id, completedDate);
      setCompleteTarget(null);
    }
  };

  // Batch actions
  const handleBatchComplete = async () => {
    const ongoingItems = selectedIds
      .map((id) => db.maintenance.find((m) => m.id === id))
      .filter((m) => m && m.status === 'in_progress');

    if (ongoingItems.length === 0) {
      showToast('ไม่มีรายการที่อยู่ระหว่างซ่อมในรายการที่เลือก', 'info');
      return;
    }

    const ok = await confirmDialog({
      title: 'ยืนยันบันทึกซ่อมเสร็จสิ้นหลายรายการ',
      message: `คุณต้องการบันทึกการซ่อมเสร็จสิ้นสำหรับรายการที่เลือกจำนวน ${ongoingItems.length} รายการหรือไม่?`,
      type: 'confirm',
      confirmText: `ยืนยันเสร็จสิ้น ${ongoingItems.length} รายการ`,
    });

    if (ok) {
      const today = new Date().toISOString().slice(0, 10);
      ongoingItems.forEach((item) => {
        if (item) completeMaintenance(item.id, today);
      });
      setSelectedIds([]);
      showToast(`บันทึกซ่อมเสร็จสิ้นเรียบร้อยแล้ว ${ongoingItems.length} รายการ`);
    }
  };

  const handleBatchExport = () => {
    try {
      const exportItems = db.maintenance.filter((m) => selectedIds.includes(m.id));
      const rows = exportItems.map((m) => ({
        'ทรัพย์สิน': getAsset(m.assetId)?.name || '',
        'หมายเลขเครื่อง/SN': getAsset(m.assetId)?.serial || '',
        'ประเภทงาน': m.type || '',
        'วันที่แจ้ง': m.date || '',
        'ผู้รับซ่อม': m.vendor || '',
        'รายละเอียด': m.description || '',
        'สถานะ': m.status === 'in_progress' ? 'กำลังดำเนินการ' : 'เสร็จสิ้น',
        'วันที่เสร็จสิ้น': m.completedDate || '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ประวัติซ่อมที่เลือก');
      XLSX.writeFile(wb, `selected-maintenance-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`ส่งออกข้อมูล ${exportItems.length} รายการเรียบร้อยแล้ว`);
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์', 'error');
    }
  };

  if (!isLoaded) {
    return <div className="empty-state">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card kpi-card">
          <div className="kpi-bar" style={{ background: 'var(--amber-700)' }} />
          <div className="kpi-label">กำลังซ่อมบำรุง</div>
          <div className="kpi-value">{inProgressCount}</div>
          <div className="kpi-sub">รายการที่ยังไม่เสร็จสิ้น</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-bar" style={{ background: 'var(--navy-800)' }} />
          <div className="kpi-label">บันทึกทั้งหมด</div>
          <div className="kpi-value">{db.maintenance.length}</div>
          <div className="kpi-sub">รายการประวัติซ่อมบำรุง</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>รายการประวัติและแจ้งซ่อมบำรุงทรัพย์สิน</h3>
            <span className="hint">
              ทั้งหมด {db.maintenance.length} รายการ
              {filteredRows.length !== db.maintenance.length && ` (ตรงกับเงื่อนไข ${filteredRows.length} รายการ)`}
            </span>
          </div>
          <button
            className="btn btn-primary"
            onClick={openAddModal}
            disabled={db.assets.length === 0}
          >
            <Icons.plus size={15} /> แจ้งซ่อมบำรุง
          </button>
        </div>

        {/* Toolbar / Search & Filter */}
        <div className="table-toolbar" style={{ borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: 10 }}>
          <div className="search-box" style={{ maxWidth: 300, minWidth: 220 }}>
            <Icons.search size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อทรัพย์สิน, ผู้รับซ่อม, รายละเอียด..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                className="clear-btn"
                onClick={() => setSearchTerm('')}
                title="ล้างคำค้นหา"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ minWidth: 190 }}>
            <CustomSelect
              options={[
                { value: 'all', label: 'สถานะการซ่อมทั้งหมด' },
                { value: 'in_progress', label: 'กำลังดำเนินการ' },
                { value: 'completed', label: 'เสร็จสิ้นแล้ว' },
              ]}
              value={filterStatus}
              onChange={(val) => {
                setFilterStatus(val);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>
                  <label className="checkbox-wrap">
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={isAllCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      title="เลือกทั้งหมดในหน้านี้"
                    />
                  </label>
                </th>
                <th>ทรัพย์สิน</th>
                <th style={{ width: 180 }}>ประเภทงาน</th>
                <th style={{ width: 130 }}>วันที่แจ้ง</th>
                <th>ผู้รับซ่อม / ร้าน</th>
                <th style={{ width: 170 }}>สถานะ</th>
                <th className="th-right" style={{ width: 120 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length > 0 ? (
                paginatedRows.map((m) => {
                  const asset = getAsset(m.assetId);
                  const isOngoing = m.status === 'in_progress';
                  const isSelected = selectedIds.includes(m.id);

                  return (
                    <tr key={m.id} className={isSelected ? 'selected-row' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <label className="checkbox-wrap">
                          <input
                            type="checkbox"
                            className="custom-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(m.id)}
                          />
                        </label>
                      </td>
                      <td>
                        {asset ? (
                          <Link
                            href={`/assets/${asset.id}`}
                            style={{ color: 'var(--ink-900)', fontWeight: 600, textDecoration: 'none' }}
                          >
                            {asset.name}
                          </Link>
                        ) : (
                          <span className="cell-sub">ทรัพย์สินถูกลบแล้ว</span>
                        )}
                        {asset?.serial && (
                          <div style={{ marginTop: 2 }}>
                            <span className="asset-code">SN: {asset.serial}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge-pill">
                          <Icons.wrench size={12} /> {m.type}
                        </span>
                        {m.description && <div className="cell-sub">{m.description}</div>}
                      </td>
                      <td>
                        <span style={{ color: 'var(--ink-700)', fontSize: 13 }}>{fmtDate(m.date)}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: 'var(--ink-900)' }}>
                          {m.vendor || '-'}
                        </span>
                      </td>
                      <td>
                        {isOngoing ? (
                          <span className="tag tag-maintenance">
                            <span className="tag-dot" /> กำลังดำเนินการ
                          </span>
                        ) : (
                          <span className="tag tag-active">
                            <span className="tag-dot" /> เสร็จสิ้น ({fmtDate(m.completedDate)})
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {isOngoing && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              onClick={() => {
                                setCompleteTarget(m);
                                setCompletedDate(new Date().toISOString().slice(0, 10));
                              }}
                            >
                              <Icons.check size={13} /> แจ้งเสร็จสิ้น
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <Icons.wrench size={40} />
                      <div className="et">
                        {searchTerm || filterStatus !== 'all'
                          ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไข'
                          : 'ยังไม่มีบันทึกการซ่อมบำรุง'}
                      </div>
                      <div>
                        {searchTerm || filterStatus !== 'all' ? (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ marginTop: 10 }}
                            onClick={() => {
                              setSearchTerm('');
                              setFilterStatus('all');
                            }}
                          >
                            ล้างตัวกรอง
                          </button>
                        ) : db.assets.length === 0 ? (
                          'ต้องขึ้นทะเบียนทรัพย์สินในระบบก่อน จึงจะสามารถแจ้งซ่อมได้'
                        ) : (
                          'เมื่อมีการตรวจเช็คหรือส่งซ่อม สามารถกดปุ่ม "แจ้งซ่อมบำรุง" เพื่อบันทึกประวัติ'
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Unified Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredRows.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Centered Bottom Floating Batch Bar */}
      <FloatingBatchBar
        selectedCount={selectedIds.length}
        itemLabel="รายการ"
        onClearSelection={() => setSelectedIds([])}
        actions={[
          {
            label: 'แจ้งเสร็จสิ้นที่เลือก',
            variant: 'success',
            icon: <Icons.check size={14} />,
            onClick: handleBatchComplete,
          },
          {
            label: 'ส่งออก Excel',
            variant: 'secondary',
            icon: <Icons.download size={14} />,
            onClick: handleBatchExport,
          },
        ]}
      />

      {/* Add Maintenance Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="แจ้งซ่อมบำรุงทรัพย์สิน"
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field full">
                <label>
                  ทรัพย์สิน <span className="req">*</span>
                </label>
                <CustomSelect
                  required
                  placeholder="-- เลือกทรัพย์สิน --"
                  options={db.assets.map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.serial ? ` (${a.serial})` : ''}`,
                  }))}
                  value={form.assetId}
                  onChange={(val) => setForm({ ...form, assetId: val })}
                />
              </div>

              <div className="field">
                <label>
                  ประเภทงาน <span className="req">*</span>
                </label>
                <CustomSelect
                  required
                  options={[
                    { value: 'ตรวจเช็คตามระยะ', label: 'ตรวจเช็คตามระยะ' },
                    { value: 'ซ่อมบำรุงตามระยะ', label: 'ซ่อมบำรุงตามระยะ' },
                    { value: 'ซ่อมแซม', label: 'ซ่อมแซม' },
                    { value: 'อื่นๆ', label: 'อื่นๆ' },
                  ]}
                  value={form.type}
                  onChange={(val) => setForm({ ...form, type: val })}
                />
              </div>

              <div className="field">
                <label>
                  วันที่แจ้ง <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="field full">
                <label>ผู้รับซ่อม / ร้าน / ศูนย์บริการ</label>
                <input
                  type="text"
                  placeholder="เช่น บริษัท คอมพิวเตอร์เซอร์วิส จำกัด"
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                />
              </div>

              <div className="field full">
                <label>รายละเอียดอาการ / งานที่ทำ</label>
                <textarea
                  rows={3}
                  placeholder="เช่น ตรวจเช็คสภาพ เปลี่ยนอะไหล่ ล้างเครื่อง"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> บันทึกการแจ้งซ่อม
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Maintenance Modal */}
      <Modal
        isOpen={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="บันทึกการซ่อมบำรุงเสร็จสิ้น"
      >
        <form onSubmit={handleCompleteSubmit}>
          <div className="modal-body">
            <div className="field full">
              <label>
                วันที่ซ่อมเสร็จสิ้น <span className="req">*</span>
              </label>
              <input
                type="date"
                required
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCompleteTarget(null)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> ยืนยันเสร็จสิ้น
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
