// functions/api/users/[id].js — User detail / update / delete
//  GET    any logged-in user
//  PUT    self (name + password only) or admin (everything)
//  DELETE admin only; the last admin cannot be deleted; you cannot delete yourself

import { json, ok, notFound, forbidden, badRequest, HttpError } from '../../_lib/response.js';
import { requireAuth, requireAdmin, serializePermissions } from '../../_lib/auth.js';
import { hashPassword, validatePasswordStrength } from '../../_lib/password.js';
import { readJson, str, buildUpdate } from '../../_lib/validate.js';

const USER_COLUMNS = 'id, username, name, role, employeeId, departmentId, permissions, mustChangePassword, createdAt';

export async function onRequestGet(context) {
    const { env, params } = context;
    await requireAuth(context);

    const user = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM Users WHERE id = ?`).bind(params.id).first();
    if (!user) return notFound(`ไม่พบข้อมูลผู้ใช้รหัส '${params.id}'`);
    return json(user);
}

export async function onRequestPut(context) {
    const { env, request, params } = context;
    const me = await requireAuth(context);
    const isAdmin = me.role === 'admin';
    const isSelf = me.id === params.id;

    if (!isAdmin && !isSelf) return forbidden('ไม่มีสิทธิ์แก้ไขข้อมูลของผู้ใช้อื่น');

    const target = await env.DB.prepare('SELECT id, role FROM Users WHERE id = ?').bind(params.id).first();
    if (!target) return notFound('ไม่พบข้อมูลผู้ใช้');

    const data = await readJson(request);
    const updates = {};

    if (data.name !== undefined) {
        updates.name = str(data.name, { max: 200, required: true, label: 'ชื่อผู้ใช้งาน' });
    }

    if (data.password !== undefined) {
        const pwdError = validatePasswordStrength(data.password);
        if (pwdError) throw new HttpError(400, pwdError);
        updates.password = await hashPassword(data.password);
        // Self-service change clears the "must change" flag; an admin reset forces a change on next login.
        updates.mustChangePassword = isSelf ? 0 : 1;
    }

    if (isAdmin) {
        if (data.mustChangePassword !== undefined) updates.mustChangePassword = data.mustChangePassword ? 1 : 0;
        if (data.role !== undefined) {
            const newRole = data.role === 'admin' ? 'admin' : 'user';
            if (isSelf && newRole !== 'admin') return badRequest('ไม่สามารถลดสิทธิ์ผู้ดูแลระบบของตัวเองได้');
            if (target.role === 'admin' && newRole !== 'admin') {
                const { count } = await env.DB.prepare("SELECT COUNT(*) AS count FROM Users WHERE role = 'admin'").first();
                if (count <= 1) return badRequest('ไม่สามารถลดสิทธิ์ผู้ดูแลระบบคนสุดท้ายได้');
            }
            updates.role = newRole;
        }
        if (data.employeeId !== undefined) updates.employeeId = str(data.employeeId, { max: 100 }) || null;
        if (data.departmentId !== undefined) updates.departmentId = str(data.departmentId, { max: 100 }) || null;
        if (data.permissions !== undefined) {
            updates.permissions = serializePermissions(data.permissions, updates.role || target.role);
        }
    } else if (data.role !== undefined || data.permissions !== undefined || data.employeeId !== undefined || data.departmentId !== undefined) {
        return forbidden('ไม่มีสิทธิ์แก้ไขบทบาทหรือสิทธิ์การใช้งาน');
    }

    const q = buildUpdate('Users', updates, params.id);
    if (q) await env.DB.prepare(q.sql).bind(...q.values).run();

    console.log(`[users/[id]:PUT] '${me.username}' updated user ${params.id} (${Object.keys(updates).join(', ') || 'no-op'})`);
    return ok({ updated: Object.keys(updates).filter(k => k !== 'password') });
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const me = await requireAdmin(context, 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบผู้ใช้ได้');

    if (me.id === params.id) return badRequest('ไม่สามารถลบบัญชีของตัวเองได้');

    const target = await env.DB.prepare('SELECT id, role, username FROM Users WHERE id = ?').bind(params.id).first();
    if (!target) return notFound('ไม่พบข้อมูลผู้ใช้');

    if (target.role === 'admin') {
        const { count } = await env.DB.prepare("SELECT COUNT(*) AS count FROM Users WHERE role = 'admin'").first();
        if (count <= 1) return badRequest('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้');
    }

    await env.DB.prepare('DELETE FROM Users WHERE id = ?').bind(params.id).run();
    console.log(`[users/[id]:DELETE] '${me.username}' deleted user '${target.username}' (${params.id})`);
    return ok();
}
