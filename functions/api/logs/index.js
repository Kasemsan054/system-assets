// functions/api/logs/index.js — Activity log list (GET) and append (POST)
// The acting user's name/role are taken from the session token, never from the client body.

import { json, ok } from '../../_lib/response.js';
import { requireAuth } from '../../_lib/auth.js';
import { readJson, parsePagination, str, likeEscape, newId } from '../../_lib/validate.js';

const VALID_MODULES = ['assets', 'assignments', 'maintenance', 'categories', 'departments', 'employees', 'users', 'auth', 'settings', 'system', 'logs'];

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const url = new URL(request.url);
    const { page, limit, offset } = parsePagination(url, { defaultLimit: 20, maxLimit: 200 });

    const where = [];
    const params = [];
    const targetId = url.searchParams.get('targetId');
    const module = url.searchParams.get('module');
    const search = url.searchParams.get('search')?.trim();

    if (url.searchParams.get('excludeLogin') === 'true') where.push("action != 'login' AND module != 'auth'");
    if (targetId) {
        where.push(`(targetId = ? OR details LIKE ? ESCAPE '\\')`);
        params.push(targetId, `%${likeEscape(targetId)}%`);
    }
    if (module && VALID_MODULES.includes(module)) { where.push('module = ?'); params.push(module); }
    if (search && search.length >= 2) { // min 2 chars to avoid full-table LIKE scans on single letters
        const like = `%${likeEscape(search.slice(0, 100))}%`;
        where.push(`(targetName LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\' OR userName LIKE ? ESCAPE '\\')`);
        params.push(like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`SELECT * FROM ActivityLogs ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset),
        env.DB.prepare(`SELECT COUNT(*) AS total FROM ActivityLogs ${whereSql}`).bind(...params),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const user = await requireAuth(context);

    const body = await readJson(request, { maxBytes: 16_384 });
    const action = str(body.action, { max: 50, required: true, label: 'ประเภทกิจกรรม (action)' });
    // Keep module within the known set so log filtering (which uses VALID_MODULES) stays reliable;
    // an unrecognised module is recorded as 'system' rather than silently escaping every filter.
    const rawModule = str(body.module, { max: 50, required: true, label: 'หมวดหมู่การทำงาน (module)' });
    const module = VALID_MODULES.includes(rawModule) ? rawModule : 'system';

    const row = {
        id: str(body.id, { max: 100 }) || newId('log'),
        action,
        module,
        targetId: str(body.targetId, { max: 200 }) || null,
        targetName: str(body.targetName, { max: 500 }) || null,
        details: str(body.details, { max: 2000 }),
        userName: user.name || user.username,
        userRole: user.role === 'admin' ? 'admin' : (str(body.userRole, { max: 50 }) || 'user'),
        createdAt: new Date().toISOString(),
    };

    await env.DB.prepare(
        'INSERT INTO ActivityLogs (id, action, module, targetId, targetName, details, userName, userRole, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(row.id, row.action, row.module, row.targetId, row.targetName, row.details, row.userName, row.userRole, row.createdAt).run();

    return ok({ id: row.id, createdAt: row.createdAt });
}
