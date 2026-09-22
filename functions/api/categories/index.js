// functions/api/categories/index.js — Category list (GET) and create/upsert (POST)
// Write access: admin or the 'categories' permission (matches the UI's canEdit('categories')).

import { json, ok } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, parsePagination, str, buildInsert } from '../../_lib/validate.js';
import { sanitizeCategoryFields } from '../../_lib/models.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const { page, limit, offset } = parsePagination(new URL(request.url), { defaultLimit: 10, maxLimit: 1000 });

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`
            SELECT c.*, COUNT(a.id) AS assetCount
            FROM Categories c
            LEFT JOIN Assets a ON a.categoryId = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
            LIMIT ? OFFSET ?
        `).bind(limit, offset),
        env.DB.prepare('SELECT COUNT(*) AS total FROM Categories'),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requirePermission(context, 'categories', 'ตำแหน่งของคุณไม่มีสิทธิ์เพิ่มหรือแก้ไขหมวดหมู่ทรัพย์สิน');

    const data = await readJson(request);
    if (data.name === undefined) data.name = '';
    if (data.code === undefined) data.code = '';
    const fields = sanitizeCategoryFields(data);
    if (fields.usefulLife === undefined) fields.usefulLife = 5;
    if (fields.salvagePct === undefined) fields.salvagePct = 5;

    const codeSlug = fields.code.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const id = str(data.id, { max: 100 }) || ('cat_' + (codeSlug || Date.now().toString(36)));
    const row = { id, ...fields };
    const ins = buildInsert('Categories', row, { orReplace: true });
    await env.DB.prepare(ins.sql).bind(...ins.values).run();

    console.log(`[categories:POST] '${user.username}' upserted category '${row.name}' (${row.code})`);
    return ok({ data: row });
}
