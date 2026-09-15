'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useApp } from '@/context/AppContext';
import { Icons } from '@/components/Icons';
import { Modal } from '@/components/Modal';
import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Pagination } from '@/components/Pagination';
import { FloatingBatchBar } from '@/components/FloatingBatchBar';
import { Asset, AssetStatus, STATUS_LABELS } from '@/types';
import { fmtDate } from '@/lib/utils';

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc';

function AssetsList() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '';

  const {
    db,
    isLoaded,
    addAsset,
    updateAsset,
    deleteAsset,
    getCategory,
    getDepartment,
    holderDisplayName,
    showToast,
    confirmDialog,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState(initialCategory);
  const [filterStatus, setFilterStatus] = useState<AssetStatus | ''>('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchStatusModalOpen, setIsBatchStatusModalOpen] = useState(false);
  const [batchStatusValue, setBatchStatusValue] = useState<AssetStatus>('ready');

  // Single Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    status: 'ready' as AssetStatus,
    purchaseDate: new Date().toISOString().slice(0, 10),
    returnDate: '',
    holderName: '',
    location: '',
    serial: '',
    note: '',
  });

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat !== null) {
      setFilterCategory(cat);
    }
  }, [searchParams]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterStatus, sortBy, pageSize]);

  // Filtered and sorted assets
  const filteredAssets = useMemo(() => {
    const list = db.assets.filter((a) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = a.name.toLowerCase().includes(q);
        const matchSerial = (a.serial || '').toLowerCase().includes(q);
        const matchHolder = (holderDisplayName(a) || '').toLowerCase().includes(q);
        if (!matchName && !matchSerial && !matchHolder) return false;
      }
      if (filterCategory && a.categoryId !== filterCategory) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.purchaseDate || 0).getTime() - new Date(b.purchaseDate || 0).getTime();
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name, 'th');
      }
      if (sortBy === 'name_desc') {
        return b.name.localeCompare(a.name, 'th');
      }
      return 0;
    });

    return list;
  }, [db.assets, search, filterCategory, filterStatus, sortBy, holderDisplayName]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredAssets.length);
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

  // Multi-selection helpers
  const isAllCurrentPageSelected =
    paginatedAssets.length > 0 &&
    paginatedAssets.every((a) => selectedIds.includes(a.id));

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = paginatedAssets.map((a) => a.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedAssets.map((a) => a.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectAsset = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Batch actions
  const handleBatchDelete = () => {
    const count = selectedIds.length;
    selectedIds.forEach((id) => deleteAsset(id));
    setSelectedIds([]);
    showToast(`ลบทรัพย์สินที่เลือกจำนวน ${count} รายการแล้ว`);
  };

  const handleBatchChangeStatus = (newStatus: AssetStatus) => {
    const count = selectedIds.length;
    selectedIds.forEach((id) => {
      updateAsset(id, { status: newStatus }, true);
    });
    setSelectedIds([]);
    showToast(`เปลี่ยนสถานะทรัพย์สิน ${count} รายการ เป็น "${STATUS_LABELS[newStatus].label}" แล้ว`);
  };

  const handleBatchExport = () => {
    try {
      const exportItems = db.assets.filter((a) => selectedIds.includes(a.id));
      const rows = exportItems.map((a) => ({
        'ชื่อทรัพย์สิน': a.name,
        'หมวดหมู่': getCategory(a.categoryId)?.name || '',
        'ผู้ถือครอง': holderDisplayName(a) || '',
        'สถานะ': STATUS_LABELS[a.status]?.label || a.status,
        'วันที่เบิกใช้งาน': a.purchaseDate || '',
        'วันที่นำกลับมาคืน': a.returnDate || '',
        'สถานที่จัดเก็บ': a.location || '',
        'หมายเลขเครื่อง/SN': a.serial || '',
        'หมายเหตุ': a.note || '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ทรัพย์สินที่เลือก');
      XLSX.writeFile(wb, `selected-assets-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`ส่งออกข้อมูล ${exportItems.length} รายการเรียบร้อยแล้ว`);
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์', true);
    }
  };

  const openAddModal = () => {
    setEditingAsset(null);
    setFormData({
      name: '',
      categoryId: db.categories[0]?.id || '',
      status: 'ready',
      purchaseDate: new Date().toISOString().slice(0, 10),
      returnDate: '',
      holderName: '',
      location: '',
      serial: '',
      note: '',
    });
    setIsFormOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      categoryId: asset.categoryId,
      status: asset.status,
      purchaseDate: asset.purchaseDate || new Date().toISOString().slice(0, 10),
      returnDate: asset.returnDate || '',
      holderName: asset.holderName || '',
      location: asset.location || '',
      serial: asset.serial || '',
      note: asset.note || '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingAsset) {
      updateAsset(editingAsset.id, {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        status: formData.status,
        purchaseDate: formData.purchaseDate,
        returnDate: formData.returnDate || null,
        holderName: formData.holderName.trim(),
        location: formData.location.trim(),
        serial: formData.serial.trim(),
        cost: 0,
        note: formData.note.trim(),
      });
    } else {
      addAsset({
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        status: formData.status,
        purchaseDate: formData.purchaseDate,
        returnDate: formData.returnDate || null,
        holderName: formData.holderName.trim(),
        location: formData.location.trim(),
        serial: formData.serial.trim(),
        cost: 0,
        note: formData.note.trim(),
        usefulLife: getCategory(formData.categoryId)?.usefulLife || 5,
        salvagePct: 5,
        holderId: null,
      });
    }
    setIsFormOpen(false);
  };

  const exportFilteredToExcel = () => {
    try {
      const rows = filteredAssets.map((a) => ({
        'ชื่อทรัพย์สิน': a.name,
        'หมวดหมู่': getCategory(a.categoryId)?.name || '',
        'ผู้ถือครอง': holderDisplayName(a) || '',
        'สถานะ': STATUS_LABELS[a.status]?.label || a.status,
        'วันที่จัดซื้อ': a.purchaseDate || '',
        'สถานที่จัดเก็บ': a.location || '',
        'หมายเลขเครื่อง/SN': a.serial || '',
        'หมายเหตุ': a.note || '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ทะเบียนทรัพย์สิน');
      XLSX.writeFile(wb, `asset-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('ส่งออกรายการเรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการส่งออก Excel', true);
    }
  };

  if (!isLoaded) {
    return <div className="empty-state">กำลังโหลดข้อมูล...</div>;
  }

  // Options for Custom Selects
  const categoryOptions = [
    { value: '', label: 'ทุกหมวดหมู่' },
    ...db.categories.map((c) => ({ value: c.id, label: c.name, sublabel: c.code })),
  ];

  const statusOptions = [
    { value: '', label: 'ทุกสถานะ' },
    ...(Object.keys(STATUS_LABELS) as AssetStatus[]).map((st) => ({
      value: st,
      label: STATUS_LABELS[st].label,
    })),
  ];

  const sortOptions = [
    { value: 'date_desc', label: 'วันที่เบิกใช้งาน (ล่าสุด)' },
    { value: 'date_asc', label: 'วันที่เบิกใช้งาน (เก่าสุด)' },
    { value: 'name_asc', label: 'ชื่อทรัพย์สิน (ก-ฮ)' },
    { value: 'name_desc', label: 'ชื่อทรัพย์สิน (ฮ-ก)' },
  ];

  const pageSizeOptions = [
    { value: '10', label: '10 รายการ / หน้า' },
    { value: '20', label: '20 รายการ / หน้า' },
    { value: '50', label: '50 รายการ / หน้า' },
  ];

  return (
    <div className="card">
      {/* Toolbar with Custom Selects */}
      <div className="table-toolbar">
        <div className="search-box">
          <Icons.search size={15} />
          <input
            placeholder="ค้นหาชื่อ / รหัสครุภัณฑ์ / Serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Custom Category Select */}
        <CustomSelect
          minWidth={170}
          options={categoryOptions}
          value={filterCategory}
          onChange={(val) => setFilterCategory(val)}
        />

        {/* Custom Status Select */}
        <CustomSelect
          minWidth={140}
          options={statusOptions}
          value={filterStatus}
          onChange={(val) => setFilterStatus(val as any)}
        />

        {/* Custom Sort Select */}
        <CustomSelect
          minWidth={180}
          options={sortOptions}
          value={sortBy}
          onChange={(val) => setSortBy(val as SortOption)}
        />

        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openAddModal}>
            <Icons.plus size={15} /> เพิ่มทรัพย์สิน
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div
        style={{
          padding: '9px 20px',
          background: 'var(--paper-alt)',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12.5,
          color: 'var(--ink-700)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          แสดง <b>{filteredAssets.length > 0 ? startIndex + 1 : 0} - {endIndex}</b> จากทั้งหมด{' '}
          <b>{filteredAssets.length}</b> รายการ (ขึ้นทะเบียนในระบบรวม {db.assets.length} รายการ)
        </div>
        {filteredAssets.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={exportFilteredToExcel}
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            <Icons.download size={13} /> ส่งออกรายการนี้ (Excel)
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  className="custom-checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectAllCurrentPage}
                  title="เลือกทั้งหมดในหน้านี้"
                />
              </th>
              <th>ชื่อทรัพย์สิน</th>
              <th style={{ width: 150 }}>หมวดหมู่</th>
              <th style={{ width: 140 }}>หมายเลขเครื่อง/SN</th>
              <th>ผู้ถือครอง</th>
              <th>สถานที่จัดเก็บ</th>
              <th style={{ width: 130 }}>สถานะ</th>
              <th className="th-right" style={{ width: 120 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAssets.length > 0 ? (
              paginatedAssets.map((asset) => {
                const statusInfo = STATUS_LABELS[asset.status] || STATUS_LABELS.ready;
                const catName = getCategory(asset.categoryId)?.name || '-';
                const isSelected = selectedIds.includes(asset.id);

                return (
                  <tr
                    key={asset.id}
                    className={isSelected ? 'row-selected' : ''}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectAsset(asset.id)}
                      />
                    </td>
                    <td>
                      <Link
                        href={`/assets/${asset.id}`}
                        style={{ fontWeight: 600, color: 'var(--ink-900)', textDecoration: 'none' }}
                      >
                        {asset.name}
                      </Link>
                      <div className="cell-sub">เบิกเมื่อ: {fmtDate(asset.purchaseDate)}</div>
                    </td>
                    <td>
                      <span className="badge-pill">{catName}</span>
                    </td>
                    <td>
                      {asset.serial ? (
                        <span className="asset-code">{asset.serial}</span>
                      ) : (
                        <span className="cell-sub">-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>
                        {holderDisplayName(asset) || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--ink-700)', fontSize: 13 }}>
                        {asset.location || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${statusInfo.cls}`}>
                        <span className="tag-dot" />
                        {statusInfo.label}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="icon-btn"
                          title="ดูรายละเอียด"
                        >
                          <Icons.eye size={15} />
                        </Link>
                        <button
                          className="icon-btn"
                          title="แก้ไขข้อมูล"
                          onClick={() => openEditModal(asset)}
                        >
                          <Icons.edit size={15} />
                        </button>
                        <button
                          className="icon-btn danger"
                          title="ลบทรัพย์สิน"
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: 'ยืนยันการลบทรัพย์สิน',
                              message: `ต้องการลบ "${asset.name}" ออกจากทะเบียนหรือไม่? ประวัติการมอบหมายและการซ่อมบำรุงที่เกี่ยวข้องจะถูกลบไปด้วย`,
                              type: 'danger',
                              confirmText: 'ลบทรัพย์สิน',
                            });
                            if (ok) {
                              deleteAsset(asset.id);
                              setSelectedIds((prev) => prev.filter((id) => id !== asset.id));
                            }
                          }}
                        >
                          <Icons.trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <Icons.box size={40} />
                    <div className="et">ไม่พบข้อมูลทรัพย์สิน</div>
                    <div>
                      {db.assets.length === 0
                        ? 'ระบบยังไม่มีทรัพย์สิน กดปุ่ม "เพิ่มทรัพย์สิน" เพื่อขึ้นทะเบียนรายการแรก'
                        : 'ลองปรับคำค้นหาหรือตัวกรองใหม่อีกครั้ง'}
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
        totalItems={filteredAssets.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingAsset ? 'แก้ไขข้อมูลทรัพย์สิน' : 'เพิ่มทรัพย์สินใหม่'}
        wide
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field full">
                <label>
                  ชื่อทรัพย์สิน <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="field">
                <label>
                  หมวดหมู่ <span className="req">*</span>
                </label>
                <CustomSelect
                  fullWidth
                  options={db.categories.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.code})`,
                  }))}
                  value={formData.categoryId}
                  onChange={(val) => setFormData({ ...formData, categoryId: val })}
                  placeholder="-- เลือกหมวดหมู่ --"
                />
              </div>

              <div className="field">
                <label>สถานะ</label>
                <CustomSelect
                  fullWidth
                  options={(Object.keys(STATUS_LABELS) as AssetStatus[]).map((st) => ({
                    value: st,
                    label: STATUS_LABELS[st].label,
                  }))}
                  value={formData.status}
                  onChange={(val) =>
                    setFormData({ ...formData, status: val as AssetStatus })
                  }
                />
              </div>

              <div className="field">
                <label>
                  วันที่เบิกไปใช้งาน <span className="req">*</span>
                </label>
                <CustomDatePicker
                  required
                  value={formData.purchaseDate}
                  onChange={(val) => setFormData({ ...formData, purchaseDate: val })}
                  fullWidth
                />
              </div>

              <div className="field">
                <label>วันที่นำกลับมาคืน (ถ้ามี)</label>
                <CustomDatePicker
                  value={formData.returnDate}
                  onChange={(val) => setFormData({ ...formData, returnDate: val })}
                  fullWidth
                />
              </div>

              <div className="field">
                <label>ผู้ถือครองปัจจุบัน</label>
                <input
                  type="text"
                  placeholder="ระบุชื่อผู้ถือครอง (ถ้ามี)"
                  value={formData.holderName}
                  onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
                />
              </div>

              <div className="field">
                <label>สถานที่จัดเก็บ</label>
                <input
                  type="text"
                  placeholder="เช่น ห้อง IT ชั้น 2"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="field full">
                <label>หมายเลขเครื่อง / Serial</label>
                <input
                  type="text"
                  placeholder="เช่น SN-2024-001"
                  value={formData.serial}
                  onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                />
              </div>

              <div className="field full">
                <label>หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsFormOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> บันทึกข้อมูล
            </button>
          </div>
        </form>
      </Modal>

      {/* Centered Bottom Floating Batch Bar */}
      <FloatingBatchBar
        selectedCount={selectedIds.length}
        itemLabel="รายการ"
        onClearSelection={() => setSelectedIds([])}
        actions={[
          {
            label: 'ส่งออก Excel',
            variant: 'secondary',
            icon: <Icons.download size={14} />,
            onClick: handleBatchExport,
          },
          {
            label: 'เปลี่ยนสถานะ',
            variant: 'primary',
            icon: <Icons.refresh size={14} />,
            onClick: () => setIsBatchStatusModalOpen(true),
          },
          {
            label: 'ลบที่เลือก',
            variant: 'danger',
            icon: <Icons.trash size={14} />,
            onClick: async () => {
              const ok = await confirmDialog({
                title: 'ยืนยันการลบทรัพย์สินหลายรายการ',
                message: `คุณต้องการลบทรัพย์สินที่เลือกจำนวน ${selectedIds.length} รายการหรือไม่? ข้อมูลที่เกี่ยวข้องจะถูกลบถาวร`,
                type: 'danger',
                confirmText: `ยืนยันลบ ${selectedIds.length} รายการ`,
              });
              if (ok) {
                handleBatchDelete();
              }
            },
          },
        ]}
      />

      {/* Batch Change Status Modal */}
      <Modal
        isOpen={isBatchStatusModalOpen}
        onClose={() => setIsBatchStatusModalOpen(false)}
        title={`เปลี่ยนสถานะทรัพย์สิน ${selectedIds.length} รายการ`}
      >
        <div className="modal-body">
          <div className="field full">
            <label>เลือกสถานะใหม่</label>
            <CustomSelect
              fullWidth
              options={(Object.keys(STATUS_LABELS) as AssetStatus[]).map((st) => ({
                value: st,
                label: STATUS_LABELS[st].label,
              }))}
              value={batchStatusValue}
              onChange={(val) => setBatchStatusValue(val as AssetStatus)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setIsBatchStatusModalOpen(false)}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              handleBatchChangeStatus(batchStatusValue);
              setIsBatchStatusModalOpen(false);
            }}
          >
            <Icons.check size={15} /> ยืนยันเปลี่ยนสถานะ
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="empty-state">กำลังโหลดข้อมูล...</div>}>
      <AssetsList />
    </Suspense>
  );
}
