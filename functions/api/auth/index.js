// functions/api/auth/index.js — Login (POST) and session check (GET)
//
//  POST /api/auth  { username, password }  → signed token + user profile
//  GET  /api/auth  (Bearer)                → current user profile (used on app boot)
//
// Passwords are PBKDF2 hashes; legacy plain-text rows are upgraded on first successful login.
// Login attempts are rate-limited per IP and per username (best-effort, see _lib/ratelimit.js).

import { ok, fail, badRequest, unauthorized } from '../../_lib/response.js';
import { createToken, getAuth, getClientIP, parsePermissions, TOKEN_TTL_SECONDS } from '../../_lib/auth.js';
import { verifyPassword, hashPassword } from '../../_lib/password.js';
import { readJson, str } from '../../_lib/validate.js';
import { checkRateLimit, resetRateLimit } from '../../_lib/ratelimit.js';

const LOGIN_LIMIT_PER_IP = { limit: 20, windowMs: 60_000 };
const LOGIN_LIMIT_PER_USER = { limit: 8, windowMs: 5 * 60_000 };

// Fallback permission inference for accounts that have no explicit permissions saved.
function inferPermissionsFromPosition(position) {
    if (!position) return [];
    if (/พัสดุ|ทะเบียน|ทรัพย์สิน/i.test(position)) return ['assets', 'categories', 'assignments'];
    if (/ช่าง|ซ่อม|บำรุง|เทคนิค/i.test(position)) return ['maintenance'];
    if (/ผู้จัดการ|หัวหน้า/i.test(position)) return ['assignments'];
    return [];
}

async function lookupPosition(env, user) {
    const empId = user.employeeId || user.username;
    if (!empId) return '';
    const emp = await env.DB.prepare('SELECT position, location FROM Employees WHERE LOWER(id) = LOWER(?)').bind(empId).first();
    return emp ? (emp.position || emp.location || '') : '';
}

function profileOf(user, position, permissions) {
    return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        position,
        permissions,
        employeeId: user.employeeId,
        departmentId: user.departmentId,
        mustChangePassword: Boolean(user.mustChangePassword),
    };
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const ip = getClientIP(request);

    const ipLimit = checkRateLimit(`login:ip:${ip}`, LOGIN_LIMIT_PER_IP);
    if (!ipLimit.allowed) {
        console.warn(`[auth:POST] Rate limited IP ${ip}`);
        return fail(429, `พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${ipLimit.retryAfterSec} วินาทีแล้วลองใหม่`, { retryAfter: ipLimit.retryAfterSec });
    }

    const body = await readJson(request, { maxBytes: 4096 });
    const username = str(body.username, { max: 100 });
    const password = body.password === undefined || body.password === null ? '' : String(body.password);

    if (body.pin !== undefined && !username) {
        return badRequest('การเข้าสู่ระบบด้วย PIN ถูกยกเลิกแล้ว กรุณาใช้รหัสพนักงานและรหัสผ่าน');
    }
    if (!username || !password) return badRequest('กรุณาระบุรหัสพนักงานและรหัสผ่าน');
    if (password.length > 200) return badRequest('ข้อมูลที่ส่งมาไม่ถูกต้อง');

    const userKey = `login:user:${username.toLowerCase()}`;
    const userLimit = checkRateLimit(userKey, LOGIN_LIMIT_PER_USER);
    if (!userLimit.allowed) {
        console.warn(`[auth:POST] Rate limited username '${username}' from IP ${ip}`);
        return fail(429, `บัญชีนี้ถูกล็อกชั่วคราวจากการพยายามเข้าสู่ระบบผิดหลายครั้ง กรุณารอ ${userLimit.retryAfterSec} วินาที`, { retryAfter: userLimit.retryAfterSec });
    }

    const user = await env.DB.prepare(
        `SELECT id, username, password, name, role, employeeId, departmentId, permissions, mustChangePassword
           FROM Users
          WHERE LOWER(username) = LOWER(?1) OR (employeeId IS NOT NULL AND LOWER(employeeId) = LOWER(?1))
          LIMIT 1`
    ).bind(username).first();

    const { ok: passwordOk, needsRehash } = user
        ? await verifyPassword(password, user.password)
        // Run a dummy hash so "unknown user" and "wrong password" take the same time.
        : await verifyPassword(password, 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');

    if (!user || !passwordOk) {
        console.warn(`[auth:POST] Login FAILED — username: '${username}', IP: ${ip}, reason: ${!user ? 'user_not_found' : 'wrong_password'}`);
        return unauthorized('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง');
    }

    if (needsRehash) {
        // Transparent upgrade: plain-text (or weaker) hash → current PBKDF2 parameters.
        const upgraded = await hashPassword(password);
        await env.DB.prepare('UPDATE Users SET password = ? WHERE id = ?').bind(upgraded, user.id).run();
        console.log(`[auth:POST] Upgraded password hash for user '${user.username}'`);
    }

    resetRateLimit(userKey);

    const role = user.role === 'admin' ? 'admin' : 'user';
    let position = await lookupPosition(env, user);
    if (!position && role === 'admin') position = 'ผู้ดูแลระบบ';

    let permissions = parsePermissions(user.permissions, role);
    if (role !== 'admin' && permissions.length === 0 && !user.permissions) {
        permissions = inferPermissionsFromPosition(position);
    }

    const token = await createToken(env, user.id);
    console.log(`[auth:POST] Login OK — user: '${user.username}', role: ${role}, IP: ${ip}`);

    const profile = profileOf({ ...user, role }, position, permissions);
    return ok({
        token,
        expiresIn: TOKEN_TTL_SECONDS,
        role,
        name: user.name,
        position,
        permissions,
        mustChangePassword: profile.mustChangePassword,
        user: profile,
    });
}

export async function onRequestGet(context) {
    const user = await getAuth(context);
    if (!user) return fail(401, 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่', { authenticated: false });

    let position = await lookupPosition(context.env, user);
    if (!position && user.role === 'admin') position = 'ผู้ดูแลระบบ';

    return ok({
        authenticated: true,
        role: user.role,
        user: profileOf(user, position, user.permissions),
    });
}
