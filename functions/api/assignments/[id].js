// functions/api/assignments/[id].js — Assignment item (GET, PUT, DELETE)

import { json, ok, notFound } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, buildUpdate } from '../../_lib/validate.js';
import { sanitizeAssignmentFields } from '../../_lib/models.js';

async function load(env, id) {
    return env.DB.prepare('SELECT * FROM Assignments WHERE id = ?').bind(id).first();
}

export async function onRequestGet(context) {
    const { env, params } = context;
    await requireAuth(context);

    const item = await load(env, params.id);
    if (!item) return notFound(`ไม่พบข้อมูลการมอบหมายรหัส '${params.id}'`);
    return json(item);
}

export async function onRequestPut(context) {
    const { env, request, params } = context;
    const user = await requirePermission(context, 'assignments', 'ตำแหน่งของคุณไม่มีสิทธิ์แก้ไขการมอบหมายทรัพย์สิน');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลการมอบหมายรหัส '${params.id}'`);

    const fields = sanitizeAssignmentFields(await readJson(request));
    const q = buildUpdate('Assignments', fields, params.id);
    if (!q) return ok({ message: 'ไม่มีข้อมูลให้อัปเดต', updated: [] });

    await env.DB.prepare(q.sql).bind(...q.values).run();
    console.log(`[assignments/[id]:PUT] '${user.username}' updated ${params.id} (${Object.keys(fields).join(', ')})`);
    return ok({ updated: Object.keys(fields) });
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const user = await requirePermission(context, 'assignments', 'ตำแหน่งของคุณไม่มีสิทธิ์ลบข้อมูลการมอบหมาย');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลการมอบหมายรหัส '${params.id}'`);

    await env.DB.prepare('DELETE FROM Assignments WHERE id = ?').bind(params.id).run();
    console.log(`[assignments/[id]:DELETE] '${user.username}' deleted ${params.id}`);
    return ok();
}
