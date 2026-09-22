// functions/api/maintenance/index.js — Maintenance list (GET) and create (POST)

import { json, ok, notFound } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, parsePagination, str, newId, buildInsert } from '../../_lib/validate.js';
import { MAINTENANCE_STATUSES, sanitizeMaintenanceFields } from '../../_lib/models.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url, { defaultLimit: 200, maxLimit: 500 });

    const where = [];
    const params = [];
    const assetId = url.searchParams.get('assetId');
    const status = url.searchParams.get('status');

    if (assetId) { where.push('assetId = ?'); params.push(assetId); }
    if (status && MAINTENANCE_STATUSES.includes(status)) { where.push('status = ?'); params.push(status); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`SELECT * FROM Maintenance ${whereSql} ORDER BY rowid DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset),
        env.DB.prepare(`SELECT COUNT(*) AS total FROM Maintenance ${whereSql}`).bind(...params),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requirePermission(context, 'maintenance', 'ตำแหน่งของคุณไม่มีสิทธิ์บันทึกงานซ่อมบำรุง');

    const data = await readJson(request);
    if (data.assetId === undefined) data.assetId = '';
    if (data.type === undefined) data.type = '';
    const fields = sanitizeMaintenanceFields(data);

    const asset = await env.DB.prepare('SELECT id FROM Assets WHERE id = ?').bind(fields.assetId).first();
    if (!asset) return notFound(`ไม่พบทรัพย์สินรหัส '${fields.assetId}' ในระบบ`);

    const row = { id: str(data.id, { max: 100 }) || newId('mnt'), status: 'in_progress', ...fields };
    const ins = buildInsert('Maintenance', row, { orReplace: true });
    await env.DB.prepare(ins.sql).bind(...ins.values).run();

    console.log(`[maintenance:POST] '${user.username}' logged '${row.type}' for asset ${row.assetId}`);
    return ok({ data: row });
}
