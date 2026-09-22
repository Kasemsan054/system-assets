// functions/api/_middleware.js — runs before every /api/* handler
//
//  • Converts thrown HttpError (and unexpected errors) into JSON responses
//  • Adds security / no-cache headers to every API response
//  • Answers CORS pre-flight for same-origin tooling (the app itself is same-origin)
//  • Logs one structured line per request:  [api] GET /api/assets → 200 (12ms)

import { errorToResponse, HttpError } from '../_lib/response.js';

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Cache-Control': 'no-store',
    'X-XSS-Protection': '1; mode=block',
};

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const started = Date.now();
    const tag = `${request.method} ${url.pathname}`;

    // Same-origin only: reflect the Origin header solely when it matches the app's own origin.
    // Same-origin requests carry no Origin header and need no CORS headers at all.
    const origin = request.headers.get('Origin');
    const allowOrigin = origin && origin === url.origin ? origin : null;

    if (request.method === 'OPTIONS') {
        const preflight = {
            'Access-Control-Allow-Methods': ALLOWED_METHODS,
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            ...SECURITY_HEADERS,
        };
        if (allowOrigin) preflight['Access-Control-Allow-Origin'] = allowOrigin;
        return new Response(null, { status: 204, headers: preflight });
    }

    context.data = context.data || {};

    let response;
    try {
        response = await context.next();
    } catch (err) {
        response = errorToResponse(err, tag);
    }

    if (!response) {
        response = errorToResponse(new HttpError(404, 'ไม่พบ endpoint ที่ร้องขอ'), tag);
    }

    // Response headers from context.next() are immutable — clone before touching them.
    const out = new Response(response.body, response);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    if (allowOrigin) out.headers.set('Access-Control-Allow-Origin', allowOrigin);

    const ms = Date.now() - started;
    const line = `[api] ${tag} → ${out.status} (${ms}ms)`;
    if (out.status >= 500) console.error(line);
    else if (out.status >= 400) console.warn(line);
    else console.log(line);

    return out;
}
