// functions/_lib/password.js — PBKDF2-SHA256 password hashing (Web Crypto, works on Workers)
//
// Stored format:  pbkdf2$<iterations>$<salt b64>$<hash b64>
// Legacy rows hold plain text; verifyPassword() reports `needsRehash` so the caller
// can upgrade the row transparently on the next successful login.

const ITERATIONS = 100_000;
const KEY_LEN_BYTES = 32;
const PREFIX = 'pbkdf2';

const enc = new TextEncoder();

function toB64(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
}
function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

async function derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        key,
        KEY_LEN_BYTES * 8
    );
    return new Uint8Array(bits);
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export function isHashed(stored) {
    return typeof stored === 'string' && stored.startsWith(PREFIX + '$');
}

export async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(String(password), salt, ITERATIONS);
    return `${PREFIX}$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

/**
 * @returns {Promise<{ok: boolean, needsRehash: boolean}>}
 */
export async function verifyPassword(password, stored) {
    if (!stored) return { ok: false, needsRehash: false };
    password = String(password);

    if (!isHashed(stored)) {
        // Legacy plain-text row — constant-time compare, then ask caller to upgrade it.
        const a = enc.encode(password), b = enc.encode(String(stored));
        return { ok: timingSafeEqual(a, b), needsRehash: true };
    }

    const [, iterStr, saltB64, hashB64] = stored.split('$');
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltB64 || !hashB64) return { ok: false, needsRehash: false };

    const expected = fromB64(hashB64);
    const actual = await derive(password, fromB64(saltB64), iterations);
    const ok = timingSafeEqual(actual, expected);
    return { ok, needsRehash: ok && iterations < ITERATIONS };
}

export function validatePasswordStrength(pwd) {
    const p = String(pwd || '');
    if (p.length < 6) return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
    if (p.length > 128) return 'รหัสผ่านยาวเกินไป (สูงสุด 128 ตัวอักษร)';
    return null;
}
