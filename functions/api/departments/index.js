// functions/api/departments/index.js — Department list (GET) and create/upsert (POST)
// Write access: admin or the 'settings' permission (departments are managed on the settings page).

import { json, ok } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, parsePagination, str, newId, buildInsert } from '../../_lib/validate.js';
import { sanitizeDepartmentFields } from '../../_lib/models.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const { page, limit, offset } = parsePagination(new URL(request.url), { defaultLimit: 10, maxLimit: 1000 });

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`
            SELECT d.*, COUNT(DISTINCT e.id) AS employeeCount, COUNT(DISTINCT a.id) AS assetCount
            FROM Departments d
            LEFT JOIN Employees e ON e.departmentId = d.id
            LEFT JOIN Assets a ON a.departmentId = d.id
            GROUP BY d.id
            ORDER BY d.name ASC
            LIMIT ? OFFSET ?
        `).bind(limit, offset),
        env.DB.prepare('SELECT COUNT(*) AS total FROM Departments'),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requirePermission(context, 'settings', 'ตำแหน่งของคุณไม่มีสิทธิ์เพิ่มหรือแก้ไขแผนก');

    const data = await readJson(request);
    if (data.name === undefined) data.name = '';
    const fields = sanitizeDepartmentFields(data);

    const row = { id: str(data.id, { max: 100 }) || newId('dept'), ...fields };
    const ins = buildInsert('Departments', row, { orReplace: true });
    await env.DB.prepare(ins.sql).bind(...ins.values).run();

    console.log(`[departments:POST] '${user.username}' upserted department '${row.name}'`);
    return ok({ data: row });
}
