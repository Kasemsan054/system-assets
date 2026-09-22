// functions/_lib/validate.js — request parsing, validation and small SQL builders

import { HttpError } from './response.js';

/** Parse the JSON body; 400 on malformed / non-object payloads. */
export async function readJson(request, { maxBytes = 1_000_000 } = {}) {
    const len = Number(request.headers.get('Content-Length') || 0);
    if (len > maxBytes) throw new HttpError(413, 'ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป');
    let data;
    try {
        data = await request.json();
    } catch {
        throw new HttpError(400, 'รูปแบบข้อมูล (JSON) ไม่ถูกต้อง');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new HttpError(400, 'ข้อมูลที่ส่งมาต้องเป็น JSON object');
    }
    return data;
}

/** page/limit/offset from the query string, with sane bounds. */
export function parsePagination(url, { defaultLimit = 20, maxLimit = 500 } = {}) {
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || defaultLimit));
    return { page, limit, offset: (page - 1) * limit };
}

/** Trimmed string, or '' for null/undefined. Throws 400 if `required` and empty. */
export function str(value, { max = 500, required = false, label = 'ข้อมูล' } = {}) {
    const s = value === undefined || value === null ? '' : String(value).trim();
    if (required && !s) throw new HttpError(400, `กรุณาระบุ${label}`);
    if (s.length > max) throw new HttpError(400, `${label}ยาวเกินกำหนด (สูงสุด ${max} ตัวอักษร)`);
    return s;
}

/** Non-negative number or null. Throws 400 on garbage. */
export function num(value, { label = 'ตัวเลข', min = 0, max = Number.MAX_SAFE_INTEGER, allowNull = true } = {}) {
    if (value === undefined || value === null || value === '') {
        if (allowNull) return null;
        throw new HttpError(400, `กรุณาระบุ${label}`);
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new HttpError(400, `${label}ต้องเป็นตัวเลขระหว่าง ${min} ถึง ${max}`);
    }
    return n;
}

/** ISO-ish date string (YYYY-MM-DD or full ISO) or null. */
export function dateStr(value, { label = 'วันที่' } = {}) {
    if (value === undefined || value === null || value === '') return null;
    const s = String(value).trim().slice(0, 30);
    if (Number.isNaN(new Date(s).getTime())) throw new HttpError(400, `${label}ไม่ถูกต้อง`);
    return s;
}

export function oneOf(value, allowed, { label = 'ค่า' } = {}) {
    if (value === undefined || value === null || value === '') return null;
    if (!allowed.includes(value)) throw new HttpError(400, `${label}ไม่ถูกต้อง ต้องเป็นหนึ่งใน: ${allowed.join(', ')}`);
    return value;
}

/** Escape %, _ and \ for a LIKE ... ESCAPE '\' clause. */
export function likeEscape(s) {
    return String(s).replace(/[\\%_]/g, c => '\\' + c);
}

/** Keep only allow-listed keys that are present (not undefined). */
export function pick(data, allowed) {
    const out = {};
    for (const k of allowed) if (data[k] !== undefined) out[k] = data[k];
    return out;
}

/** Build `INSERT [OR REPLACE] INTO t (a, b) VALUES (?, ?)` from an object. Keys must already be allow-listed. */
export function buildInsert(table, obj, { orReplace = false } = {}) {
    const keys = Object.keys(obj);
    if (keys.length === 0) throw new HttpError(400, 'ไม่มีข้อมูลสำหรับบันทึก');
    const sql = `INSERT ${orReplace ? 'OR REPLACE ' : ''}INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    return { sql, values: keys.map(k => obj[k]) };
}

/** Build `UPDATE t SET a = ?, b = ? WHERE id = ?`. Returns null when there is nothing to update. */
export function buildUpdate(table, obj, id) {
    const keys = Object.keys(obj);
    if (keys.length === 0) return null;
    const sql = `UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
    return { sql, values: [...keys.map(k => obj[k]), id] };
}

export function newId(prefix) {
    const rand = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 10) : Math.random().toString(36).slice(2, 12);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
