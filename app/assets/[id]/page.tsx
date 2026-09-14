'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Icons } from '@/components/Icons';
import { Modal } from '@/components/Modal';
import { CustomSelect } from '@/components/CustomSelect';
import { fmtDate } from '@/lib/utils';
import { STATUS_LABELS, AssetStatus } from '@/types';

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const {
    db,
    isLoaded,
    getAsset,
    getCategory,
    getDepartment,
    getEmployee,
    holderDisplayName,
    updateAsset,
    addAssignment,
    returnAssignment,
    addMaintenance,
  } = useApp();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isMaintOpen, setIsMaintOpen] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    categoryId: '',
    status: 'ready' as AssetStatus,
    purchaseDate: '',
    returnDate: '',
    holderName: '',
    location: '',
    serial: '',
    note: '',
    departmentId: '',
  });

  // Assign form state
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    departmentId: '',
    dateOut: new Date().toISOString().slice(0, 10),
    note: '',
  });

  // Return form state
  const [returnForm, setReturnForm] = useState({
    dateReturn: new Date().toISOString().slice(0, 10),
    note: '',
  });

  // Maintenance form state
  const [maintForm, setMaintForm] = useState({
    type: 'ตรวจเช็คตามระยะ',
    date: new Date().toISOString().slice(0, 10),
    vendor: '',
    description: '',
  });

  if (!isLoaded) {
    return <div className="empty-state">กำลังโหลดข้อมูล...</div>;
  }

  const asset = getAsset(id);

  if (!asset) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center' }}>
        <h3>ไม่พบข้อมูลทรัพย์สิน</h3>
        <p style={{ color: 'var(--ink-500)', marginTop: 8 }}>
          ทรัพย์สินรหัสนี้อาจถูกลบหรือไม่มีอยู่ในระบบ
        </p>
        <Link href="/assets" className="btn btn-outline" style={{ marginTop: 14 }}>
          <Icons.arrowLeft size={15} /> กลับไปยังทะเบียนทรัพย์สิน
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[asset.status] || STATUS_LABELS.ready;
  const category = getCategory(asset.categoryId);
  const department = getDepartment(asset.departmentId);

  // Find active assignment for this asset
  const activeAssignment = db.assignments.find(
    (a) => a.assetId === asset.id && !a.dateReturn
  );

  // Asset history timeline
  interface HistoryItem {
    id: string;
    date: string | null;
    type: 'created' | 'assign' | 'return' | 'maintenance' | 'done';
    title: string;
    meta?: string;
    sortDate: number;
  }

  const historyItems: HistoryItem[] = [];

  // Created event
  historyItems.push({
    id: 'created_' + asset.id,
    date: asset.purchaseDate,
    type: 'created',
    title: 'ขึ้นทะเบียนทรัพย์สิน',
    meta: `วันที่เบิกใช้งาน ${fmtDate(asset.purchaseDate)}`,
    sortDate: new Date(asset.purchaseDate || 0).getTime(),
  });

  // Assignments
  db.assignments
    .filter((a) => a.assetId === asset.id)
    .forEach((a) => {
      const empName = getEmployee(a.employeeId)?.name || 'ผู้รับมอบ';
      const deptName = getDepartment(a.departmentId)?.name || '';
      historyItems.push({
        id: a.id + '_out',
        date: a.dateOut,
        type: 'assign',
        title: `มอบหมายให้ ${empName}`,
        meta: deptName ? `หน่วยงาน: ${deptName}` : a.note || '',
        sortDate: new Date(a.dateOut).getTime(),
      });
      if (a.dateReturn) {
        historyItems.push({
          id: a.id + '_return',
          date: a.dateReturn,
          type: 'return',
          title: `คืนทรัพย์สินจาก ${empName}`,
          meta: a.note || '',
          sortDate: new Date(a.dateReturn).getTime(),
        });
      }
    });

  // Maintenance
  db.maintenance
    .filter((m) => m.assetId === asset.id)
    .forEach((m) => {
      historyItems.push({
        id: m.id + '_start',
        date: m.date,
        type: 'maintenance',
        title: `${m.type}: ${m.description || 'แจ้งซ่อมบำรุง'}`,
        meta: m.vendor ? `ผู้รับซ่อม: ${m.vendor}` : '',
        sortDate: new Date(m.date).getTime(),
      });
      if (m.completedDate) {
        historyItems.push({
          id: m.id + '_done',
          date: m.completedDate,
          type: 'done',
          title: 'ซ่อมบำรุงเสร็จสิ้น',
          meta: m.description || '',
          sortDate: new Date(m.completedDate).getTime(),
        });
      }
    });

  historyItems.sort((a, b) => a.sortDate - b.sortDate);

  const openEditModal = () => {
    setEditForm({
      name: asset.name,
      categoryId: asset.categoryId,
      status: asset.status,
      purchaseDate: asset.purchaseDate,
      returnDate: asset.returnDate || '',
      holderName: asset.holderName || '',
      location: asset.location || '',
      serial: asset.serial || '',
      note: asset.note || '',
      departmentId: asset.departmentId || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAsset(asset.id, {
      name: editForm.name.trim(),
      categoryId: editForm.categoryId,
      status: editForm.status,
      purchaseDate: editForm.purchaseDate,
      returnDate: editForm.returnDate || null,
      holderName: editForm.holderName.trim(),
      location: editForm.location.trim(),
      serial: editForm.serial.trim(),
      note: editForm.note.trim(),
      departmentId: editForm.departmentId,
    });
    setIsEditOpen(false);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAssignment({
      assetId: asset.id,
      employeeId: assignForm.employeeId,
      departmentId: assignForm.departmentId || asset.departmentId,
      dateOut: assignForm.dateOut,
      dateReturn: null,
      note: assignForm.note.trim(),
    });
    setIsAssignOpen(false);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeAssignment) {
      returnAssignment(activeAssignment.id, returnForm.dateReturn, returnForm.note.trim());
    }
    setIsReturnOpen(false);
  };

  const handleMaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMaintenance({
      assetId: asset.id,
      type: maintForm.type,
      date: maintForm.date,
      vendor: maintForm.vendor.trim(),
      description: maintForm.description.trim(),
    });
    setIsMaintOpen(false);
  };

  return (
    <div>
      <Link
        href="/assets"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--ink-900)',
          fontSize: 13,
          marginBottom: 14,
        }}
      >
        <Icons.arrowLeft size={16} /> กลับไปยังทะเบียนทรัพย์สิน
      </Link>

      {/* Main Info Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad">
          <div className="detail-head">
            <div>
              <div className="detail-title">{asset.name}</div>
              <span className={`tag ${statusInfo.cls}`}>
                <span className="tag-dot" />
                {statusInfo.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={openEditModal}>
                <Icons.edit size={14} /> แก้ไข
              </button>
              {activeAssignment ? (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsReturnOpen(true)}
                >
                  <Icons.check size={14} /> รับคืนทรัพย์สิน
                </button>
              ) : (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setAssignForm({
                      employeeId: db.employees[0]?.id || '',
                      departmentId: asset.departmentId || db.departments[0]?.id || '',
                      dateOut: new Date().toISOString().slice(0, 10),
                      note: '',
                    });
                    setIsAssignOpen(true);
                  }}
                >
                  <Icons.assign size={14} /> มอบหมายทรัพย์สิน
                </button>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setIsMaintOpen(true)}
              >
                <Icons.wrench size={14} /> แจ้งซ่อมบำรุง
              </button>
            </div>
          </div>

          <div className="kv-grid">
            <div className="kv-item">
              <div className="k">หมวดหมู่</div>
              <div className="v">{category ? `${category.name} (${category.code})` : '-'}</div>
            </div>
            <div className="kv-item">
              <div className="k">หน่วยงาน</div>
              <div className="v">{department?.name || '-'}</div>
            </div>
            <div className="kv-item">
              <div className="k">ผู้ถือครอง</div>
              <div className="v">{holderDisplayName(asset) || 'ไม่มีผู้ถือครอง'}</div>
            </div>
            <div className="kv-item">
              <div className="k">วันที่เบิกไปใช้งาน</div>
              <div className="v">{fmtDate(asset.purchaseDate)}</div>
            </div>
            <div className="kv-item">
              <div className="k">วันที่นำกลับมาคืน</div>
              <div className="v">{asset.returnDate ? fmtDate(asset.returnDate) : '-'}</div>
            </div>
            <div className="kv-item">
              <div className="k">สถานที่จัดเก็บ</div>
              <div className="v">{asset.location || '-'}</div>
            </div>
            <div className="kv-item">
              <div className="k">หมายเลขเครื่อง / Serial</div>
              <div className="v">{asset.serial || '-'}</div>
            </div>
          </div>

          {asset.note && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <div className="kv-item">
                <div className="k">หมายเหตุ</div>
                <div className="v" style={{ fontWeight: 400 }}>
                  {asset.note}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Timeline Card */}
      <div className="card">
        <div className="card-head">
          <h3>ประวัติการใช้งานและซ่อมบำรุง</h3>
        </div>
        <div className="card-pad">
          <div className="timeline">
            {historyItems.map((h) => {
              let dotIcon = <Icons.check size={10} />;
              let dotBg = 'var(--navy-800)';
              if (h.type === 'created') {
                dotIcon = <Icons.box size={10} />;
              } else if (h.type === 'maintenance') {
                dotIcon = <Icons.wrench size={10} />;
                dotBg = 'var(--amber-700)';
              }

              return (
                <div className="tl-item" key={h.id}>
                  <div className="tl-dot" style={{ background: dotBg }}>
                    {dotIcon}
                  </div>
                  <div className="tl-content">
                    <div className="tl-title">{h.title}</div>
                    <div className="tl-meta">
                      {fmtDate(h.date)}
                      {h.meta ? ` · ${h.meta}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="แก้ไขข้อมูลทรัพย์สิน"
        wide
      >
        <form onSubmit={handleEditSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field full">
                <label>
                  ชื่อทรัพย์สิน <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                  value={editForm.categoryId}
                  onChange={(val) => setEditForm({ ...editForm, categoryId: val })}
                  placeholder="-- เลือกหมวดหมู่ --"
                />
              </div>

              <div className="field">
                <label>หน่วยงาน</label>
                <CustomSelect
                  fullWidth
                  options={[
                    { value: '', label: '-- ไม่ระบุหน่วยงาน --' },
                    ...db.departments.map((d) => ({
                      value: d.id,
                      label: d.name,
                    })),
                  ]}
                  value={editForm.departmentId}
                  onChange={(val) => setEditForm({ ...editForm, departmentId: val })}
                  placeholder="-- เลือกหน่วยงาน --"
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
                  value={editForm.status}
                  onChange={(val) => setEditForm({ ...editForm, status: val as AssetStatus })}
                />
              </div>

              <div className="field">
                <label>
                  วันที่เบิกใช้งาน <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={editForm.purchaseDate}
                  onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                />
              </div>

              <div className="field">
                <label>วันที่นำกลับมาคืน</label>
                <input
                  type="date"
                  value={editForm.returnDate}
                  onChange={(e) => setEditForm({ ...editForm, returnDate: e.target.value })}
                />
              </div>

              <div className="field">
                <label>ผู้ถือครองปัจจุบัน</label>
                <input
                  type="text"
                  value={editForm.holderName}
                  onChange={(e) => setEditForm({ ...editForm, holderName: e.target.value })}
                />
              </div>

              <div className="field">
                <label>สถานที่จัดเก็บ</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>

              <div className="field">
                <label>หมายเลขเครื่อง / Serial</label>
                <input
                  type="text"
                  value={editForm.serial}
                  onChange={(e) => setEditForm({ ...editForm, serial: e.target.value })}
                />
              </div>

              <div className="field full">
                <label>หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsEditOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title={`มอบหมายทรัพย์สิน: ${asset.name}`}
      >
        <form onSubmit={handleAssignSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field full">
                <label>
                  มอบหมายให้ <span className="req">*</span>
                </label>
                {db.employees.length > 0 ? (
                  <CustomSelect
                    fullWidth
                    options={db.employees.map((emp) => ({
                      value: emp.id,
                      label: emp.name,
                      sublabel: getDepartment(emp.department)?.name,
                    }))}
                    value={assignForm.employeeId}
                    onChange={(val) => setAssignForm({ ...assignForm, employeeId: val })}
                    placeholder="-- เลือกจากบุคลากร --"
                  />
                ) : (
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="พิมพ์ชื่อผู้รับมอบ"
                      value={assignForm.note}
                      onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                    />
                    <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 4 }}>
                      *ยังไม่มีรายชื่อบุคลากรในระบบ สามารถพิมพ์ชื่อระบุในช่องนี้ได้
                    </div>
                  </div>
                )}
              </div>

              <div className="field">
                <label>หน่วยงาน</label>
                <CustomSelect
                  fullWidth
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
                <input
                  type="date"
                  required
                  value={assignForm.dateOut}
                  onChange={(e) => setAssignForm({ ...assignForm, dateOut: e.target.value })}
                />
              </div>

              <div className="field full">
                <label>หมายเหตุการมอบหมาย</label>
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
              <Icons.check size={15} /> ยืนยันมอบหมาย
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Modal */}
      <Modal
        isOpen={isReturnOpen}
        onClose={() => setIsReturnOpen(false)}
        title="รับคืนทรัพย์สิน"
      >
        <form onSubmit={handleReturnSubmit}>
          <div className="modal-body">
            <div className="field full">
              <label>
                วันที่รับคืน <span className="req">*</span>
              </label>
              <input
                type="date"
                required
                value={returnForm.dateReturn}
                onChange={(e) =>
                  setReturnForm({ ...returnForm, dateReturn: e.target.value })
                }
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
              onClick={() => setIsReturnOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> ยืนยันรับคืน
            </button>
          </div>
        </form>
      </Modal>

      {/* Maintenance Modal */}
      <Modal
        isOpen={isMaintOpen}
        onClose={() => setIsMaintOpen(false)}
        title={`แจ้งซ่อมบำรุง: ${asset.name}`}
      >
        <form onSubmit={handleMaintSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field">
                <label>
                  ประเภทงาน <span className="req">*</span>
                </label>
                <CustomSelect
                  fullWidth
                  options={[
                    { value: 'ตรวจเช็คตามระยะ', label: 'ตรวจเช็คตามระยะ' },
                    { value: 'ซ่อมบำรุงตามระยะ', label: 'ซ่อมบำรุงตามระยะ' },
                    { value: 'ซ่อมแซม', label: 'ซ่อมแซม' },
                    { value: 'อื่นๆ', label: 'อื่นๆ' },
                  ]}
                  value={maintForm.type}
                  onChange={(val) => setMaintForm({ ...maintForm, type: val })}
                />
              </div>
              <div className="field">
                <label>
                  วันที่แจ้ง <span className="req">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={maintForm.date}
                  onChange={(e) => setMaintForm({ ...maintForm, date: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>ผู้รับซ่อม / ร้านค้า / ศูนย์บริการ</label>
                <input
                  type="text"
                  placeholder="เช่น บริษัท คอมพิวเตอร์เซอร์วิส จำกัด"
                  value={maintForm.vendor}
                  onChange={(e) => setMaintForm({ ...maintForm, vendor: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>รายละเอียดอาการ / งานที่ทำ</label>
                <textarea
                  rows={3}
                  placeholder="ระบุอาการชำรุด หรือรายละเอียดงานซ่อมบำรุง"
                  value={maintForm.description}
                  onChange={(e) =>
                    setMaintForm({ ...maintForm, description: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsMaintOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> บันทึกแจ้งซ่อม
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
