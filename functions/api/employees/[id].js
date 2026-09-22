// functions/api/employees/[id].js — Employee item (GET, PUT, DELETE)

import { json, ok, notFound } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, buildUpdate } from '../../_lib/validate.js';
import { sanitizeEmployeeFields } from '../../_lib/models.js';

async function load(env, id) {
    return env.DB.prepare('SELECT * FROM Employees WHERE id = ?').bind(id).first();
}

export async function onRequestGet(context) {
    const { env, params } = context;
    await requireAuth(context);

    const item = await load(env, params.id);
    if (!item) return notFound(`ไม่พบข้อมูลบุคลากรรหัส '${params.id}'`);
    return json(item);
}

export async function onRequestPut(context) {
    const { env, request, params } = context;
    const user = await requirePermission(context, 'settings', 'ตำแหน่งของคุณไม่มีสิทธิ์แก้ไขข้อมูลบุคลากร');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลบุคลากรรหัส '${params.id}'`);

    const fields = sanitizeEmployeeFields(await readJson(request));
    const q = buildUpdate('Employees', fields, params.id);
    if (!q) return ok({ message: 'ไม่มีข้อมูลให้อัปเดต', updated: [] });

    await env.DB.prepare(q.sql).bind(...q.values).run();
    console.log(`[employees/[id]:PUT] '${user.username}' updated ${params.id} (${Object.keys(fields).join(', ')})`);
    return ok({ updated: Object.keys(fields) });
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const user = await requirePermission(context, 'settings', 'ตำแหน่งของคุณไม่มีสิทธิ์ลบข้อมูลบุคลากร');

    if (!(await load(env, params.id))) return notFound(`ไม่พบข้อมูลบุคลากรรหัส '${params.id}'`);

    await env.DB.batch([
        env.DB.prepare('UPDATE Assets SET holderId = NULL, holderName = NULL WHERE holderId = ?').bind(params.id),
        env.DB.prepare('DELETE FROM Employees WHERE id = ?').bind(params.id),
    ]);

    console.log(`[employees/[id]:DELETE] '${user.username}' deleted ${params.id} and cleared asset holders`);
    return ok();
}
