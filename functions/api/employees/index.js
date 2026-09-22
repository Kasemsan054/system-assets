// functions/api/employees/index.js — Employee list (GET) and create/upsert (POST)
// Write access: admin or the 'settings' permission.

import { json, ok, conflict } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, parsePagination, str, likeEscape, buildInsert, buildUpdate } from '../../_lib/validate.js';
import { sanitizeEmployeeFields } from '../../_lib/models.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url, { defaultLimit: 10, maxLimit: 1000 });

    const where = [];
    const params = [];
    const departmentId = url.searchParams.get('departmentId');
    const q = url.searchParams.get('q')?.trim();

    if (departmentId) { where.push('e.departmentId = ?'); params.push(departmentId); }
    if (q) {
        const like = `%${likeEscape(q.slice(0, 100))}%`;
        where.push(`(e.name LIKE ? ESCAPE '\\' OR e.id LIKE ? ESCAPE '\\')`);
        params.push(like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`
            SELECT e.*, COUNT(a.id) AS assetCount
            FROM Employees e
            LEFT JOIN Assets a ON a.holderId = e.id
            ${whereSql}
            GROUP BY e.id
            ORDER BY e.name ASC
            LIMIT ? OFFSET ?
        `).bind(...params, limit, offset),
        env.DB.prepare(`SELECT COUNT(*) AS total FROM Employees e ${whereSql}`).bind(...params),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requirePermission(context, 'settings', 'ตำแหน่งของคุณไม่มีสิทธิ์เพิ่มหรือแก้ไขข้อมูลบุคลากร');

    const data = await readJson(request);
    const id = str(data.id, { max: 100, required: true, label: 'รหัสพนักงาน (id)' });
    if (data.name === undefined) data.name = '';
    const fields = sanitizeEmployeeFields(data);

    // Guard against a duplicate employee ID silently overwriting an existing record.
    // Pass ?upsert=true (or { upsert: true }) to update on purpose.
    const isUpsert = new URL(request.url).searchParams.get('upsert') === 'true' || Boolean(data.upsert);
    const existing = await env.DB.prepare('SELECT id FROM Employees WHERE LOWER(id) = LOWER(?)').bind(id).first();

    if (existing) {
        if (!isUpsert) {
            console.warn(`[employees:POST] Duplicate employee ID rejected: '${id}'`);
            return conflict(`รหัสพนักงาน '${id}' มีอยู่ในระบบแล้ว หากต้องการอัปเดตให้ใช้ ?upsert=true`);
        }
        const q = buildUpdate('Employees', fields, existing.id);
        if (q) await env.DB.prepare(q.sql).bind(...q.values).run();
        console.log(`[employees:POST] '${user.username}' updated employee '${fields.name || existing.id}' (${existing.id})`);
        return ok({ data: { id: existing.id, ...fields }, updated: true });
    }

    const row = { id, ...fields };
    const ins = buildInsert('Employees', row);
    await env.DB.prepare(ins.sql).bind(...ins.values).run();

    console.log(`[employees:POST] '${user.username}' created employee '${row.name}' (${id})`);
    return ok({ data: row });
}
