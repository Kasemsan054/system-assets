// functions/api/categories/[id].js — Category item (GET, PUT, DELETE)

import { json, ok, notFound, badRequest } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, buildUpdate } from '../../_lib/validate.js';
import { sanitizeCategoryFields } from '../../_lib/models.js';

async function load(env, id) {
    return env.DB.prepare(`
        SELECT c.*, COUNT(a.id) AS assetCount
        FROM Categories c
        LEFT JOIN Assets a ON a.categoryId = c.id
        WHERE c.id = ?
        GROUP BY c.id
    `).bind(id).first();
}

export async function onRequestGet(context) {
    const { env, params } = context;
    await requireAuth(context);

    const item = await load(env, params.id);
    if (!item) return notFound(`ไม่พบหมวดหมู่รหัส '${params.id}'`);
    return json(item);
}

export async function onRequestPut(context) {
    const { env, request, params } = context;
    const user = await requirePermission(context, 'categories', 'ตำแหน่งของคุณไม่มีสิทธิ์แก้ไขหมวดหมู่ทรัพย์สิน');

    if (!(await load(env, params.id))) return notFound(`ไม่พบหมวดหมู่รหัส '${params.id}'`);

    const fields = sanitizeCategoryFields(await readJson(request));
    const q = buildUpdate('Categories', fields, params.id);
    if (!q) return ok({ message: 'ไม่มีข้อมูลให้อัปเดต', updated: [] });

    await env.DB.prepare(q.sql).bind(...q.values).run();
    console.log(`[categories/[id]:PUT] '${user.username}' updated ${params.id} (${Object.keys(fields).join(', ')})`);
    return ok({ updated: Object.keys(fields) });
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const user = await requirePermission(context, 'categories', 'ตำแหน่งของคุณไม่มีสิทธิ์ลบหมวดหมู่ทรัพย์สิน');

    if (!(await load(env, params.id))) return notFound(`ไม่พบหมวดหมู่รหัส '${params.id}'`);

    const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM Assets WHERE categoryId = ?').bind(params.id).first();
    if (count > 0) return badRequest(`ไม่สามารถลบได้ เนื่องจากมีทรัพย์สิน ${count} รายการอยู่ในหมวดหมู่นี้`);

    await env.DB.prepare('DELETE FROM Categories WHERE id = ?').bind(params.id).run();
    console.log(`[categories/[id]:DELETE] '${user.username}' deleted ${params.id}`);
    return ok();
}
