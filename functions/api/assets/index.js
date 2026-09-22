// functions/api/assets/index.js — Asset registry list (GET) and create/upsert (POST)

import { json, ok, conflict } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, parsePagination, str, likeEscape, buildInsert, buildUpdate } from '../../_lib/validate.js';
import { ASSET_STATUSES, sanitizeAssetFields } from '../../_lib/models.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url, { defaultLimit: 10, maxLimit: 500 });

    const q = url.searchParams.get('q')?.trim() || '';
    const category = url.searchParams.get('category') || '';
    const status = url.searchParams.get('status') || '';
    const department = url.searchParams.get('department') || '';
    const holder = url.searchParams.get('holder') || '';

    const where = [];
    const params = [];
    if (q) {
        const like = `%${likeEscape(q.slice(0, 100))}%`;
        // Search covers name, serial/ID and the physical location (warehouse / employee / customer address).
        where.push(`(name LIKE ? ESCAPE '\\' OR serial LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR holderName LIKE ? ESCAPE '\\')`);
        params.push(like, like, like, like, like);
    }
    if (category) { where.push('categoryId = ?'); params.push(category); }
    if (department) { where.push('departmentId = ?'); params.push(department); }
    if (holder) { where.push('holderId = ?'); params.push(holder); }
    if (status && ASSET_STATUSES.includes(status)) { where.push('status = ?'); params.push(status); }
    // held=true → assets currently in someone's hands (staff via holderId, or a free-text customer/external holder)
    if (url.searchParams.get('held') === 'true') {
        where.push("((holderId IS NOT NULL AND holderId != '') OR (holderName IS NOT NULL AND holderName != ''))");
    }

    const sortBy = url.searchParams.get('sortBy') || url.searchParams.get('sort') || '';
    const sortOrder = (url.searchParams.get('sortOrder') || url.searchParams.get('order') || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let orderSql = 'ORDER BY rowid DESC';
    if (sortBy === 'name') {
        orderSql = `ORDER BY name COLLATE NOCASE ${sortOrder}`;
    } else if (sortBy === 'serial' || sortBy === 'id') {
        orderSql = `ORDER BY COALESCE(serial, id) COLLATE NOCASE ${sortOrder}`;
    } else if (sortBy === 'holder') {
        orderSql = `ORDER BY COALESCE(NULLIF(holderName, ''), holderId, '') COLLATE NOCASE ${sortOrder}`;
    } else if (sortBy === 'status') {
        orderSql = `ORDER BY status ${sortOrder}`;
    } else if (sortBy === 'purchaseDate') {
        orderSql = `ORDER BY purchaseDate ${sortOrder}`;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`SELECT * FROM Assets ${whereSql} ${orderSql} LIMIT ? OFFSET ?`).bind(...params, limit, offset),
        env.DB.prepare(`SELECT COUNT(*) AS total FROM Assets ${whereSql}`).bind(...params),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requirePermission(context, 'assets', 'ตำแหน่งของคุณไม่มีสิทธิ์เพิ่มหรือแก้ไขข้อมูลทรัพย์สิน');

    const data = await readJson(request);
    const sn = str(data.id || data.sn || data.serial, { max: 100, required: true, label: 'หมายเลขทรัพย์สิน/Serial Number (S/N)' });
    if (data.name === undefined) data.name = '';
    const fields = sanitizeAssetFields(data);
    if (!fields.serial) fields.serial = sn;

    const isUpsert = new URL(request.url).searchParams.get('upsert') === 'true' || Boolean(data.upsert);
    const existing = await env.DB.prepare('SELECT id FROM Assets WHERE LOWER(id) = LOWER(?)').bind(sn).first();

    if (existing) {
        if (!isUpsert) {
            console.warn(`[assets:POST] Duplicate S/N rejected: '${sn}'`);
            return conflict(`หมายเลขเครื่อง/S/N '${sn}' มีอยู่ในระบบแล้ว หากต้องการอัปเดตให้ใช้ ?upsert=true`);
        }
        const q = buildUpdate('Assets', fields, existing.id);
        if (q) await env.DB.prepare(q.sql).bind(...q.values).run();
        console.log(`[assets:POST] '${user.username}' upserted asset '${sn}'`);
        return ok({ data: { id: existing.id, ...fields }, updated: true });
    }

    const row = { id: sn, status: 'ready', ...fields };
    const ins = buildInsert('Assets', row);
    await env.DB.prepare(ins.sql).bind(...ins.values).run();

    // Auto-create assignment record if new asset has a holder
    if (row.holderId || row.holderName) {
        const hId = (row.holderId && String(row.holderId).trim()) || null;
        const hName = hId ? null : ((row.holderName && String(row.holderName).trim()) || null);
        const asgId = 'asg_' + crypto.randomUUID().slice(0, 12).replace(/-/g, '');
        const dateOut = row.purchaseDate || new Date().toISOString().slice(0, 10);
        const note = row.status === 'borrowed' ? 'ยืมใช้งาน' : 'เบิกใช้งาน';
        await env.DB.prepare(
            "INSERT INTO Assignments (id, assetId, employeeId, departmentId, holderName, dateOut, dateReturn, note) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)"
        ).bind(asgId, sn, hId, row.departmentId || null, hName, dateOut, note).run();
    }

    console.log(`[assets:POST] '${user.username}' created asset '${sn}' (${row.name})`);
    return ok({ data: row });
}
