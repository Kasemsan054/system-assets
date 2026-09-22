// functions/api/import/index.js — Bulk import (Excel restore) in ordered D1 batches
//
//  POST /api/import  { departments[], employees[], categories[], assets[], assignments[], maintenance[], orgName?, orgSub? }
//
// Replaces the old "one HTTP request per row" import: rows are validated up front, then
// written in dependency order (departments → employees → categories → assets → assignments
// → maintenance) using env.DB.batch(), 50 statements per batch. Admin only.

import { ok, badRequest, HttpError } from '../../_lib/response.js';
import { requireAdmin } from '../../_lib/auth.js';
import { readJson, str, newId, buildInsert } from '../../_lib/validate.js';
import {
    sanitizeDepartmentFields, sanitizeEmployeeFields, sanitizeCategoryFields,
    sanitizeAssetFields, sanitizeAssignmentFields, sanitizeMaintenanceFields,
} from '../../_lib/models.js';

const BATCH_SIZE = 50;
const MAX_ROWS_PER_SECTION = 5000;

function listOf(data, key) {
    const v = data[key];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) throw new HttpError(400, `ข้อมูล '${key}' ต้องเป็น array`);
    if (v.length > MAX_ROWS_PER_SECTION) throw new HttpError(400, `ข้อมูล '${key}' มีมากกว่า ${MAX_ROWS_PER_SECTION} แถว กรุณาแบ่งไฟล์`);
    return v;
}

/** Validate every row of a section; collect errors with row numbers instead of failing on the first one. */
function prepareSection(rows, key, mapRow, errors) {
    const out = [];
    rows.forEach((raw, i) => {
        try {
            if (!raw || typeof raw !== 'object') throw new HttpError(400, 'แถวไม่ใช่ object');
            out.push(mapRow(raw));
        } catch (e) {
            errors.push({ section: key, row: i + 1, error: e.message });
        }
    });
    return out;
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requireAdmin(context, 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถนำเข้าข้อมูลแบบกลุ่มได้');

    const data = await readJson(request, { maxBytes: 20_000_000 });
    const errors = [];

    const departments = prepareSection(listOf(data, 'departments'), 'departments', r => ({
        table: 'Departments',
        row: { id: str(r.id, { max: 100 }) || newId('dept'), ...sanitizeDepartmentFields({ name: r.name ?? '' }) },
    }), errors);

    const employees = prepareSection(listOf(data, 'employees'), 'employees', r => ({
        table: 'Employees',
        row: { id: str(r.id, { max: 100, required: true, label: 'รหัสพนักงาน (id)' }), ...sanitizeEmployeeFields({ name: '', ...r }) },
    }), errors);

    const categories = prepareSection(listOf(data, 'categories'), 'categories', r => {
        const fields = sanitizeCategoryFields({ name: '', code: '', ...r });
        if (fields.usefulLife === undefined) fields.usefulLife = 5;
        if (fields.salvagePct === undefined) fields.salvagePct = 5;
        const slug = fields.code.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        return { table: 'Categories', row: { id: str(r.id, { max: 100 }) || ('cat_' + (slug || newId('c'))), ...fields } };
    }, errors);

    const assets = prepareSection(listOf(data, 'assets'), 'assets', r => {
        const sn = str(r.id || r.sn || r.serial, { max: 100, required: true, label: 'หมายเลขทรัพย์สิน/S/N' });
        const fields = sanitizeAssetFields({ name: '', ...r });
        if (!fields.serial) fields.serial = sn;
        if (!fields.status) fields.status = 'ready';
        return { table: 'Assets', row: { id: sn, ...fields } };
    }, errors);

    const assignments = prepareSection(listOf(data, 'assignments'), 'assignments', r => ({
        table: 'Assignments',
        row: { id: str(r.id, { max: 100 }) || newId('asg'), ...sanitizeAssignmentFields({ assetId: '', ...r }) },
    }), errors);

    // Auto-generate assignment for any imported asset with a holder that lacks an assignment record
    const asgAssetIds = new Set(assignments.map(a => a.row.assetId));
    assets.forEach(({ row: a }) => {
        if ((a.holderId || a.holderName) && !asgAssetIds.has(a.id)) {
            const hId = (a.holderId && String(a.holderId).trim()) || null;
            const hName = hId ? null : ((a.holderName && String(a.holderName).trim()) || null);
            const dateOut = a.purchaseDate || new Date().toISOString().slice(0, 10);
            const note = a.status === 'borrowed' ? 'ยืมใช้งาน' : 'เบิกใช้งาน';
            assignments.push({
                table: 'Assignments',
                row: {
                    id: newId('asg'),
                    assetId: a.id,
                    employeeId: hId,
                    departmentId: a.departmentId || null,
                    holderName: hName,
                    dateOut,
                    dateReturn: null,
                    note,
                }
            });
            asgAssetIds.add(a.id);
        }
    });

    const maintenance = prepareSection(listOf(data, 'maintenance'), 'maintenance', r => {
        const fields = sanitizeMaintenanceFields({ assetId: '', type: '', ...r });
        if (!fields.status) fields.status = 'in_progress';
        return { table: 'Maintenance', row: { id: str(r.id, { max: 100 }) || newId('mnt'), ...fields } };
    }, errors);

    if (errors.length) {
        return badRequest(`พบข้อมูลไม่ถูกต้อง ${errors.length} แถว — ไม่ได้นำเข้าข้อมูลใดๆ`, { errors: errors.slice(0, 50) });
    }

    // Dependency order matters: assignments/maintenance reference assets, assets reference categories, etc.
    const ordered = [...departments, ...employees, ...categories, ...assets, ...assignments, ...maintenance];

    const settingsStmts = [];
    if (data.orgName !== undefined) settingsStmts.push(['orgName', str(data.orgName, { max: 500 })]);
    if (data.orgSub !== undefined) settingsStmts.push(['orgSub', str(data.orgSub, { max: 500 })]);

    const statements = ordered.map(({ table, row }) => {
        const ins = buildInsert(table, row, { orReplace: true });
        return env.DB.prepare(ins.sql).bind(...ins.values);
    });
    for (const [k, v] of settingsStmts) {
        statements.push(env.DB.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(k, v));
    }

    if (statements.length === 0) return badRequest('ไม่มีข้อมูลสำหรับนำเข้า');

    let written = 0;
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
        const chunk = statements.slice(i, i + BATCH_SIZE);
        await env.DB.batch(chunk);
        written += chunk.length;
    }

    const summary = {
        departments: departments.length,
        employees: employees.length,
        categories: categories.length,
        assets: assets.length,
        assignments: assignments.length,
        maintenance: maintenance.length,
    };
    console.log(`[import:POST] '${user.username}' imported ${written} rows:`, JSON.stringify(summary));
    return ok({ written, summary });
}
