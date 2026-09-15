'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Icons } from '@/components/Icons';
import { Modal } from '@/components/Modal';
import { CustomSelect } from '@/components/CustomSelect';
import { Pagination } from '@/components/Pagination';
import { FloatingBatchBar } from '@/components/FloatingBatchBar';
import { Employee, UserRole, ROLE_LABELS } from '@/types';

type SettingsTab = 'org' | 'dept_emp' | 'data';

function generateRandomPassword() {
  const prefixes = ['Ams', 'Pass', 'Key', 'Sec', 'Net'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}@${num}`;
}

export default function SettingsPage() {
  const {
    db,
    isLoaded,
    currentUser,
    updateOrgInfo,
    addDepartment,
    deleteDepartment,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    exportToExcel,
    importFromExcel,
    downloadExcelTemplate,
    resetDatabase,
    showToast,
    confirmDialog,
    getDepartment,
  } = useApp();

  // Organization form
  const [orgName, setOrgName] = useState('');
  const [orgSub, setOrgSub] = useState('');

  // Department modal & multi-selection
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [deptSelectedIds, setDeptSelectedIds] = useState<string[]>([]);
  const [deptPage, setDeptPage] = useState(1);
  const [deptPageSize, setDeptPageSize] = useState(10);

  // Employee modal & multi-selection
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState('');
  const [empUsername, setEmpUsername] = useState('');
  const [empRole, setEmpRole] = useState<UserRole>('user');
  const [empPosition, setEmpPosition] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empLocation, setEmpLocation] = useState('');
  const [empGeneratedPassword, setEmpGeneratedPassword] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [empSelectedIds, setEmpSelectedIds] = useState<string[]>([]);
  const [empPage, setEmpPage] = useState(1);
  const [empPageSize, setEmpPageSize] = useState(10);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safely sync initial org name
  useEffect(() => {
    if (isLoaded) {
      setOrgName(db.orgName || 'องค์กรของคุณ');
      setOrgSub(db.orgSub || '');
    }
  }, [isLoaded, db.orgName, db.orgSub]);

  // If loading or not admin
  if (!isLoaded) {
    return <div className="empty-state">กำลังโหลดข้อมูล...</div>;
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', padding: '36px 24px' }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Icons.shield size={28} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5, marginBottom: 20 }}>
          หน้านี้จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ หากต้องการเข้าใช้งาน กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ
        </p>
      </div>
    );
  }

  const handleOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrgInfo(orgName, orgSub);
  };

  // Department Handlers
  const handleDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    addDepartment(deptName.trim());
    setDeptName('');
    setIsDeptModalOpen(false);
  };

  const handleDeleteSingleDept = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: 'ยืนยันการลบแผนก',
      message: `คุณต้องการลบแผนก "${name}" หรือไม่?`,
      type: 'danger',
      confirmText: 'ลบแผนก',
    });
    if (ok) {
      deleteDepartment(id);
      setDeptSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBatchDeleteDept = async () => {
    if (deptSelectedIds.length === 0) return;
    const ok = await confirmDialog({
      title: 'ยืนยันการลบแผนกหลายรายการ',
      message: `คุณต้องการลบแผนกที่เลือกทั้งหมด ${deptSelectedIds.length} รายการหรือไม่?`,
      type: 'danger',
      confirmText: 'ลบรายการที่เลือก',
    });
    if (ok) {
      let deletedCount = 0;
      for (const id of deptSelectedIds) {
        const success = deleteDepartment(id);
        if (success) deletedCount++;
      }
      setDeptSelectedIds([]);
      showToast(`ลบแผนกเรียบร้อยแล้ว ${deletedCount} รายการ`);
    }
  };

  // Filtered Departments
  const filteredDepts = db.departments.filter(
    (d) => !deptSearch || d.name.toLowerCase().includes(deptSearch.toLowerCase())
  );
  const totalDeptPages = Math.ceil(filteredDepts.length / deptPageSize) || 1;
  const currentDeptPage = Math.min(deptPage, totalDeptPages);
  const pagedDepts = filteredDepts.slice((currentDeptPage - 1) * deptPageSize, currentDeptPage * deptPageSize);

  const isAllDeptsSelected =
    pagedDepts.length > 0 && pagedDepts.every((d) => deptSelectedIds.includes(d.id));

  const toggleSelectAllDepts = () => {
    if (isAllDeptsSelected) {
      setDeptSelectedIds((prev) => prev.filter((id) => !pagedDepts.some((d) => d.id === id)));
    } else {
      const idsToAdd = pagedDepts.map((d) => d.id);
      setDeptSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
  };

  const toggleSelectDept = (id: string) => {
    setDeptSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Employee Handlers
  const openAddEmpModal = () => {
    setEditingEmp(null);
    setEmpName('');
    setEmpUsername('');
    setEmpRole('user');
    setEmpPosition('');
    setEmpDept(db.departments[0]?.id || '');
    setEmpLocation('');
    setEmpGeneratedPassword(generateRandomPassword());
    setIsEmpModalOpen(true);
  };

  const openEditEmpModal = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpName(emp.name);
    setEmpUsername(emp.username);
    setEmpRole(emp.role);
    setEmpPosition(emp.position || '');
    setEmpDept(emp.department || '');
    setEmpLocation(emp.location || '');
    setEmpGeneratedPassword('');
    setIsEmpModalOpen(true);
  };

  const copyPasswordToClipboard = (password: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(password);
      showToast('คัดลอกรหัสผ่านลงในคลิปบอร์ดแล้ว', 'info');
    }
  };

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) return;

    const finalUsername = empUsername.trim().toLowerCase().replace(/\s+/g, '') || `user${Date.now().toString().slice(-4)}`;

    // Check duplicate username if adding or changing
    const duplicate = db.employees.some(
      (emp) => emp.username.toLowerCase() === finalUsername && emp.id !== editingEmp?.id
    );
    if (duplicate) {
      showToast('ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น', 'error');
      return;
    }

    if (editingEmp) {
      await updateEmployee(editingEmp.id, {
        name: empName.trim(),
        username: finalUsername,
        role: empRole,
        position: empPosition.trim(),
        department: empDept,
        departmentId: empDept,
        location: empLocation.trim(),
        ...(empGeneratedPassword
          ? { password: empGeneratedPassword, mustChangePassword: true }
          : {}),
      });
      showToast('บันทึกการแก้ไขข้อมูลบุคลากรเรียบร้อยแล้ว');
    } else {
      await addEmployee({
        name: empName.trim(),
        username: finalUsername,
        password: empGeneratedPassword,
        mustChangePassword: true,
        role: empRole,
        position: empPosition.trim(),
        department: empDept,
        departmentId: empDept,
        location: empLocation.trim(),
      });
      showToast(`เพิ่มบุคลากร "${empName.trim()}" เรียบร้อยแล้ว (รหัสผ่านเริ่มต้น: ${empGeneratedPassword})`);
    }
    setIsEmpModalOpen(false);
  };

  const handleDeleteSingleEmp = async (emp: Employee) => {
    if (emp.id === currentUser.id) {
      showToast('ไม่สามารถลบบัญชีของตนเองที่กำลังใช้งานอยู่ได้', 'error');
      return;
    }
    const ok = await confirmDialog({
      title: 'ยืนยันการลบบุคลากร',
      message: `คุณต้องการลบบุคลากร "${emp.name}" หรือไม่?`,
      type: 'danger',
      confirmText: 'ลบบุคลากร',
    });
    if (ok) {
      deleteEmployee(emp.id);
      setEmpSelectedIds((prev) => prev.filter((id) => id !== emp.id));
    }
  };

  const handleBatchDeleteEmp = async () => {
    if (empSelectedIds.length === 0) return;
    const ok = await confirmDialog({
      title: 'ยืนยันการลบบุคลากรหลายรายการ',
      message: `คุณต้องการลบบุคลากรที่เลือกทั้งหมด ${empSelectedIds.length} คนหรือไม่?`,
      type: 'danger',
      confirmText: 'ลบรายการที่เลือก',
    });
    if (ok) {
      let count = 0;
      for (const id of empSelectedIds) {
        if (id === currentUser.id) continue;
        const res = deleteEmployee(id);
        if (res) count++;
      }
      setEmpSelectedIds([]);
      showToast(`ลบบุคลากรเรียบร้อยแล้ว ${count} คน`);
    }
  };

  // Filtered Employees
  const filteredEmps = db.employees.filter((emp) => {
    if (!empSearch) return true;
    const q = empSearch.toLowerCase();
    const dept = getDepartment(emp.department);
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      (emp.position && emp.position.toLowerCase().includes(q)) ||
      (dept?.name && dept.name.toLowerCase().includes(q)) ||
      (emp.location && emp.location.toLowerCase().includes(q))
    );
  });
  const totalEmpPages = Math.ceil(filteredEmps.length / empPageSize) || 1;
  const currentEmpPage = Math.min(empPage, totalEmpPages);
  const pagedEmps = filteredEmps.slice((currentEmpPage - 1) * empPageSize, currentEmpPage * empPageSize);

  const isAllEmpsSelected =
    pagedEmps.length > 0 && pagedEmps.every((e) => empSelectedIds.includes(e.id));

  const toggleSelectAllEmps = () => {
    if (isAllEmpsSelected) {
      setEmpSelectedIds((prev) => prev.filter((id) => !pagedEmps.some((e) => e.id === id)));
    } else {
      const idsToAdd = pagedEmps.map((e) => e.id);
      setEmpSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
  };

  const toggleSelectEmp = (id: string) => {
    setEmpSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Excel handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importFromExcel(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetSystem = async () => {
    const ok = await confirmDialog({
      title: 'ยืนยันการล้างข้อมูลทั้งหมด (รีเซ็ตระบบ)',
      message:
        'คำเตือน: ข้อมูลทรัพย์สิน หมวดหมู่ แผนก บุคลากร และประวัติทั้งหมดในเครื่องนี้จะถูกล้างออกและรีเซ็ตเริ่มต้นใหม่ทั้งหมด คุณแน่ใจหรือไม่?',
      type: 'danger',
      confirmText: 'ยืนยันล้างข้อมูลทั้งหมด',
    });
    if (ok) {
      resetDatabase();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
      {/* Row 1: Org and Backup */}
      <div className="grid grid-2-equal" style={{ alignItems: 'stretch' }}>
        {/* Section: Organization */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-head">
              <h3>ข้อมูลองค์กร / ส่วนราชการ</h3>
            </div>
            <div className="card-pad">
              <form onSubmit={handleOrgSubmit}>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>ชื่อองค์กร / หน่วยงาน</label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label>ชื่อรอง (เช่น สำนักงานใหญ่ / สาขา / กรม)</label>
                  <input
                    type="text"
                    value={orgSub}
                    onChange={(e) => setOrgSub(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  <Icons.check size={15} /> บันทึกข้อมูลองค์กร
                </button>
              </form>
            </div>
          </div>

          {/* Section: Backup & Data Management */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-head">
              <h3>สำรองและนำเข้าข้อมูล (Excel)</h3>
            </div>
            <div className="card-pad" style={{ flex: 1 }}>
              <p style={{ fontSize: 13, color: 'var(--ink-700)', marginTop: 0 }}>
                ส่งออกข้อมูลทั้งหมดเป็นไฟล์ Excel (.xlsx) เพื่อสำรองข้อมูล
                หรือนำเข้าไฟล์สำรองที่เคยบันทึกไว้เพื่อกู้คืนข้อมูล
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={exportToExcel}>
                  <Icons.download size={15} /> ส่งออกข้อมูลทั้งหมด (.xlsx)
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icons.upload size={15} /> นำเข้าข้อมูลสำรอง (.xlsx)
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
                  ดาวน์โหลดไฟล์แม่แบบ (Excel Template)
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 0 }}>
                  หากต้องการนำเข้าทรัพย์สินจำนวนมากจากไฟล์ Excel สามารถดาวน์โหลดไฟล์แม่แบบที่มีโครงสร้างชีทและคอลัมน์มาตรฐานไปกรอกข้อมูลได้ทันที
                </p>
                <button className="btn btn-gold btn-sm" onClick={downloadExcelTemplate}>
                  <Icons.download size={14} /> ดาวน์โหลดแม่แบบ Excel
                </button>
              </div>
            </div>
          </div>
      </div>

      {/* Row 2: Departments & Employees */}
      <div className="grid grid-2-equal" style={{ alignItems: 'start' }}>
          {/* Section: Departments */}
          <div className="card">
            <div className="card-head">
              <div>
                <h3>แผนก</h3>
                <span className="hint">ทั้งหมด {db.departments.length} แผนก</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setDeptName('');
                  setIsDeptModalOpen(true);
                }}
              >
                <Icons.plus size={14} /> เพิ่มแผนก
              </button>
            </div>

            {db.departments.length > 0 && (
              <div className="table-toolbar" style={{ borderBottom: '1px solid var(--line)', padding: '8px 14px' }}>
                <div className="search-box" style={{ width: '100%' }}>
                  <Icons.search size={14} />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อแผนก..."
                    value={deptSearch}
                    onChange={(e) => {
                      setDeptSearch(e.target.value);
                      setDeptPage(1);
                    }}
                  />
                  {deptSearch && (
                    <button className="clear-btn" onClick={() => setDeptSearch('')}>✕</button>
                  )}
                </div>
              </div>
            )}

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <label className="checkbox-wrap">
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={isAllDeptsSelected}
                          onChange={toggleSelectAllDepts}
                        />
                      </label>
                    </th>
                    <th>ชื่อแผนก</th>
                    <th style={{ width: 140 }}>จำนวนบุคลากร</th>
                    <th className="th-right" style={{ width: 80 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDepts.length > 0 ? (
                    pagedDepts.map((d) => {
                      const count = db.employees.filter((e) => e.department === d.id || e.department === d.name).length;
                      const isSelected = deptSelectedIds.includes(d.id);
                      return (
                        <tr key={d.id} className={isSelected ? 'selected-row' : ''}>
                          <td style={{ textAlign: 'center' }}>
                            <label className="checkbox-wrap">
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectDept(d.id)}
                              />
                            </label>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{d.name}</td>
                          <td>
                            <span className="badge-count">{count} คน</span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-btn danger"
                                title="ลบแผนก"
                                onClick={() => handleDeleteSingleDept(d.id, d.name)}
                              >
                                <Icons.trash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state" style={{ padding: '36px 10px' }}>
                          <div className="et">ไม่พบแผนก</div>
                          <div>กดปุ่ม "เพิ่มแผนก" เพื่อเพิ่มข้อมูล</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentDeptPage}
              totalPages={totalDeptPages}
              pageSize={deptPageSize}
              totalItems={filteredDepts.length}
              onPageChange={setDeptPage}
              onPageSizeChange={(size) => {
                setDeptPageSize(size);
                setDeptPage(1);
              }}
            />
          </div>

          {/* Employees Card */}
          <div className="card">
            <div className="card-head">
              <div>
                <h3>บุคลากร / ผู้ใช้งานระบบ</h3>
                <span className="hint">ทั้งหมด {db.employees.length} คน</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openAddEmpModal}>
                <Icons.plus size={14} /> เพิ่มบุคลากร
              </button>
            </div>

            {db.employees.length > 0 && (
              <div className="table-toolbar" style={{ borderBottom: '1px solid var(--line)', padding: '8px 14px' }}>
                <div className="search-box" style={{ width: '100%' }}>
                  <Icons.search size={14} />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ, Username, แผนก, ตำแหน่ง..."
                    value={empSearch}
                    onChange={(e) => {
                      setEmpSearch(e.target.value);
                      setEmpPage(1);
                    }}
                  />
                  {empSearch && (
                    <button className="clear-btn" onClick={() => setEmpSearch('')}>✕</button>
                  )}
                </div>
              </div>
            )}

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <label className="checkbox-wrap">
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={isAllEmpsSelected}
                          onChange={toggleSelectAllEmps}
                        />
                      </label>
                    </th>
                    <th>ชื่อ / รหัสพนักงาน</th>
                    <th>สิทธิ์</th>
                    <th>ตำแหน่ง</th>
                    <th>แผนก</th>
                    <th className="th-right" style={{ width: 80 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEmps.length > 0 ? (
                    pagedEmps.map((emp) => {
                      const dept = getDepartment(emp.department || emp.departmentId);
                      const isSelected = empSelectedIds.includes(emp.id);
                      const roleMeta = ROLE_LABELS[emp.role] || ROLE_LABELS.user;
                      return (
                        <tr key={emp.id} className={isSelected ? 'selected-row' : ''}>
                          <td style={{ textAlign: 'center' }}>
                            <label className="checkbox-wrap">
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectEmp(emp.id)}
                              />
                            </label>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{emp.name}</div>
                            <div className="cell-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <code>@{emp.username}</code>
                              {emp.mustChangePassword && (
                                <span style={{ color: '#d97706', fontSize: 11 }} title="ต้องเปลี่ยนรหัสผ่านเมื่อเข้าใช้งานครั้งแรก">
                                  (รหัสเริ่มต้น)
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${roleMeta.badgeCls}`}>
                              {roleMeta.label}
                            </span>
                          </td>
                          <td>
                            <div style={{ color: 'var(--ink-800)' }}>{emp.position || '-'}</div>
                          </td>
                          <td>
                            {dept ? (
                              <span className="badge-pill">{dept.name}</span>
                            ) : (
                              <span className="cell-sub">-</span>
                            )}
                          </td>

                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-btn"
                                title="แก้ไขข้อมูล"
                                onClick={() => openEditEmpModal(emp)}
                              >
                                <Icons.edit size={14} />
                              </button>
                              <button
                                className="icon-btn danger"
                                title="ลบบุคลากร"
                                onClick={() => handleDeleteSingleEmp(emp)}
                              >
                                <Icons.trash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state" style={{ padding: '36px 10px' }}>
                          <div className="et">ไม่พบรายชื่อบุคลากร</div>
                          <div>กดปุ่ม "เพิ่มบุคลากร" เพื่อเพิ่มข้อมูลผู้ใช้งาน</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentEmpPage}
              totalPages={totalEmpPages}
              pageSize={empPageSize}
              totalItems={filteredEmps.length}
              onPageChange={setEmpPage}
              onPageSizeChange={(size) => {
                setEmpPageSize(size);
                setEmpPage(1);
              }}
            />
          </div>
      </div>

      {/* Section: Advanced Management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ borderColor: '#fca5a5' }}>
            <div className="card-head" style={{ background: '#fef2f2', borderBottomColor: '#fecaca' }}>
              <h3 style={{ color: 'var(--red-700)' }}>พื้นที่จัดการข้อมูลขั้นสูง (Danger Zone)</h3>
            </div>
            <div className="card-pad">
              <p style={{ fontSize: 13, color: 'var(--ink-700)', marginTop: 0 }}>
                การล้างข้อมูลจะทำการลบข้อมูลทรัพย์สิน, ประวัติการเบิก-ยืม, ประวัติซ่อมบำรุง, หมวดหมู่, และแผนกทั้งหมด
                และคืนค่าระบบให้เป็นฐานข้อมูลเริ่มต้น (กรุณาสำรองข้อมูลก่อนทำรายการ)
              </p>

              <button
                className="btn btn-danger"
                style={{ marginTop: 14 }}
                onClick={handleResetSystem}
              >
                <Icons.refresh size={15} /> ล้างข้อมูลทั้งหมด (รีเซ็ตระบบ)
              </button>
            </div>
          </div>
      </div>

      {/* Centered Floating Batch Bar for Departments & Employees */}
      <FloatingBatchBar
        selectedCount={deptSelectedIds.length}
        itemLabel="แผนก"
        onClearSelection={() => setDeptSelectedIds([])}
        actions={[
          {
            label: 'ลบแผนกที่เลือก',
            variant: 'danger',
            icon: <Icons.trash size={14} />,
            onClick: handleBatchDeleteDept,
          },
        ]}
      />

      <FloatingBatchBar
        selectedCount={empSelectedIds.length}
        itemLabel="คน"
        onClearSelection={() => setEmpSelectedIds([])}
        actions={[
          {
            label: 'ลบบุคลากรที่เลือก',
            variant: 'danger',
            icon: <Icons.trash size={14} />,
            onClick: handleBatchDeleteEmp,
          },
        ]}
      />

      {/* Add Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="เพิ่มแผนกใหม่"
      >
        <form onSubmit={handleDeptSubmit}>
          <div className="modal-body">
            <div className="field full">
              <label>
                ชื่อแผนก <span className="req">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น แผนกไอที, แผนกบัญชี, แผนกจัดซื้อ"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsDeptModalOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> บันทึก
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Employee Modal */}
      <Modal
        isOpen={isEmpModalOpen}
        onClose={() => setIsEmpModalOpen(false)}
        title={editingEmp ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่'}
      >
        <form onSubmit={handleEmpSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field">
                <label>
                  ชื่อ-นามสกุล <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>
                  รหัสพนักงาน (ใช้เป็น Username สำหรับเข้าสู่ระบบ) <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น EMP001 หรือ 12345"
                  value={empUsername}
                  onChange={(e) => setEmpUsername(e.target.value)}
                />
              </div>

              <div className="field">
                <label>สิทธิ์การใช้งาน (Role)</label>
                <CustomSelect
                  value={empRole}
                  options={[
                    { value: 'user', label: 'ผู้ใช้งานทั่วไป (User)' },
                    { value: 'staff', label: 'เจ้าหน้าที่พัสดุ (Staff)' },
                    { value: 'admin', label: 'ผู้ดูแลระบบ (Admin)' },
                  ]}
                  onChange={(val) => setEmpRole(val as UserRole)}
                />
              </div>

              <div className="field">
                <label>ตำแหน่งงาน</label>
                <input
                  type="text"
                  placeholder="เช่น นักวิชาการคอมพิวเตอร์, เจ้าพนักงานพัสดุ"
                  value={empPosition}
                  onChange={(e) => setEmpPosition(e.target.value)}
                />
              </div>

               <div className="field">
                 <label>แผนก</label>
                 <CustomSelect
                   placeholder="-- เลือกแผนก --"
                   options={[
                     { value: '', label: '-- ไม่ระบุแผนก --' },
                     ...db.departments.map((d) => ({
                       value: d.id,
                       label: d.name,
                     })),
                   ]}
                   value={empDept}
                   onChange={(val) => setEmpDept(val)}
                 />
               </div>

               <div className="field">
                 <label>สถานที่ทำงาน / ห้อง</label>
                 <input
                   type="text"
                   placeholder="เช่น ห้อง 201 อาคาร A"
                   value={empLocation}
                   onChange={(e) => setEmpLocation(e.target.value)}
                 />
               </div>

               {/* Initial / Temporary Password Box */}
              {(!editingEmp || empGeneratedPassword) ? (
                <div className="field full" style={{ marginTop: 6 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>รหัสผ่านแรกเข้าสำหรับการใช้งานครั้งแรก <span className="req">*</span></span>
                    <button
                      type="button"
                      className="password-gen-btn"
                      onClick={() => setEmpGeneratedPassword(generateRandomPassword())}
                    >
                      <Icons.refresh size={13} /> สุ่มรหัสใหม่
                    </button>
                  </label>
                  <div className="password-gen-box">
                    <input
                      type="text"
                      className="password-gen-input"
                      readOnly
                      value={empGeneratedPassword}
                    />
                    <button
                      type="button"
                      className="password-gen-btn"
                      title="คัดลอกรหัสผ่าน"
                      onClick={() => copyPasswordToClipboard(empGeneratedPassword)}
                    >
                      <Icons.copy size={14} /> คัดลอกรหัส
                    </button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                    ⚠️ บันทึกหรือแจ้งรหัสผ่านนี้ให้ผู้ใช้ทราบ โดยผู้ใช้งานจะถูกบังคับให้เปลี่ยนรหัสผ่านทันทีที่เข้าสู่ระบบครั้งแรก
                  </div>
                </div>
              ) : (
                <div className="field full" style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setEmpGeneratedPassword(generateRandomPassword())}
                  >
                    <Icons.key size={14} /> รีเซ็ตรหัสผ่านและกำหนดรหัสผ่านชั่วคราวใหม่
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsEmpModalOpen(false)}
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
