// functions/api/settings/index.js — Organisation settings
//  GET  public (branding is needed on the login page before authentication)
//  PUT  admin, or a user holding the 'settings' permission

import { json, ok, badRequest } from '../../_lib/response.js';
import { requirePermission } from '../../_lib/auth.js';
import { readJson } from '../../_lib/validate.js';

// Keys the client may read / write. Internal keys (prefixed with `_`) never leave the server.
const PUBLIC_KEYS = ['orgName', 'orgSub', 'theme', 'language', 'timezone'];
const MAX_VALUE_LEN = 500;

export async function onRequestGet(context) {
    const { results } = await context.env.DB.prepare(
        `SELECT key, value FROM Settings WHERE key IN (${PUBLIC_KEYS.map(() => '?').join(',')})`
    ).bind(...PUBLIC_KEYS).all();

    const settings = {};
    for (const row of results) settings[row.key] = row.value;
    return json(settings);
}

export async function onRequestPut(context) {
    const { env, request } = context;
    const user = await requirePermission(context, 'settings', 'เฉพาะผู้ดูแลระบบหรือผู้มีสิทธิ์ตั้งค่าระบบเท่านั้นที่สามารถแก้ไขการตั้งค่าได้');

    const data = await readJson(request);
    const keys = Object.keys(data).filter(k => PUBLIC_KEYS.includes(k));
    const rejected = Object.keys(data).filter(k => !PUBLIC_KEYS.includes(k));

    if (keys.length === 0) return badRequest('ไม่มีคีย์การตั้งค่าที่ถูกต้องสำหรับอัปเดต', { rejected });
    if (rejected.length) console.warn('[settings:PUT] Ignored unknown keys:', rejected.join(', '));

    const stmt = env.DB.prepare('INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)');
    await env.DB.batch(keys.map(k => stmt.bind(k, String(data[k] ?? '').slice(0, MAX_VALUE_LEN))));

    console.log(`[settings:PUT] '${user.username}' updated: ${keys.join(', ')}`);
    return ok({ updated: keys, rejected });
}
