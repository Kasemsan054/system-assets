// functions/api/users/index.js — Users list (GET) and create (POST)
// GET: any logged-in user (needed by the staff/accounts screen). POST: admin only.
// The password column is never selected or returned.

import { json, ok, conflict, HttpError } from '../../_lib/response.js';
import { requireAuth, requireAdmin, serializePermissions } from '../../_lib/auth.js';
import { hashPassword, validatePasswordStrength } from '../../_lib/password.js';
import { readJson, parsePagination, str, newId } from '../../_lib/validate.js';

const USER_COLUMNS = 'id, username, name, role, employeeId, departmentId, permissions, mustChangePassword, createdAt';

export async function onRequestGet(context) {
    const { env, request } = context;
    await requireAuth(context);

    const { page, limit, offset } = parsePagination(new URL(request.url), { defaultLimit: 100, maxLimit: 500 });

    const [list, count] = await env.DB.batch([
        env.DB.prepare(`SELECT ${USER_COLUMNS} FROM Users ORDER BY role ASC, rowid ASC LIMIT ? OFFSET ?`).bind(limit, offset),
        env.DB.prepare('SELECT COUNT(*) AS total FROM Users'),
    ]);

    return json({ data: list.results, total: count.results[0]?.total || 0, page, limit });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const admin = await requireAdmin(context, 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มผู้ใช้งานได้');

    const data = await readJson(request);
    const username = str(data.username, { max: 100, required: true, label: 'ชื่อผู้ใช้งาน (username)' }).toLowerCase();
    const name = str(data.name, { max: 200, required: true, label: 'ชื่อ-นามสกุลของผู้ใช้งาน' });
    const pwdError = validatePasswordStrength(data.password);
    if (pwdError) throw new HttpError(400, pwdError);
    if (!/^[\p{L}\p{N}._@-]+$/u.test(username)) {
        throw new HttpError(400, 'ชื่อผู้ใช้งานใช้ได้เฉพาะตัวอักษร ตัวเลข และ . _ @ -');
    }

    const role = data.role === 'admin' ? 'admin' : 'user';
    const employeeId = str(data.employeeId, { max: 100 }) || null;
    const departmentId = str(data.departmentId, { max: 100 }) || null;

    const existing = await env.DB.prepare('SELECT id FROM Users WHERE LOWER(username) = ?').bind(username).first();
    if (existing) return conflict(`ชื่อผู้ใช้งาน '${username}' มีอยู่ในระบบแล้ว กรุณาเลือกชื่ออื่น`);

    const id = str(data.id, { max: 100 }) || newId('usr');
    const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const mustChange = data.mustChangePassword !== undefined ? (data.mustChangePassword ? 1 : 0) : (role === 'admin' ? 0 : 1);
    const permissions = serializePermissions(data.permissions, role);
    const passwordHash = await hashPassword(data.password);

    await env.DB.prepare(
        `INSERT INTO Users (id, username, password, name, role, employeeId, departmentId, permissions, mustChangePassword, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, username, passwordHash, name, role, employeeId, departmentId, permissions, mustChange, createdAt).run();

    console.log(`[users:POST] '${admin.username}' created user '${username}' (role=${role})`);
    return ok({
        data: { id, username, name, role, employeeId, departmentId, permissions, mustChangePassword: Boolean(mustChange), createdAt },
    });
}
