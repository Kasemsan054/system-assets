'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Asset,
  Category,
  Department,
  Employee,
  Assignment,
  MaintenanceRecord,
  Database,
  DialogOptions,
  UserRole,
  STATUS_LABELS,
} from '@/types';
import { uid, normalizeDateForImport } from '@/lib/utils';
import { CustomDialog } from '@/components/CustomDialog';
import { Icons } from '@/components/Icons';

const STORAGE_KEY = 'ams-db-v2';
const USER_STORAGE_KEY = 'ams-current-user';

export const defaultAdmin: Employee = {
  id: 'emp_admin_system',
  name: 'ผู้ดูแลระบบ (Admin)',
  username: 'admin',
  password: 'admin1234',
  mustChangePassword: false,
  role: 'admin',
  position: 'ผู้ดูแลระบบสารสนเทศ',
  department: '',
  location: 'ศูนย์คอมพิวเตอร์',
};

const emptyDatabase: Database = {
  orgName: 'องค์กรของคุณ',
  orgSub: '',
  adminPin: '1234',
  categories: [],
  departments: [],
  employees: [defaultAdmin],
  assets: [],
  assignments: [],
  maintenance: [],
  seq: {},
};

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  text: string;
  type?: ToastType;
  title?: string;
  isErr?: boolean;
}

interface DialogState extends DialogOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

interface AppContextType {
  db: Database;
  isLoaded: boolean;
  currentUser: Employee | null;
  login: (username: string, password?: string) => { success: boolean; mustChange?: boolean; userId?: string; name?: string; message?: string };
  logout: () => void;
  changeUserPassword: (userId: string, newPass: string) => void;
  toasts: ToastMessage[];
  showToast: (text: string, typeOrErr?: ToastType | boolean, title?: string) => void;
  removeToast: (id: string) => void;
  confirmDialog: (options: DialogOptions) => Promise<boolean>;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  settingsUnlocked: boolean;
  setSettingsUnlocked: (unlocked: boolean) => void;

  // Helpers
  getCategory: (id?: string) => Category | undefined;
  getDepartment: (id?: string) => Department | undefined;
  getEmployee: (id?: string) => Employee | undefined;
  getAsset: (id?: string) => Asset | undefined;
  holderDisplayName: (asset?: Asset) => string;

  // Actions
  addAsset: (asset: Omit<Asset, 'id'>) => string;
  updateAsset: (id: string, updates: Partial<Asset>, silent?: boolean) => void;
  deleteAsset: (id: string) => void;

  addCategory: (category: Omit<Category, 'id'>) => string;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;

  addDepartment: (name: string) => string;
  deleteDepartment: (id: string) => boolean;

  addEmployee: (employee: Omit<Employee, 'id'>) => string;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => boolean;

  addAssignment: (assignment: Omit<Assignment, 'id'>) => string;
  returnAssignment: (assignmentId: string, dateReturn: string, note?: string) => void;

  addMaintenance: (record: Omit<MaintenanceRecord, 'id' | 'status' | 'completedDate'>) => string;
  completeMaintenance: (id: string, completedDate?: string) => void;

  updateOrgInfo: (orgName: string, orgSub: string) => void;
  changeAdminPin: (newPin: string) => void;

  resetDatabase: () => void;
  exportToExcel: () => void;
  importFromExcel: (file: File) => Promise<boolean>;
  downloadExcelTemplate: () => void;

  isD1Connected: boolean;
  syncWithD1: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(emptyDatabase);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isD1Connected, setIsD1Connected] = useState(false);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsUnlocked, setSettingsUnlocked] = useState(true);

  // Dialog state
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
  });

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let loadedDb = emptyDatabase;
      if (stored) {
        const parsed = JSON.parse(stored);
        const emps = parsed.employees && parsed.employees.length > 0 ? parsed.employees : [defaultAdmin];
        // Ensure at least one admin exists
        if (!emps.some((e: Employee) => e.role === 'admin')) {
          emps.unshift(defaultAdmin);
        }
        loadedDb = {
          ...emptyDatabase,
          ...parsed,
          categories: parsed.categories || [],
          departments: parsed.departments || [],
          employees: emps,
          assets: parsed.assets || [],
          assignments: parsed.assignments || [],
          maintenance: parsed.maintenance || [],
        };
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyDatabase));
      }
      setDb(loadedDb);

      // Load session or default to defaultAdmin
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          const found = loadedDb.employees.find((e) => e.id === parsedUser.id || e.username === parsedUser.username);
          setCurrentUser(found || loadedDb.employees[0] || defaultAdmin);
        } catch {
          setCurrentUser(loadedDb.employees[0] || defaultAdmin);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error('Error loading DB from localStorage', e);
      setDb(emptyDatabase);
      setCurrentUser(defaultAdmin);
    } finally {
      setIsLoaded(true);
      // Synchronize with Cloudflare D1 in the background
      syncWithD1();
    }
  }, []);

  const syncWithD1 = async () => {
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d1 = json.data;
          setDb((prev) => {
            const merged: Database = {
              ...prev,
              categories: Array.isArray(d1.categories) ? d1.categories : prev.categories,
              departments: Array.isArray(d1.departments) ? d1.departments : prev.departments,
              employees: Array.isArray(d1.employees) && d1.employees.length > 0 ? d1.employees : prev.employees,
              assets: Array.isArray(d1.assets) ? d1.assets : prev.assets,
              assignments: Array.isArray(d1.assignments) ? d1.assignments : prev.assignments,
              maintenance: Array.isArray(d1.maintenance) ? d1.maintenance : prev.maintenance,
              orgName: d1.settings?.orgName || prev.orgName,
              orgSub: d1.settings?.orgSub || prev.orgSub,
              adminPin: d1.settings?.adminPin || prev.adminPin,
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
          setIsD1Connected(true);
        }
      }
    } catch (e) {
      console.warn('Could not connect to D1, using local storage cache:', e);
      setIsD1Connected(false);
    }
  };

  // Save DB helper
  const saveDatabase = (updated: Database) => {
    setDb(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving DB to localStorage', e);
    }
  };

  // Auth methods
  const login = (username: string, password = '') => {
    const user = db.employees.find(
      (e) => e.username.toLowerCase() === username.toLowerCase()
    );
    if (!user) {
      return { success: false, message: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' };
    }

    if (user.password && user.password !== password) {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
    }

    // Set current user
    setCurrentUser(user);
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }

    if (user.mustChangePassword) {
      return { success: true, mustChange: true, userId: user.id, name: user.name };
    }

    return { success: true, userId: user.id, name: user.name };
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  const changeUserPassword = (userId: string, newPass: string) => {
    const updatedEmployees = db.employees.map((e) =>
      e.id === userId ? { ...e, password: newPass, mustChangePassword: false } : e
    );
    saveDatabase({ ...db, employees: updatedEmployees });

    if (currentUser?.id === userId) {
      const updatedUser = { ...currentUser, password: newPass, mustChangePassword: false };
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      } catch (e) {
        console.error(e);
      }
    }

    fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, password: newPass, mustChangePassword: false }),
    }).catch((err) => console.warn('D1 sync error:', err));
  };

  // Toast method
  const showToast = (text: string, typeOrErr: ToastType | boolean = 'success', title?: string) => {
    const id = uid('tst');
    let type: ToastType = 'success';
    if (typeof typeOrErr === 'boolean') {
      type = typeOrErr ? 'error' : 'success';
    } else if (typeOrErr) {
      type = typeOrErr;
    }

    setToasts((prev) => [...prev, { id, text, type, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Custom Dialog
  const confirmDialog = (options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        ...options,
        isOpen: true,
        resolve,
      });
    });
  };

  const handleDialogConfirm = () => {
    if (dialogState.resolve) dialogState.resolve(true);
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleDialogCancel = () => {
    if (dialogState.resolve) dialogState.resolve(false);
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  // Derived helpers
  const getCategory = (id?: string) => db.categories.find((c) => c.id === id);
  const getDepartment = (id?: string) => db.departments.find((d) => d.id === id);
  const getEmployee = (id?: string) => db.employees.find((e) => e.id === id);
  const getAsset = (id?: string) => db.assets.find((a) => a.id === id);
  const holderDisplayName = (asset?: Asset) => {
    if (!asset) return '';
    return (asset.holderName && asset.holderName.trim()) || getEmployee(asset.holderId || undefined)?.name || '';
  };

  // Asset actions
  const addAsset = (assetData: Omit<Asset, 'id'>) => {
    const newId = uid('ast');
    const newAsset: Asset = { ...assetData, id: newId };
    saveDatabase({
      ...db,
      assets: [...db.assets, newAsset],
    });
    fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAsset),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('เพิ่มทรัพย์สินใหม่เรียบร้อยแล้ว');
    return newId;
  };

  const updateAsset = (id: string, updates: Partial<Asset>, silent = false) => {
    const nextAssets = db.assets.map((a) => (a.id === id ? { ...a, ...updates } : a));
    saveDatabase({ ...db, assets: nextAssets });
    fetch(`/api/assets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch((err) => console.warn('D1 sync error:', err));
    if (!silent) showToast('บันทึกการแก้ไขเรียบร้อยแล้ว');
  };

  const deleteAsset = (id: string) => {
    saveDatabase({
      ...db,
      assets: db.assets.filter((a) => a.id !== id),
      assignments: db.assignments.filter((asg) => asg.assetId !== id),
      maintenance: db.maintenance.filter((m) => m.assetId !== id),
    });
    fetch(`/api/assets/${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('ลบทรัพย์สินเรียบร้อยแล้ว');
  };

  // Category actions
  const addCategory = (categoryData: Omit<Category, 'id'>) => {
    const newId = uid('cat');
    const code = categoryData.code.toUpperCase();
    const newCat: Category = { ...categoryData, id: newId, code };
    saveDatabase({
      ...db,
      categories: [...db.categories, newCat],
      seq: { ...db.seq, [code]: db.seq[code] || 0 },
    });
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCat),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('บันทึกหมวดหมู่เรียบร้อยแล้ว');
    return newId;
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    const nextCats = db.categories.map((c) =>
      c.id === id
        ? { ...c, ...updates, code: updates.code ? updates.code.toUpperCase() : c.code }
        : c
    );
    saveDatabase({ ...db, categories: nextCats });
    fetch('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('บันทึกหมวดหมู่เรียบร้อยแล้ว');
  };

  const deleteCategory = (id: string) => {
    const inUse = db.assets.some((a) => a.categoryId === id);
    if (inUse) {
      showToast('ไม่สามารถลบได้ เนื่องจากมีทรัพย์สินอยู่ในหมวดหมู่นี้', true);
      return false;
    }
    saveDatabase({
      ...db,
      categories: db.categories.filter((c) => c.id !== id),
    });
    fetch(`/api/categories?id=${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('ลบหมวดหมู่เรียบร้อยแล้ว');
    return true;
  };

  // Department actions
  const addDepartment = (name: string) => {
    const newId = uid('dep');
    saveDatabase({
      ...db,
      departments: [...db.departments, { id: newId, name: name.trim() }],
    });
    fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: name.trim() }),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('เพิ่มแผนกเรียบร้อยแล้ว');
    return newId;
  };

  const deleteDepartment = (id: string) => {
    const dept = db.departments.find((d) => d.id === id);
    const inUse = db.employees.some((e) => e.department === id || (dept && e.department === dept.name));
    if (inUse) {
      showToast('ไม่สามารถลบได้ เนื่องจากมีบุคลากรสังกัดอยู่ในแผนกนี้', true);
      return false;
    }
    saveDatabase({
      ...db,
      departments: db.departments.filter((d) => d.id !== id),
    });
    fetch(`/api/departments?id=${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('ลบแผนกเรียบร้อยแล้ว');
    return true;
  };

  // Employee actions
  const addEmployee = (empData: Omit<Employee, 'id'>) => {
    const newId = uid('emp');
    const newEmp = { ...empData, id: newId };
    saveDatabase({
      ...db,
      employees: [...db.employees, newEmp],
    });
    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEmp),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('เพิ่มบุคลากรเรียบร้อยแล้ว');
    return newId;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    saveDatabase({
      ...db,
      employees: db.employees.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    });
    fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('บันทึกข้อมูลบุคลากรเรียบร้อยแล้ว');
  };

  const deleteEmployee = (id: string) => {
    const inUse = db.assignments.some((a) => a.employeeId === id && !a.dateReturn);
    if (inUse) {
      showToast('ไม่สามารถลบได้ เนื่องจากบุคลากรนี้กำลังถือครองทรัพย์สินอยู่', true);
      return false;
    }
    saveDatabase({
      ...db,
      employees: db.employees.filter((e) => e.id !== id),
    });
    fetch(`/api/employees?id=${id}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('ลบบุคลากรเรียบร้อยแล้ว');
    return true;
  };

  // Assignment actions
  const addAssignment = (data: Omit<Assignment, 'id'>) => {
    const newId = uid('asg');
    const newAsg: Assignment = { ...data, id: newId };
    const nextAssets = db.assets.map((a) => {
      if (a.id === data.assetId) {
        return {
          ...a,
          holderId: data.employeeId,
          holderName: '',
          departmentId: data.departmentId || a.departmentId,
          status: a.status === 'ready' ? ('issued' as const) : a.status,
        };
      }
      return a;
    });

    saveDatabase({
      ...db,
      assignments: [...db.assignments, newAsg],
      assets: nextAssets,
    });
    fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAsg),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('มอบหมายทรัพย์สินเรียบร้อยแล้ว');
    return newId;
  };

  const returnAssignment = (assignmentId: string, dateReturn: string, note?: string) => {
    let targetAssetId = '';
    let targetEmpId = '';

    const nextAssignments = db.assignments.map((a) => {
      if (a.id === assignmentId) {
        targetAssetId = a.assetId;
        targetEmpId = a.employeeId;
        return {
          ...a,
          dateReturn,
          note: note ? (a.note ? `${a.note} / ${note}` : note) : a.note,
        };
      }
      return a;
    });

    const nextAssets = db.assets.map((a) => {
      if (a.id === targetAssetId && a.holderId === targetEmpId) {
        return {
          ...a,
          holderId: null,
          holderName: '',
          status: a.status === 'issued' ? ('ready' as const) : a.status,
        };
      }
      return a;
    });

    saveDatabase({
      ...db,
      assignments: nextAssignments,
      assets: nextAssets,
    });
    fetch('/api/assignments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assignmentId, dateReturn, note }),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('บันทึกการรับคืนทรัพย์สินแล้ว');
  };

  // Maintenance actions
  const addMaintenance = (record: Omit<MaintenanceRecord, 'id' | 'status' | 'completedDate'>) => {
    const newId = uid('mnt');
    const newMnt: MaintenanceRecord = {
      ...record,
      id: newId,
      status: 'in_progress',
      completedDate: null,
    };

    const nextAssets = db.assets.map((a) => {
      if (a.id === record.assetId) {
        return { ...a, status: 'repair' as const };
      }
      return a;
    });

    saveDatabase({
      ...db,
      maintenance: [...db.maintenance, newMnt],
      assets: nextAssets,
    });
    fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMnt),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('แจ้งซ่อมบำรุงเรียบร้อยแล้ว');
    return newId;
  };

  const completeMaintenance = (id: string, completedDate?: string) => {
    const finishDate = completedDate || new Date().toISOString().slice(0, 10);
    let targetAssetId = '';

    const nextMaintenance = db.maintenance.map((m) => {
      if (m.id === id) {
        targetAssetId = m.assetId;
        return { ...m, status: 'done' as const, completedDate: finishDate };
      }
      return m;
    });

    const stillInRepair = nextMaintenance.some(
      (m) => m.assetId === targetAssetId && m.status === 'in_progress'
    );

    const nextAssets = db.assets.map((a) => {
      if (a.id === targetAssetId && a.status === 'repair' && !stillInRepair) {
        return { ...a, status: 'ready' as const };
      }
      return a;
    });

    saveDatabase({
      ...db,
      maintenance: nextMaintenance,
      assets: nextAssets,
    });
    fetch('/api/maintenance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done', completedDate: finishDate }),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('บันทึกการซ่อมบำรุงเสร็จสิ้นแล้ว');
  };

  // Organization settings
  const updateOrgInfo = (orgName: string, orgSub: string) => {
    const cleanOrgName = orgName.trim() || 'องค์กรของคุณ';
    const cleanOrgSub = orgSub.trim();
    saveDatabase({
      ...db,
      orgName: cleanOrgName,
      orgSub: cleanOrgSub,
    });
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName: cleanOrgName, orgSub: cleanOrgSub }),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('บันทึกข้อมูลองค์กรเรียบร้อยแล้ว');
  };

  const changeAdminPin = (newPin: string) => {
    saveDatabase({
      ...db,
      adminPin: newPin,
    });
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPin: newPin }),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('เปลี่ยนรหัสผ่านผู้ดูแลระบบเรียบร้อยแล้ว');
  };

  // Excel export
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const catRows = db.categories.map((c) => ({
        'รหัสอ้างอิง': c.id,
        'รหัสหมวดหมู่': c.code,
        'ชื่อหมวดหมู่': c.name,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'หมวดหมู่');

      const depRows = db.departments.map((d) => ({
        'รหัสอ้างอิง': d.id,
        'ชื่อหน่วยงาน': d.name,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depRows), 'หน่วยงาน');

      const empRows = db.employees.map((e) => ({
        'รหัสอ้างอิง': e.id,
        'ชื่อ-นามสกุล': e.name,
        'รหัสหน่วยงาน': e.department || '',
        'หน่วยงาน': getDepartment(e.department)?.name || '',
        'สถานที่': e.location || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows), 'บุคลากร');

      const assetRows = db.assets.map((a) => ({
        'รหัสอ้างอิง': a.id,
        'ชื่อทรัพย์สิน': a.name,
        'รหัสหมวดหมู่': a.categoryId,
        'หมวดหมู่': getCategory(a.categoryId)?.name || '',
        'รหัสหน่วยงาน': a.departmentId || '',
        'หน่วยงาน': getDepartment(a.departmentId)?.name || '',
        'รหัสผู้ถือครอง': a.holderId || '',
        'ผู้ถือครอง': holderDisplayName(a),
        'วันที่จัดซื้อ': a.purchaseDate || '',
        'สถานะ': STATUS_LABELS[a.status]?.label || a.status,
        'สถานที่จัดเก็บ': a.location || '',
        'หมายเลขเครื่อง/SN': a.serial || '',
        'หมายเหตุ': a.note || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assetRows), 'ทรัพย์สิน');

      const asgRows = db.assignments.map((a) => ({
        'รหัสอ้างอิง': a.id,
        'รหัสทรัพย์สิน': a.assetId,
        'ทรัพย์สิน': getAsset(a.assetId)?.name || '',
        'รหัสบุคลากร': a.employeeId,
        'ผู้รับมอบ': getEmployee(a.employeeId)?.name || '',
        'รหัสหน่วยงาน': a.departmentId || '',
        'หน่วยงาน': getDepartment(a.departmentId)?.name || '',
        'วันที่มอบหมาย': a.dateOut || '',
        'วันที่คืน': a.dateReturn || '',
        'หมายเหตุ': a.note || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asgRows), 'การมอบหมาย');

      const mntRows = db.maintenance.map((m) => ({
        'รหัสอ้างอิง': m.id,
        'รหัสทรัพย์สิน': m.assetId,
        'ทรัพย์สิน': getAsset(m.assetId)?.name || '',
        'วันที่แจ้ง': m.date || '',
        'ประเภทงาน': m.type || '',
        'ผู้รับซ่อม': m.vendor || '',
        'รายละเอียด': m.description || '',
        'สถานะ': m.status === 'in_progress' ? 'กำลังดำเนินการ' : 'เสร็จสิ้น',
        'วันที่เสร็จสิ้น': m.completedDate || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mntRows), 'ซ่อมบำรุง');

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([
          { 'ชื่อองค์กร': db.orgName || '', 'ชื่อรอง': db.orgSub || '' },
        ]),
        'ข้อมูลองค์กร'
      );

      XLSX.writeFile(wb, `asset-management-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('ส่งออกไฟล์ Excel สำรองข้อมูลเรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดขณะส่งออกไฟล์', true);
    }
  };

  // Excel import
  const importFromExcel = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array', cellDates: true });

          const sheetToRows = (name: string) => {
            const ws = wb.Sheets[name];
            return ws ? XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' }) : [];
          };

          const catRows = sheetToRows('หมวดหมู่');
          const categories: Category[] = catRows
            .map((r) => ({
              id: String(r['รหัสอ้างอิง'] || uid('cat')),
              code: String(r['รหัสหมวดหมู่'] || '').toUpperCase(),
              name: String(r['ชื่อหมวดหมู่'] || ''),
              usefulLife: Number(r['อายุการใช้งาน(ปี)']) || 5,
            }))
            .filter((c) => c.name);

          const depRows = sheetToRows('หน่วยงาน');
          const departments: Department[] = depRows
            .map((r) => ({
              id: String(r['รหัสอ้างอิง'] || uid('dep')),
              name: String(r['ชื่อหน่วยงาน'] || ''),
            }))
            .filter((d) => d.name);

          const empRows = sheetToRows('บุคลากร');
          const employees: Employee[] = empRows
            .map((r, idx) => ({
              id: String(r['รหัสอ้างอิง'] || uid('emp')),
              name: String(r['ชื่อ-นามสกุล'] || ''),
              username: String(r['ชื่อผู้ใช้'] || `user_${idx + 1}`),
              role: (r['สิทธิ์'] === 'admin' || r['สิทธิ์'] === 'staff' ? r['สิทธิ์'] : 'user') as UserRole,
              position: String(r['ตำแหน่ง'] || ''),
              department: String(r['รหัสหน่วยงาน'] || ''),
              location: String(r['สถานที่'] || ''),
            }))
            .filter((e) => e.name);

          const statusReverse: Record<string, Asset['status']> = {
            พร้อมใช้: 'ready',
            เบิกใช้แล้ว: 'issued',
            ติดยืม: 'borrowed',
            ส่งซ่อม: 'repair',
            เสีย: 'broken',
            รออะไหล่: 'awaiting_parts',
          };

          const assetRows = sheetToRows('ทรัพย์สิน');
          const assets: Asset[] = assetRows
            .map((r) => ({
              id: String(r['รหัสอ้างอิง'] || uid('ast')),
              name: String(r['ชื่อทรัพย์สิน'] || ''),
              categoryId: String(r['รหัสหมวดหมู่'] || ''),
              departmentId: String(r['รหัสหน่วยงาน'] || ''),
              holderId: r['รหัสผู้ถือครอง'] ? String(r['รหัสผู้ถือครอง']) : null,
              holderName: r['ผู้ถือครอง'] ? String(r['ผู้ถือครอง']) : '',
              purchaseDate: normalizeDateForImport(r['วันที่จัดซื้อ']),
              cost: Number(r['ราคาทุน']) || 0,
              usefulLife: Number(r['อายุการใช้งาน(ปี)']) || 5,
              status: statusReverse[String(r['สถานะ'] || '').trim()] || 'ready',
              location: String(r['สถานที่จัดเก็บ'] || ''),
              serial: String(r['หมายเลขเครื่อง/SN'] || ''),
              note: String(r['หมายเหตุ'] || ''),
            }))
            .filter((a) => a.name);

          const asgRows = sheetToRows('การมอบหมาย');
          const assignments: Assignment[] = asgRows
            .map((r) => ({
              id: String(r['รหัสอ้างอิง'] || uid('asg')),
              assetId: String(r['รหัสทรัพย์สิน'] || ''),
              employeeId: String(r['รหัสบุคลากร'] || ''),
              departmentId: String(r['รหัสหน่วยงาน'] || ''),
              dateOut: normalizeDateForImport(r['วันที่มอบหมาย']),
              dateReturn: r['วันที่คืน'] ? normalizeDateForImport(r['วันที่คืน']) : null,
              note: String(r['หมายเหตุ'] || ''),
            }))
            .filter((a) => a.assetId);

          const mntRows = sheetToRows('ซ่อมบำรุง');
          const maintenance: MaintenanceRecord[] = mntRows
            .map((r) => ({
              id: String(r['รหัสอ้างอิง'] || uid('mnt')),
              assetId: String(r['รหัสทรัพย์สิน'] || ''),
              date: normalizeDateForImport(r['วันที่แจ้ง']),
              type: String(r['ประเภทงาน'] || ''),
              vendor: String(r['ผู้รับซ่อม'] || ''),
              description: String(r['รายละเอียด'] || ''),
              status: String(r['สถานะ'] || '').trim() === 'เสร็จสิ้น' ? ('done' as const) : ('in_progress' as const),
              completedDate: r['วันที่เสร็จสิ้น'] ? normalizeDateForImport(r['วันที่เสร็จสิ้น']) : null,
            }))
            .filter((m) => m.assetId);

          const orgRows = sheetToRows('ข้อมูลองค์กร');
          const orgName = (orgRows[0] && orgRows[0]['ชื่อองค์กร']) || db.orgName;
          const orgSub = (orgRows[0] && orgRows[0]['ชื่อรอง']) || db.orgSub;

          if (!categories.length && !assets.length && !departments.length) {
            showToast('ไฟล์ไม่มีข้อมูลที่ถูกต้อง', true);
            resolve(false);
            return;
          }

          const importedDb: Database = {
            orgName,
            orgSub,
            adminPin: db.adminPin || '1234',
            categories,
            departments,
            employees,
            assets,
            assignments,
            maintenance,
            seq: {},
          };

          saveDatabase(importedDb);
          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importedDb),
          }).catch((err) => console.warn('D1 sync error:', err));
          showToast('นำเข้าข้อมูลจากไฟล์ Excel เรียบร้อยแล้ว');
          resolve(true);
        } catch (err) {
          console.error(err);
          showToast('ไฟล์ไม่ถูกต้อง ไม่สามารถนำเข้าข้อมูลได้', true);
          resolve(false);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const resetDatabase = () => {
    saveDatabase(emptyDatabase);
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emptyDatabase),
    }).catch((err) => console.warn('D1 sync error:', err));
    showToast('รีเซ็ตระบบและล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
  };

  const downloadExcelTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      const catRows = [
        { 'รหัสหมวดหมู่': 'IT', 'ชื่อหมวดหมู่': 'คอมพิวเตอร์และอุปกรณ์ไอที' },
        { 'รหัสหมวดหมู่': 'OF', 'ชื่อหมวดหมู่': 'ครุภัณฑ์สำนักงาน' },
        { 'รหัสหมวดหมู่': 'FN', 'ชื่อหมวดหมู่': 'เฟอร์นิเจอร์' },
        { 'รหัสหมวดหมู่': 'VH', 'ชื่อหมวดหมู่': 'ยานพาหนะ' },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'หมวดหมู่');

      const depRows = [
        { 'ชื่อหน่วยงาน': 'ฝ่ายเทคโนโลยีสารสนเทศ' },
        { 'ชื่อหน่วยงาน': 'ฝ่ายบริหารงานทั่วไป' },
        { 'ชื่อหน่วยงาน': 'ฝ่ายการเงินและบัญชี' },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depRows), 'หน่วยงาน');

      const empRows = [
        { 'ชื่อ-นามสกุล': 'นายสมชาย ใจดี', 'หน่วยงาน': 'ฝ่ายเทคโนโลยีสารสนเทศ', 'สถานที่': 'อาคาร 1 ชั้น 2' },
        { 'ชื่อ-นามสกุล': 'นางสาววิภาดา รักษ์งาน', 'หน่วยงาน': 'ฝ่ายการเงินและบัญชี', 'สถานที่': 'อาคาร 1 ชั้น 3' },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows), 'บุคลากร');

      const assetRows = [
        {
          'ชื่อทรัพย์สิน': 'คอมพิวเตอร์ตั้งโต๊ะ All-in-One',
          'รหัสหมวดหมู่': 'IT',
          'หน่วยงาน': 'ฝ่ายเทคโนโลยีสารสนเทศ',
          'ผู้ถือครอง': 'นายสมชาย ใจดี',
          'วันที่จัดซื้อ': '2025-01-15',
          'สถานะ': 'พร้อมใช้',
          'สถานที่จัดเก็บ': 'ห้อง IT ชั้น 2',
          'หมายเลขเครื่อง/SN': 'PC-2025-001',
          'หมายเหตุ': '',
        },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assetRows), 'ทรัพย์สิน');

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([{ 'ชื่อองค์กร': db.orgName || 'องค์กรของคุณ', 'ชื่อรอง': db.orgSub || '' }]),
        'ข้อมูลองค์กร'
      );

      XLSX.writeFile(wb, 'asset-management-template.xlsx');
      showToast('ดาวน์โหลดไฟล์แม่แบบ Excel เรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการสร้างไฟล์แม่แบบ', true);
    }
  };

  return (
    <AppContext.Provider
      value={{
        db,
        isLoaded,
        currentUser,
        login,
        logout,
        changeUserPassword,
        toasts,
        showToast,
        removeToast,
        confirmDialog,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        settingsUnlocked,
        setSettingsUnlocked,
        getCategory,
        getDepartment,
        getEmployee,
        getAsset,
        holderDisplayName,
        addAsset,
        updateAsset,
        deleteAsset,
        addCategory,
        updateCategory,
        deleteCategory,
        addDepartment,
        deleteDepartment,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addAssignment,
        returnAssignment,
        addMaintenance,
        completeMaintenance,
        updateOrgInfo,
        changeAdminPin,
        resetDatabase,
        exportToExcel,
        importFromExcel,
        downloadExcelTemplate,
        isD1Connected,
        syncWithD1,
      }}
    >
      {children}

      {/* Global Custom Confirmation Dialog */}
      <CustomDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />

      {/* Global Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => {
          const type = t.type || (t.isErr ? 'error' : 'success');
          return (
            <div key={t.id} className={`toast-card toast-${type}`}>
              <div className="toast-icon">
                {type === 'success' && <Icons.checkCircle size={20} />}
                {type === 'error' && <Icons.xCircle size={20} />}
                {type === 'warning' && <Icons.alertTriangle size={20} />}
                {type === 'info' && <Icons.shield size={20} />}
              </div>
              <div className="toast-content">
                {t.title && <div className="toast-title">{t.title}</div>}
                <div className="toast-text">{t.text}</div>
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
              >
                <Icons.x size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
