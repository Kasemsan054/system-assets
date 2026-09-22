// functions/api/maintenance/[id].js — Maintenance item (GET, PUT, DELETE)

import { json, ok, notFound } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, buildUpdate } from '../../_lib/validate.js';
import { sanitizeMaintenanceFields } from '../../_lib/models.js';

async function load(env, id) {
    return env.DB.prepare('SELECT * FROM Maintenance WHERE id = ?').bind(id).first();
}

export async function onRequestGet(context) {
    const { env, params } = context;
    await requireAuth(context);

    const item = await load(env, params.id);
    if (!item) return notFound(`ไม่พบข้อมูลการซ่อมบำรุงรหัส '${params.id}'`);
    return json(item);
}

export async function onRequestPut(context) {
    const { env, request, params } = context;
    const user = await requirePermission(context, 'maintenance', 'ตำแหน่งของคุณไม่มีสิทธิ์แก้ไขงานซ่อมบำรุง');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลการซ่อมบำรุงรหัส '${params.id}'`);

    const fields = sanitizeMaintenanceFields(await readJson(request));
    const q = buildUpdate('Maintenance', fields, params.id);
    if (!q) return ok({ message: 'ไม่มีข้อมูลให้อัปเดต', updated: [] });

    await env.DB.prepare(q.sql).bind(...q.values).run();
    console.log(`[maintenance/[id]:PUT] '${user.username}' updated ${params.id} (${Object.keys(fields).join(', ')})`);
    return ok({ updated: Object.keys(fields) });
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const user = await requirePermission(context, 'maintenance', 'ตำแหน่งของคุณไม่มีสิทธิ์ลบงานซ่อมบำรุง');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลการซ่อมบำรุงรหัส '${params.id}'`);

    await env.DB.prepare('DELETE FROM Maintenance WHERE id = ?').bind(params.id).run();
    console.log(`[maintenance/[id]:DELETE] '${user.username}' deleted ${params.id}`);
    return ok();
}
