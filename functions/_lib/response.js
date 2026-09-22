// functions/_lib/response.js — JSON response helpers + HttpError
// Every API handler returns through these so headers/format stay consistent.

const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
};

export class HttpError extends Error {
    constructor(status, message, extra = null) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function ok(data = {}) {
    return json({ success: true, ...data });
}

export function fail(status, message, extra = null) {
    return json({ success: false, error: message, ...(extra || {}) }, status);
}

export const badRequest = (msg, extra) => fail(400, msg, extra);
export const unauthorized = (msg = 'กรุณาเข้าสู่ระบบก่อน') => fail(401, msg);
export const forbidden = (msg = 'คุณไม่มีสิทธิ์ดำเนินการนี้') => fail(403, msg);
export const notFound = (msg = 'ไม่พบข้อมูลที่ต้องการ') => fail(404, msg);
export const conflict = (msg) => fail(409, msg);

/** Convert any thrown value into a JSON response. Unknown errors become a generic 500 (no stack leak). */
export function errorToResponse(err, tag = 'api') {
    if (err instanceof HttpError) {
        if (err.status >= 500) console.error(`[${tag}] ${err.status}: ${err.message}`);
        return fail(err.status, err.message, err.extra);
    }
    console.error(`[${tag}] Unhandled error:`, err && err.stack ? err.stack : err);
    return fail(500, 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง');
}
