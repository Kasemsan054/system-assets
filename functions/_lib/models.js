// functions/_lib/models.js — per-entity field validation shared by list and item routes.
// Each sanitize*() takes the raw client payload and returns only allow-listed, validated columns.

import { str, num, dateStr, oneOf } from './validate.js';

export const ASSET_STATUSES = ['ready', 'issued', 'borrowed', 'repair', 'broken', 'awaiting_parts', 'assigned', 'maintenance', 'retired', 'lost'];
export const MAINTENANCE_STATUSES = ['in_progress', 'done', 'completed', 'cancelled', 'pending'];

export function sanitizeAssetFields(data) {
    const out = {};
    if (data.name !== undefined) out.name = str(data.name, { max: 300, required: true, label: 'ชื่อทรัพย์สิน (name)' });
    for (const k of ['categoryId', 'departmentId', 'holderId']) {
        if (data[k] !== undefined) out[k] = str(data[k], { max: 100 }) || null;
    }
    for (const k of ['holderName', 'location', 'vendor', 'serial']) {
        if (data[k] !== undefined) out[k] = str(data[k], { max: 300 });
    }
    if (data.note !== undefined) out.note = str(data.note, { max: 2000 });
    if (data.purchaseDate !== undefined) out.purchaseDate = dateStr(data.purchaseDate, { label: 'วันที่จัดซื้อ' });
    if (data.returnDate !== undefined) out.returnDate = dateStr(data.returnDate, { label: 'วันที่คืน' });
    if (data.cost !== undefined) out.cost = num(data.cost, { label: 'ราคาทรัพย์สิน (cost)', max: 1e12 });
    if (data.usefulLife !== undefined) out.usefulLife = num(data.usefulLife, { label: 'อายุการใช้งาน (usefulLife)', max: 100 });
    if (data.salvagePct !== undefined) out.salvagePct = num(data.salvagePct, { label: 'ร้อยละมูลค่าซาก (salvagePct)', max: 100 });
    if (data.status !== undefined && data.status !== '') out.status = oneOf(data.status, ASSET_STATUSES, { label: 'สถานะทรัพย์สิน' });
    return out;
}

export function sanitizeAssignmentFields(data) {
    const out = {};
    if (data.assetId !== undefined) out.assetId = str(data.assetId, { max: 100, required: true, label: 'รหัสทรัพย์สิน (assetId)' });
    for (const k of ['employeeId', 'departmentId']) {
        if (data[k] !== undefined) out[k] = str(data[k], { max: 100 }) || null;
    }
    // Free-text holder (customer / external person without a staff record).
    if (data.holderName !== undefined) out.holderName = str(data.holderName, { max: 300 });
    if (data.dateOut !== undefined) out.dateOut = dateStr(data.dateOut, { label: 'วันที่มอบหมาย' });
    if (data.dateReturn !== undefined) out.dateReturn = dateStr(data.dateReturn, { label: 'วันที่คืน' });
    if (data.note !== undefined) out.note = str(data.note, { max: 2000 });
    return out;
}

export function sanitizeMaintenanceFields(data) {
    const out = {};
    if (data.assetId !== undefined) out.assetId = str(data.assetId, { max: 100, required: true, label: 'รหัสทรัพย์สิน (assetId)' });
    if (data.type !== undefined) out.type = str(data.type, { max: 200, required: true, label: 'ประเภทการซ่อมบำรุง (type)' });
    if (data.vendor !== undefined) out.vendor = str(data.vendor, { max: 300 });
    if (data.description !== undefined) out.description = str(data.description, { max: 2000 });
    if (data.date !== undefined) out.date = dateStr(data.date, { label: 'วันที่แจ้งซ่อม' });
    if (data.completedDate !== undefined) out.completedDate = dateStr(data.completedDate, { label: 'วันที่เสร็จสิ้น' });
    if (data.cost !== undefined) out.cost = num(data.cost, { label: 'ค่าใช้จ่าย (cost)', max: 1e12 });
    if (data.status !== undefined && data.status !== '') out.status = oneOf(data.status, MAINTENANCE_STATUSES, { label: 'สถานะ' });
    return out;
}

export function sanitizeCategoryFields(data) {
    const out = {};
    if (data.name !== undefined) out.name = str(data.name, { max: 200, required: true, label: 'ชื่อหมวดหมู่ทรัพย์สิน (name)' });
    if (data.code !== undefined) out.code = str(data.code, { max: 20, required: true, label: 'รหัสหมวดหมู่ (code)' }).toUpperCase();
    if (data.usefulLife !== undefined) out.usefulLife = num(data.usefulLife, { label: 'อายุการใช้งาน (usefulLife)', max: 100 }) ?? 5;
    if (data.salvagePct !== undefined) out.salvagePct = num(data.salvagePct, { label: 'ร้อยละมูลค่าซาก (salvagePct)', max: 100 }) ?? 5;
    return out;
}

export function sanitizeDepartmentFields(data) {
    const out = {};
    if (data.name !== undefined) out.name = str(data.name, { max: 200, required: true, label: 'ชื่อแผนก (name)' });
    return out;
}

export function sanitizeEmployeeFields(data) {
    // `department` and `position`/`location` are accepted as aliases (legacy Excel import shape).
    const src = { ...data };
    if (src.department && !src.departmentId) src.departmentId = src.department;
    if (src.position && !src.location) src.location = src.position;
    else if (src.location && !src.position) src.position = src.location;

    const out = {};
    if (src.name !== undefined) out.name = str(src.name, { max: 200, required: true, label: 'ชื่อ-นามสกุลบุคลากร (name)' });
    if (src.departmentId !== undefined) out.departmentId = str(src.departmentId, { max: 100 }) || null;
    if (src.position !== undefined) out.position = str(src.position, { max: 200 });
    if (src.location !== undefined) out.location = str(src.location, { max: 200 });
    return out;
}
