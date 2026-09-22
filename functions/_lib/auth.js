// functions/_lib/auth.js — Signed session tokens + authorization guards
//
// Token format:  v2.<payload b64url>.<HMAC-SHA256 b64url>
// Payload:       { sub: userId, iat, exp }
//
// The token only proves *who* the caller is. Role and permissions are re-read from
// the Users table on every request so that admin changes (permissions, role, deletion)
// take effect immediately instead of when the token expires.
//
// Secret: env.AUTH_SECRET (recommended — `wrangler pages secret put AUTH_SECRET`).
// If it is not set, a random secret is generated once and persisted in the Settings
// table under `_authSecret`, so the system still works without any configuration.

import { HttpError } from './response.js';

export const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours
export const MODULES = ['assets', 'categories', 'assignments', 'maintenance', 'settings'];

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── base64url helpers ────────────────────────────────────────────────────────
function b64urlEncode(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// ── secret resolution (cached per isolate) ───────────────────────────────────
let _keyPromise = null;

async function getSigningKey(env) {
    if (_keyPromise) return _keyPromise;
    _keyPromise = (async () => {
        let secret = env.AUTH_SECRET;
        if (!secret) {
            const row = await env.DB.prepare("SELECT value FROM Settings WHERE key = '_authSecret'").first();
            if (row?.value) {
                secret = row.value;
            } else {
                secret = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
                await env.DB.prepare("INSERT OR IGNORE INTO Settings (key, value) VALUES ('_authSecret', ?)").bind(secret).run();
                // Another isolate may have raced us — always read back the winner.
                const again = await env.DB.prepare("SELECT value FROM Settings WHERE key = '_authSecret'").first();
                secret = again?.value || secret;
                console.warn('[auth] AUTH_SECRET not set — generated one and stored it in Settings. Set AUTH_SECRET as a Pages secret for production.');
            }
        }
        return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    })();
    _keyPromise.catch(() => { _keyPromise = null; }); // allow retry after a transient DB failure
    return _keyPromise;
}

// ── token create / verify ────────────────────────────────────────────────────
export async function createToken(env, userId) {
    const now = Math.floor(Date.now() / 1000);
    const payload = b64urlEncode(enc.encode(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS })));
    const key = await getSigningKey(env);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
    return `v2.${payload}.${b64urlEncode(sig)}`;
}

/** @returns {Promise<{sub:string, iat:number, exp:number}|null>} */
export async function verifyToken(env, token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v2') return null;
    const [, payload, sig] = parts;
    try {
        const key = await getSigningKey(env);
        const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc.encode(payload));
        if (!valid) return null;
        const data = JSON.parse(dec.decode(b64urlDecode(payload)));
        if (!data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
        return data;
    } catch {
        return null;
    }
}

// ── request helpers ──────────────────────────────────────────────────────────
export function getBearer(request) {
    const h = request.headers.get('Authorization') || '';
    return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        || 'unknown';
}

export function parsePermissions(raw, role) {
    if (role === 'admin') return ['*'];
    if (!raw) return [];
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(arr) ? arr.filter(p => typeof p === 'string') : [];
    } catch {
        return [];
    }
}

/** Normalise a permissions payload from the client into the JSON string stored in Users.permissions. */
export function serializePermissions(raw, role) {
    if (role === 'admin') return JSON.stringify(['*']);
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch { arr = []; }
    }
    if (!Array.isArray(arr)) arr = [];
    const clean = [...new Set(arr.filter(p => typeof p === 'string' && MODULES.includes(p)))];
    return JSON.stringify(clean);
}

/**
 * Resolve the calling user (or null). Result is cached on context.data for the request.
 * @returns {Promise<{id,username,name,role,permissions,employeeId,departmentId,mustChangePassword}|null>}
 */
export async function getAuth(context) {
    const { request, env } = context;
    if (context.data && context.data.authUser !== undefined) return context.data.authUser;

    let user = null;
    const claims = await verifyToken(env, getBearer(request));
    if (claims) {
        const row = await env.DB.prepare(
            'SELECT id, username, name, role, employeeId, departmentId, permissions, mustChangePassword FROM Users WHERE id = ?'
        ).bind(claims.sub).first();
        if (row) {
            user = {
                id: row.id,
                username: row.username,
                name: row.name,
                role: row.role === 'admin' ? 'admin' : 'user',
                employeeId: row.employeeId,
                departmentId: row.departmentId,
                permissions: parsePermissions(row.permissions, row.role),
                mustChangePassword: Boolean(row.mustChangePassword),
            };
        }
    }
    if (context.data) context.data.authUser = user;
    return user;
}

export function hasPermission(user, module) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions.includes('*') || user.permissions.includes(module);
}

/** 401 if not logged in. */
export async function requireAuth(context) {
    const user = await getAuth(context);
    if (!user) throw new HttpError(401, 'กรุณาเข้าสู่ระบบก่อน');
    return user;
}

/** 403 unless role === admin. */
export async function requireAdmin(context, message = 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดำเนินการนี้ได้') {
    const user = await requireAuth(context);
    if (user.role !== 'admin') throw new HttpError(403, message);
    return user;
}

/** 403 unless the user is admin or holds at least one of the given module permissions. */
export async function requirePermission(context, modules, message) {
    const user = await requireAuth(context);
    const list = Array.isArray(modules) ? modules : [modules];
    if (!list.some(m => hasPermission(user, m))) {
        throw new HttpError(403, message || 'ตำแหน่งของคุณไม่มีสิทธิ์แก้ไขข้อมูลส่วนนี้');
    }
    return user;
}
