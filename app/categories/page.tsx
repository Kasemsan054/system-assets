'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Icons } from '@/components/Icons';
import { Modal } from '@/components/Modal';
import { Pagination } from '@/components/Pagination';
import { FloatingBatchBar } from '@/components/FloatingBatchBar';
import { Category } from '@/types';

export default function CategoriesPage() {
  const { db, isLoaded, addCategory, updateCategory, deleteCategory, confirmDialog, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Search & Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');

  const openAddModal = () => {
    setEditingCat(null);
    setFormCode('');
    setFormName('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCat(cat);
    setFormCode(cat.code);
    setFormName(cat.name);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) return;

    if (editingCat) {
      updateCategory(editingCat.id, {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
      });
    } else {
      addCategory({
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
      });
    }
    setIsModalOpen(false);
  };

  const handleDeleteSingle = async (cat: Category) => {
    const inUseCount = db.assets.filter((a) => a.categoryId === cat.id).length;
    if (inUseCount > 0) {
      showToast(`ไม่สามารถลบได้ เนื่องจากมีทรัพย์สินอยู่ในหมวดหมู่นี้ ${inUseCount} รายการ`, 'error');
      return;
    }

    const ok = await confirmDialog({
      title: 'ยืนยันการลบหมวดหมู่',
      message: `คุณต้องการลบหมวดหมู่ "${cat.name}" (${cat.code}) หรือไม่?`,
      type: 'danger',
      confirmText: 'ลบหมวดหมู่',
    });
    if (ok) {
      deleteCategory(cat.id);
      setSelectedIds((prev) => prev.filter((id) => id !== cat.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;

    // Check if any selected categories are in use
    const blockedCats = selectedIds
      .map((id) => db.categories.find((c) => c.id === id))
      .filter((c) => c && db.assets.some((a) => a.categoryId === c.id));

    if (blockedCats.length > 0) {
      const names = blockedCats.map((c) => `"${c?.name}"`).join(', ');
      showToast(`ไม่สามารถลบหมวดหมู่ ${names} ได้ เนื่องจากมีทรัพย์สินสังกัดอยู่`, 'error');
      return;
    }

    const ok = await confirmDialog({
      title: 'ยืนยันการลบหมวดหมู่หลายรายการ',
      message: `คุณต้องการลบหมวดหมู่ที่เลือกจำนวน ${selectedIds.length} รายการหรือไม่?`,
      type: 'danger',
      confirmText: `ยืนยันลบ ${selectedIds.length} รายการ`,
    });

    if (ok) {
      let deleted = 0;
      for (const id of selectedIds) {
        const success = deleteCategory(id);
        if (success) deleted++;
      }
      setSelectedIds([]);
      showToast(`ลบหมวดหมู่เรียบร้อยแล้ว ${deleted} รายการ`);
    }
  };

  const filteredCategories = useMemo(() => {
    return db.categories.filter((c) => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [db.categories, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredCategories.length);
  const paginatedCategories = filteredCategories.slice(startIndex, endIndex);

  const isAllCurrentPageSelected =
    paginatedCategories.length > 0 &&
    paginatedCategories.every((c) => selectedIds.includes(c.id));

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = paginatedCategories.map((c) => c.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedCategories.map((c) => c.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectCategory = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (!isLoaded) {
    return <div className="empty-state">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>รายการหมวดหมู่ทรัพย์สิน</h3>
          <span className="hint">
            ทั้งหมด {db.categories.length} หมวดหมู่
            {filteredCategories.length !== db.categories.length && ` (ตรงกับค้นหา ${filteredCategories.length} รายการ)`}
          </span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAddModal}>
          <Icons.plus size={15} /> เพิ่มหมวดหมู่
        </button>
      </div>

      {/* Toolbar / Search */}
      <div className="table-toolbar" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="search-box" style={{ maxWidth: 320 }}>
          <Icons.search size={16} />
          <input
            type="text"
            placeholder="ค้นหารหัส หรือชื่อหมวดหมู่..."
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
              <th style={{ width: 140 }}>รหัสหมวดหมู่</th>
              <th>ชื่อหมวดหมู่</th>
              <th style={{ width: 180 }}>จำนวนทรัพย์สิน</th>
              <th className="th-right" style={{ width: 120 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCategories.length > 0 ? (
              paginatedCategories.map((c) => {
                const count = db.assets.filter((a) => a.categoryId === c.id).length;
                const isSelected = selectedIds.includes(c.id);
                return (
                  <tr key={c.id} className={isSelected ? 'selected-row' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <label className="checkbox-wrap">
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCategory(c.id)}
                        />
                      </label>
                    </td>
                    <td>
                      <span className="asset-code">{c.code}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{c.name}</span>
                    </td>
                    <td>
                      <Link
                        href={`/assets?category=${c.id}`}
                        title="คลิกเพื่อดูรายการทรัพย์สินในหมวดหมู่นี้"
                        style={{ display: 'inline-flex', textDecoration: 'none' }}
                      >
                        <span className="badge-count">
                          {count} รายการ
                        </span>
                      </Link>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          title="แก้ไขหมวดหมู่"
                          onClick={() => openEditModal(c)}
                        >
                          <Icons.edit size={15} />
                        </button>
                        <button
                          className="icon-btn danger"
                          title="ลบหมวดหมู่"
                          onClick={() => handleDeleteSingle(c)}
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
                <td colSpan={6}>
                  <div className="empty-state">
                    <Icons.category size={40} />
                    <div className="et">
                      {searchTerm ? 'ไม่พบหมวดหมู่ที่ตรงกับการค้นหา' : 'ยังไม่มีหมวดหมู่ทรัพย์สิน'}
                    </div>
                    <div>
                      {searchTerm ? (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ marginTop: 10 }}
                          onClick={() => setSearchTerm('')}
                        >
                          ล้างคำค้นหา
                        </button>
                      ) : (
                        'เริ่มต้นด้วยการกดปุ่ม "เพิ่มหมวดหมู่" เช่น คอมพิวเตอร์และอุปกรณ์ไอที (IT), ครุภัณฑ์สำนักงาน (OF)'
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
        totalItems={filteredCategories.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
      />

      {/* Centered Bottom Floating Batch Bar */}
      <FloatingBatchBar
        selectedCount={selectedIds.length}
        itemLabel="หมวดหมู่"
        onClearSelection={() => setSelectedIds([])}
        actions={[
          {
            label: 'ลบหมวดหมู่ที่เลือก',
            variant: 'danger',
            icon: <Icons.trash size={14} />,
            onClick: handleBatchDelete,
          },
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCat ? 'แก้ไขหมวดหมู่ทรัพย์สิน' : 'เพิ่มหมวดหมู่ใหม่'}
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field">
                <label>
                  รหัสหมวดหมู่ (ย่อ) <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                  placeholder="เช่น IT, OF, VH"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className="field">
                <label>
                  ชื่อหมวดหมู่ <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คอมพิวเตอร์และอุปกรณ์ไอที"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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
              <Icons.check size={15} /> บันทึก
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
