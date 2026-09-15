'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';
import { Icons } from '@/components/Icons';
import { Modal } from '@/components/Modal';
import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Pagination } from '@/components/Pagination';
import { FloatingBatchBar } from '@/components/FloatingBatchBar';
import { fmtDate } from '@/lib/utils';
import { Assignment } from '@/types';

export default function AssignmentsPage() {
  const {
    db,
    isLoaded,
    getAsset,
    getEmployee,
    getDepartment,
    addAssignment,
    returnAssignment,
    confirmDialog,
    showToast,
  } = useApp();

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<Assignment | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Search, Filter & Pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form states
  const [assignForm, setAssignForm] = useState({
    assetId: '',
    employeeId: '',
    recipientName: '',
    departmentId: '',
    dateOut: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const [returnForm, setReturnForm] = useState({
    dateReturn: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const availableAssets = db.assets.filter((a) => a.status !== 'broken');

  const filteredRows = useMemo(() => {
    return [...db.assignments]
      .sort((a, b) => new Date(b.dateOut).getTime() - new Date(a.dateOut).getTime())
      .filter((a) => {
        const isHolding = !a.dateReturn;
        if (filterStatus === 'holding' && !isHolding) return false;
        if (filterStatus === 'returned' && isHolding) return false;

        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const asset = getAsset(a.assetId);
        const emp = getEmployee(a.employeeId);
        const dept = getDepartment(a.departmentId);

        return (
          asset?.name.toLowerCase().includes(q) ||
          asset?.serial?.toLowerCase().includes(q) ||
          emp?.name.toLowerCase().includes(q) ||
          dept?.name.toLowerCase().includes(q) ||
          a.note?.toLowerCase().includes(q)
        );
      });
  }, [db.assignments, filterStatus, searchTerm, getAsset, getEmployee, getDepartment]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const isAllCurrentPageSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((a) => selectedIds.includes(a.id));

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = paginatedRows.map((a) => a.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedRows.map((a) => a.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openAssignModal = () => {
    setAssignForm({
      assetId: availableAssets[0]?.id || '',
      employeeId: db.employees[0]?.id || '',
      recipientName: '',
      departmentId: db.departments[0]?.id || '',
      dateOut: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setIsAssignOpen(true);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.assetId) return;

    addAssignment({
      assetId: assignForm.assetId,
      employeeId: assignForm.employeeId,
      departmentId: assignForm.departmentId,
      dateOut: assignForm.dateOut,
      dateReturn: null,
      note: assignForm.recipientName
        ? `ผู้รับมอบ: ${assignForm.recipientName} ${assignForm.note ? `(${assignForm.note})` : ''}`
        : assignForm.note.trim(),
    });
    setIsAssignOpen(false);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnTarget) {
      returnAssignment(returnTarget.id, returnForm.dateReturn, returnForm.note.trim());
      setReturnTarget(null);
    }
  };

  // Batch actions
  const handleBatchReturn = async () => {
    const holdingItems = selectedIds
      .map((id) => db.assignments.find((a) => a.id === id))
      .filter((a) => a && !a.dateReturn);

    if (holdingItems.length === 0) {
      showToast('ไม่มีรายการที่อยู่ระหว่างถือครองในรายการที่เลือก', 'info');
      return;
    }

    const ok = await confirmDialog({
      title: 'ยืนยันการรับคืนทรัพย์สินหลายรายการ',
      message: `คุณต้องการบันทึกรับคืนทรัพย์สินที่เลือกจำนวน ${holdingItems.length} รายการหรือไม่?`,
      type: 'confirm',
      confirmText: `ยืนยันรับคืน ${holdingItems.length} รายการ`,
    });

    if (ok) {
      const today = new Date().toISOString().slice(0, 10);
      holdingItems.forEach((item) => {
        if (item) returnAssignment(item.id, today, 'รับคืนพร้อมกัน (Batch Return)');
      });
      setSelectedIds([]);
      showToast(`บันทึกการรับคืนเรียบร้อยแล้ว ${holdingItems.length} รายการ`);
    }
  };

  const handleBatchExport = () => {
    try {
      const exportItems = db.assignments.filter((a) => selectedIds.includes(a.id));
      const rows = exportItems.map((a) => ({
        'ทรัพย์สิน': getAsset(a.assetId)?.name || '',
        'หมายเลขเครื่อง/SN': getAsset(a.assetId)?.serial || '',
        'ผู้รับมอบ': getEmployee(a.employeeId)?.name || a.note || '',
        'หน่วยงาน': getDepartment(a.departmentId)?.name || '',
        'วันที่มอบหมาย': a.dateOut || '',
        'วันที่คืน': a.dateReturn || 'ยังไม่คืน',
        'สถานะ': a.dateReturn ? 'คืนแล้ว' : 'กำลังถือครอง',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'การมอบหมายที่เลือก');
      XLSX.writeFile(wb, `selected-assignments-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`ส่งออกข้อมูล ${exportItems.length} รายการเรียบร้อยแล้ว`);
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์', 'error');
    }
  };

  if (!isLoaded) {
    return <div className="empty-state">กำลังโหลดข้อมูล...</div>;
  }

  const statusFilterOptions = [
    { value: 'all', label: 'สถานะถือครองทั้งหมด' },
    { value: 'holding', label: 'เฉพาะถือครองอยู่' },
    { value: 'returned', label: 'เฉพาะคืนแล้ว' },
  ];

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>ประวัติการมอบหมายและการถือครองทรัพย์สิน</h3>
          <span className="hint">
            ทั้งหมด {db.assignments.length} รายการ
            {filteredRows.length !== db.assignments.length && ` (ตรงกับเงื่อนไข ${filteredRows.length} รายการ)`}
          </span>
        </div>
        <button
          className="btn btn-primary"
          onClick={openAssignModal}
          disabled={availableAssets.length === 0}
        >
          <Icons.plus size={15} /> มอบหมายทรัพย์สิน
        </button>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="table-toolbar" style={{ borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: 10 }}>
        <div className="search-box" style={{ maxWidth: 300, minWidth: 220 }}>
          <Icons.search size={16} />
          <input
            type="text"
            placeholder="ค้นหาชื่อทรัพย์สิน, SN, หรือผู้รับมอบ..."
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
            options={statusFilterOptions}
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
              <th>ผู้รับมอบ</th>
              <th>หน่วยงาน</th>
              <th style={{ width: 130 }}>วันที่มอบหมาย</th>
              <th style={{ width: 130 }}>วันที่คืน</th>
              <th style={{ width: 140 }}>สถานะการถือครอง</th>
              <th className="th-right" style={{ width: 110 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length > 0 ? (
              paginatedRows.map((a) => {
                const asset = getAsset(a.assetId);
                const emp = getEmployee(a.employeeId);
                const dept = getDepartment(a.departmentId);
                const isHolding = !a.dateReturn;
                const isSelected = selectedIds.includes(a.id);

                return (
                  <tr key={a.id} className={isSelected ? 'selected-row' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <label className="checkbox-wrap">
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(a.id)}
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
                      <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>
                        {emp?.name || a.note || '-'}
                      </div>
                    </td>
                    <td>
                      {dept?.name ? (
                        <span className="badge-pill">{dept.name}</span>
                      ) : (
                        <span className="cell-sub">-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: 'var(--ink-700)', fontSize: 13 }}>{fmtDate(a.dateOut)}</span>
                    </td>
                    <td>
                      <span style={{ color: a.dateReturn ? 'var(--ink-700)' : 'var(--ink-400)', fontSize: 13 }}>
                        {a.dateReturn ? fmtDate(a.dateReturn) : '—'}
                      </span>
                    </td>
                    <td>
                      {isHolding ? (
                        <span className="tag tag-active">
                          <span className="tag-dot" /> กำลังถือครอง
                        </span>
                      ) : (
                        <span className="tag tag-disposed">
                          <span className="tag-dot" /> คืนแล้ว
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {isHolding && asset && (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => {
                              setReturnTarget(a);
                              setReturnForm({
                                dateReturn: new Date().toISOString().slice(0, 10),
                                note: '',
                              });
                            }}
                          >
                            รับคืน
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <Icons.assign size={40} />
                    <div className="et">
                      {searchTerm || filterStatus !== 'all'
                        ? 'ไม่พบประวัติการมอบหมายที่ตรงกับเงื่อนไข'
                        : 'ยังไม่มีประวัติการมอบหมายทรัพย์สิน'}
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
                      ) : availableAssets.length === 0 ? (
                        'ต้องมีทรัพย์สินในระบบก่อน จึงจะสามารถมอบหมายได้'
                      ) : (
                        'กดปุ่ม "มอบหมายทรัพย์สิน" เพื่อบันทึกการส่งมอบให้ผู้ใช้งาน'
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

      {/* Centered Bottom Floating Batch Bar */}
      <FloatingBatchBar
        selectedCount={selectedIds.length}
        itemLabel="รายการ"
        onClearSelection={() => setSelectedIds([])}
        actions={[
          {
            label: 'รับคืนที่เลือก',
            variant: 'success',
            icon: <Icons.check size={14} />,
            onClick: handleBatchReturn,
          },
          {
            label: 'ส่งออก Excel',
            variant: 'secondary',
            icon: <Icons.download size={14} />,
            onClick: handleBatchExport,
          },
        ]}
      />

      {/* Assign Modal */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title="มอบหมายทรัพย์สิน"
      >
        <form onSubmit={handleAssignSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field full">
                <label>
                  ทรัพย์สิน <span className="req">*</span>
                </label>
                <CustomSelect
                  required
                  placeholder="-- เลือกทรัพย์สิน --"
                  options={availableAssets.map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.serial ? ` (${a.serial})` : ''}`,
                  }))}
                  value={assignForm.assetId}
                  onChange={(val) => setAssignForm({ ...assignForm, assetId: val })}
                />
              </div>

              <div className="field">
                <label>มอบหมายให้ (ชื่อผู้รับมอบ)</label>
                {db.employees.length > 0 ? (
                  <CustomSelect
                    placeholder="-- เลือกจากบุคลากร --"
                    options={[
                      { value: '', label: '-- เลือกจากบุคลากร --' },
                      ...db.employees.map((emp) => ({
                        value: emp.id,
                        label: emp.name,
                        badge: emp.department
                          ? db.departments.find((d) => d.id === emp.department)?.name || emp.department
                          : undefined,
                      })),
                    ]}
                    value={assignForm.employeeId}
                    onChange={(val) => setAssignForm({ ...assignForm, employeeId: val })}
                  />
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="พิมพ์ชื่อผู้รับมอบ"
                    value={assignForm.recipientName}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, recipientName: e.target.value })
                    }
                  />
                )}
              </div>

              <div className="field">
                <label>หน่วยงาน</label>
                <CustomSelect
                  placeholder="-- เลือกหน่วยงาน --"
                  options={[
                    { value: '', label: '-- เลือกหน่วยงาน --' },
                    ...db.departments.map((d) => ({
                      value: d.id,
                      label: d.name,
                    })),
                  ]}
                  value={assignForm.departmentId}
                  onChange={(val) => setAssignForm({ ...assignForm, departmentId: val })}
                />
              </div>

              <div className="field">
                <label>
                  วันที่มอบหมาย <span className="req">*</span>
                </label>
                <CustomDatePicker
                  required
                  value={assignForm.dateOut}
                  onChange={(val) => setAssignForm({ ...assignForm, dateOut: val })}
                  fullWidth
                />
              </div>

              <div className="field full">
                <label>หมายเหตุ</label>
                <textarea
                  rows={2}
                  placeholder="เช่น มอบหมายใช้งานประจำ, ยืมใช้งานชั่วคราว"
                  value={assignForm.note}
                  onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsAssignOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> บันทึกการมอบหมาย
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Modal */}
      <Modal
        isOpen={Boolean(returnTarget)}
        onClose={() => setReturnTarget(null)}
        title="รับคืนทรัพย์สิน"
      >
        <form onSubmit={handleReturnSubmit}>
          <div className="modal-body">
            <div className="field full">
              <label>
                วันที่รับคืน <span className="req">*</span>
              </label>
              <CustomDatePicker
                required
                value={returnForm.dateReturn}
                onChange={(val) =>
                  setReturnForm({ ...returnForm, dateReturn: val })
                }
                fullWidth
              />
            </div>
            <div className="field full" style={{ marginTop: 12 }}>
              <label>สภาพขณะรับคืน / หมายเหตุ</label>
              <textarea
                rows={2}
                placeholder="ระบุสภาพทรัพย์สินหรือหมายเหตุ"
                value={returnForm.note}
                onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setReturnTarget(null)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> ยืนยันรับคืน
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
