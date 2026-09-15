export type AssetStatus = 'ready' | 'issued' | 'borrowed' | 'repair' | 'broken' | 'awaiting_parts';

export type UserRole = 'admin' | 'staff' | 'user';

export interface Category {
  id: string;
  code: string;
  name: string;
  usefulLife?: number;
  salvagePct?: number;
}

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  username: string;
  password?: string;
  mustChangePassword?: boolean;
  role: UserRole;
  position?: string;
  department?: string;
  departmentId?: string;
  location?: string;
}

export interface DialogOptions {
  title: string;
  message: string;
  type?: 'confirm' | 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
}

export const ROLE_LABELS: Record<UserRole, { label: string; badgeCls: string }> = {
  admin: { label: 'ผู้ดูแลระบบ', badgeCls: 'role-admin' },
  staff: { label: 'เจ้าหน้าที่พัสดุ', badgeCls: 'role-staff' },
  user: { label: 'ผู้ใช้ทั่วไป', badgeCls: 'role-user' },
};

export interface Asset {
  id: string;
  name: string;
  categoryId: string;
  departmentId?: string;
  holderId?: string | null;
  holderName?: string;
  purchaseDate: string;
  returnDate?: string | null;
  cost: number;
  usefulLife?: number;
  salvagePct?: number;
  status: AssetStatus;
  location: string;
  vendor?: string;
  serial?: string;
  note?: string;
}

export interface Assignment {
  id: string;
  assetId: string;
  employeeId: string;
  departmentId?: string;
  dateOut: string;
  dateReturn?: string | null;
  note?: string;
}

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  date: string;
  type: string;
  vendor?: string;
  description?: string;
  status: 'in_progress' | 'done';
  completedDate?: string | null;
}

export interface Database {
  orgName: string;
  orgSub: string;
  adminPin: string;
  categories: Category[];
  departments: Department[];
  employees: Employee[];
  assets: Asset[];
  assignments: Assignment[];
  maintenance: MaintenanceRecord[];
  seq: Record<string, number>;
}

export const STATUS_LABELS: Record<AssetStatus, { label: string; cls: string; color: string }> = {
  ready: { label: 'พร้อมใช้', cls: 'tag-active', color: '#1f6d45' },
  issued: { label: 'เบิกใช้แล้ว', cls: 'tag-idle', color: '#1f5f9a' },
  borrowed: { label: 'ติดยืม', cls: 'tag-borrowed', color: '#6b3fa0' },
  repair: { label: 'ส่งซ่อม', cls: 'tag-maintenance', color: '#9a6c14' },
  broken: { label: 'เสีย', cls: 'tag-lost', color: '#a3352e' },
  awaiting_parts: { label: 'รออะไหล่', cls: 'tag-disposed', color: '#8590a0' },
};
