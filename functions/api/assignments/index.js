// functions/api/assignments/index.js — Assignment list (GET) and create (POST)

import { json, ok, badRequest, notFound } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, parsePagination, str, newId, buildInsert } from '../../_lib/validate.js';
import { sanitizeAssignmentFields } from '../../_lib/models.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url, { defaultLimit: 200, maxLimit: 500 });

    const where = [];
    const params = [];
    const assetId = url.searchParams.get('assetId');
    const employeeId = url.searchParams.get('employeeId');
    const open = url.searchParams.get('open'); // open=true → not yet returned

    if (assetId) { where.push('assetId = ?'); params.push(assetId); }
    if (employeeId) { where.push('employeeId = ?'); params.push(employeeId); }
    if (open === 'true') where.push("(dateReturn IS NULL OR dateReturn = '')");
    else if (open === 'false') where.push("(dateReturn IS NOT NULL AND dateReturn != '')");

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`SELECT * FROM Assignments ${whereSql} ORDER BY rowid DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset),
        env.DB.prepare(`SELECT COUNT(*) AS total FROM Assignments ${whereSql}`).bind(...params),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requirePermission(context, 'assignments', 'ตำแหน่งของคุณไม่มีสิทธิ์มอบหมายทรัพย์สิน');

    const data = await readJson(request);
    if (data.assetId === undefined) data.assetId = '';
    const fields = sanitizeAssignmentFields(data);

    if (!fields.employeeId && !fields.departmentId && !fields.holderName) {
        return badRequest('กรุณาระบุผู้รับมอบหมาย (บุคลากรหรือลูกค้า/บุคคลภายนอก) หรือแผนก');
    }

    const asset = await env.DB.prepare('SELECT id FROM Assets WHERE id = ?').bind(fields.assetId).first();
    if (!asset) return notFound(`ไม่พบทรัพย์สินรหัส '${fields.assetId}' ในระบบ`);

    const row = { id: str(data.id, { max: 100 }) || newId('asg'), ...fields };
    const ins = buildInsert('Assignments', row, { orReplace: true });
    await env.DB.prepare(ins.sql).bind(...ins.values).run();

    console.log(`[assignments:POST] '${user.username}' assigned asset ${row.assetId} → ${row.employeeId || row.departmentId}`);
    return ok({ data: row });
}
