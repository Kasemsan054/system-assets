// functions/api/departments/[id].js — Department item (GET, PUT, DELETE)

import { json, ok, notFound } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, buildUpdate } from '../../_lib/validate.js';
import { sanitizeDepartmentFields } from '../../_lib/models.js';

async function load(env, id) {
    return env.DB.prepare('SELECT * FROM Departments WHERE id = ?').bind(id).first();
}

export async function onRequestGet(context) {
    const { env, params } = context;
    await requireAuth(context);

    const item = await load(env, params.id);
    if (!item) return notFound(`ไม่พบข้อมูลแผนกรหัส '${params.id}'`);
    return json(item);
}

export async function onRequestPut(context) {
    const { env, request, params } = context;
    const user = await requirePermission(context, 'settings', 'ตำแหน่งของคุณไม่มีสิทธิ์แก้ไขแผนก');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลแผนกรหัส '${params.id}'`);

    const fields = sanitizeDepartmentFields(await readJson(request));
    const q = buildUpdate('Departments', fields, params.id);
    if (!q) return ok({ message: 'ไม่มีข้อมูลให้อัปเดต', updated: [] });

    await env.DB.prepare(q.sql).bind(...q.values).run();
    console.log(`[departments/[id]:PUT] '${user.username}' updated ${params.id}`);
    return ok({ updated: Object.keys(fields) });
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const user = await requirePermission(context, 'settings', 'ตำแหน่งของคุณไม่มีสิทธิ์ลบแผนก');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลแผนกรหัส '${params.id}'`);

    // Delete and detach references atomically
    await env.DB.batch([
        env.DB.prepare('UPDATE Assets SET departmentId = NULL WHERE departmentId = ?').bind(params.id),
        env.DB.prepare('UPDATE Employees SET departmentId = NULL WHERE departmentId = ?').bind(params.id),
        env.DB.prepare('UPDATE Users SET departmentId = NULL WHERE departmentId = ?').bind(params.id),
        env.DB.prepare('DELETE FROM Departments WHERE id = ?').bind(params.id),
    ]);

    console.log(`[departments/[id]:DELETE] '${user.username}' deleted ${params.id} and cleared references`);
    return ok();
}
