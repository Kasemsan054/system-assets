// js/api.js - API client for the Cloudflare Pages Functions (D1) backend
//  • 15s timeout per request (AbortController)
//  • in-flight GET de-duplication
//  • structured console logging in dev (localhost / ?debug=1)
//  • automatic logout + redirect when the session token is rejected (401)

const API_TIMEOUT_MS = 15000;
const _inflightRequests = new Map();

const DEV = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.dev') ||
    window.location.search.includes('debug=1')
);
window.APP_DEV = DEV;

const SESSION_KEYS = [
    'ams_token', 'ams_role', 'ams_user_name', 'ams_position',
    'ams_permissions', 'ams_user', 'ams_must_change_pwd', 'ams_token_exp'
];

const logger = {
    request(method, url) {
        if (DEV) console.groupCollapsed(`%c[API] ${method} ${url}`, 'color:#6366f1;font-weight:600;');
        return Date.now();
    },
    success(status, startTime) {
        if (!DEV) return;
        console.log(`%c✓ ${status} — ${Date.now() - startTime}ms`, 'color:#22c55e;');
        console.groupEnd();
    },
    failure(method, endpoint, status, message, startTime) {
        const ms = startTime ? Date.now() - startTime : '?';
        if (DEV) {
            console.log(`%c✗ ${status} — ${ms}ms | ${message}`, 'color:#ef4444;');
            console.groupEnd();
        }
        console.warn(`[API ERROR] ${method} /api/${endpoint} → ${status} (${ms}ms) | ${message}`);
    }
};

class ApiError extends Error {
    constructor(message, status, payload) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.payload = payload || {};
    }
}

const API = {
    ApiError,

    // ── Core fetch wrapper ─────────────────────────────────────────────
    async request(endpoint, method = 'GET', body = null, { timeoutMs = API_TIMEOUT_MS } = {}) {
        const url = `/api/${endpoint}`;
        const dedupeKey = method === 'GET' ? `GET::${endpoint}` : null;
        if (dedupeKey && _inflightRequests.has(dedupeKey)) {
            if (DEV) console.log(`[API] Deduped (reusing in-flight): ${dedupeKey}`);
            return _inflightRequests.get(dedupeKey);
        }

        const startTime = logger.request(method, url);
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('ams_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const config = { method, headers, signal: controller.signal };
        if (body) config.body = JSON.stringify(body);

        const fetchPromise = (async () => {
            try {
                const res = await fetch(url, config);
                let data = {};
                try { data = await res.json(); } catch { /* empty / non-JSON body */ }

                if (!res.ok) {
                    const errMsg = data.error || `HTTP ${res.status} — ${res.statusText}`;
                    logger.failure(method, endpoint, res.status, errMsg, startTime);

                    // Session rejected by the server (expired / deleted / bad token) -> re-login.
                    if (res.status === 401 && endpoint !== 'auth' && token) {
                        this._handleSessionExpired();
                    }
                    throw new ApiError(errMsg, res.status, data);
                }

                logger.success(res.status, startTime);
                return data;
            } catch (err) {
                if (err.name === 'AbortError') {
                    const msg = `หมดเวลาเชื่อมต่อเซิร์ฟเวอร์ ` +
                        `(${Math.round(timeoutMs / 1000)}s) กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต`;
                    logger.failure(method, endpoint, 'TIMEOUT', msg, startTime);
                    throw new ApiError(msg, 0, {});
                }
                if (!(err instanceof ApiError)) {
                    logger.failure(method, endpoint, 'NETWORK', err.message, startTime);
                    throw new ApiError(
                        'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 0, {}
                    );
                }
                throw err;
            } finally {
                clearTimeout(timeoutId);
                if (dedupeKey) _inflightRequests.delete(dedupeKey);
            }
        })();

        if (dedupeKey) _inflightRequests.set(dedupeKey, fetchPromise);
        return fetchPromise;
    },

    _sessionExpiredHandled: false,
    _handleSessionExpired() {
        if (this._sessionExpiredHandled) return;
        this._sessionExpiredHandled = true;
        console.warn('[API] Session rejected by server — logging out');
        this.logout();
        if (typeof toast === 'function') toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', true);
        if (typeof navigateTo === 'function') navigateTo('/login', true);
        else window.location.href = '/login';
        setTimeout(() => { this._sessionExpiredHandled = false; }, 2000);
    },

    // ── Authentication ─────────────────────────────────────────────────
    async login(username, password) {
        const payload = (typeof username === 'object' && username !== null)
            ? username
            : { username, password };

        const res = await this.request('auth', 'POST', payload);
        if (!res || !res.success) return false;
        this._storeSession(res);
        if (DEV) console.log(`[API] Login OK — role: ${res.role}, user: ${this.getUserName()}`);
        return res;
    },

    /**
     * Re-validate stored token with the server (called on boot).
     * Returns the profile, or null if session is invalid.
     */
    async checkSession() {
        if (!localStorage.getItem('ams_token')) return null;
        try {
            const res = await this.request('auth', 'GET');
            if (res && res.authenticated && res.user) {
                this._storeSession(
                    { ...res, token: localStorage.getItem('ams_token') },
                    { keepToken: true }
                );
                return res.user;
            }
            return null;
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                this.logout();
                return null;
            }
            // Network error: keep local session so app opens offline; later 401 will log out.
            return this.getUser();
        }
    },

    _storeSession(res, { keepToken = false } = {}) {
        if (!keepToken && res.token) localStorage.setItem('ams_token', res.token);
        if (res.expiresIn) {
            localStorage.setItem('ams_token_exp', String(Date.now() + res.expiresIn * 1000));
        }
        const u = res.user || {};
        const role = res.role || u.role || 'user';
        localStorage.setItem('ams_role', role);
        const defaultName = role === 'admin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่ทั่วไป';
        localStorage.setItem('ams_user_name', res.name || u.name || defaultName);
        localStorage.setItem('ams_position', res.position || u.position || '');
        localStorage.setItem('ams_permissions', JSON.stringify(res.permissions || u.permissions || []));
        localStorage.setItem('ams_user', JSON.stringify(u));
        const mustChange = res.mustChangePassword !== undefined
            ? res.mustChangePassword
            : u.mustChangePassword;
        if (mustChange) localStorage.setItem('ams_must_change_pwd', 'true');
        else localStorage.removeItem('ams_must_change_pwd');
    },

    logout() {
        if (DEV) console.log(`[API] Logout — user: ${this.getUserName()}`);
        SESSION_KEYS.forEach(k => localStorage.removeItem(k));
    },

    isLoggedIn() { return Boolean(localStorage.getItem('ams_token')); },
    getRole() { return localStorage.getItem('ams_role') || 'user'; },
    isAdmin() { return this.getRole() === 'admin'; },
    getUserName() {
        return localStorage.getItem('ams_user_name') ||
               (this.isAdmin() ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่ทั่วไป');
    },

    getUserPosition() {
        const u = this.getUser();
        return localStorage.getItem('ams_position') || u?.position ||
               (this.isAdmin() ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่');
    },

    getUserPermissions() {
        if (this.isAdmin()) return ['*'];
        try {
            const raw = localStorage.getItem('ams_permissions');
            if (raw) return JSON.parse(raw);
            const u = this.getUser();
            if (u?.permissions) {
                return typeof u.permissions === 'string'
                    ? JSON.parse(u.permissions)
                    : u.permissions;
            }
        } catch (e) {
            console.warn('[API] Failed to parse permissions from localStorage:', e.message);
        }
        return [];
    },

    canEdit(module) {
        if (this.isAdmin()) return true;
        const perms = this.getUserPermissions();
        return perms.includes('*') || perms.includes(module);
    },

    getUser() {
        try {
            return JSON.parse(localStorage.getItem('ams_user') || '{}');
        } catch (e) {
            console.warn('[API] Failed to parse ams_user from localStorage:', e.message);
            return {};
        }
    },

    // ── Generic CRUD ───────────────────────────────────────────────────
    async get(entity, params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.request(q ? `${entity}?${q}` : entity);
    },

    async getById(entity, id) {
        if (!id) throw new ApiError(`ไม่ระบุรหัส (id) สำหรับ ${entity}`, 0, {});
        return this.request(`${entity}/${encodeURIComponent(id)}`);
    },

    async create(entity, data) {
        if (!data || typeof data !== 'object') {
            throw new ApiError(`ข้อมูลสำหรับบันทึก ${entity} ไม่ถูกต้อง`, 0, {});
        }
        return this.request(entity, 'POST', data);
    },

    async update(entity, id, data) {
        if (!id) throw new ApiError(`ไม่ระบุรหัส (id) สำหรับแก้ไข ${entity}`, 0, {});
        if (!data || typeof data !== 'object') {
            throw new ApiError(`ข้อมูลสำหรับแก้ไข ${entity} ไม่ถูกต้อง`, 0, {});
        }
        return this.request(`${entity}/${encodeURIComponent(id)}`, 'PUT', data);
    },

    async remove(entity, id) {
        if (!id) throw new ApiError(`ไม่ระบุรหัส (id) สำหรับลบ ${entity}`, 0, {});
        return this.request(`${entity}/${encodeURIComponent(id)}`, 'DELETE');
    },

    /** Bulk import (Excel restore) — one request, written server-side in ordered batches. */
    async bulkImport(payload) {
        return this.request('import', 'POST', payload, { timeoutMs: 120000 });
    },

    // ── Activity logging (fire-and-forget, non-blocking) ───────────────
    log(action, module, details, targetId = null, targetName = null) {
        const logEntry = {
            id: 'log_' + (
                crypto.randomUUID
                    ? crypto.randomUUID()
                    : Date.now() + '_' + Math.random().toString(36).slice(2, 9)
            ),
            action: String(action || 'info').slice(0, 50),
            module: String(module || 'system').slice(0, 50),
            targetId: targetId ? String(targetId).slice(0, 200) : null,
            targetName: targetName ? String(targetName).slice(0, 500) : null,
            details: String(details || '').slice(0, 2000),
            userRole: this.isAdmin() ? 'admin' : (this.getUserPosition() || 'user'),
        };

        this.create('logs', logEntry)
            .then(res => {
                const detail = {
                    ...logEntry,
                    userName: this.getUserName(),
                    createdAt: res?.createdAt || new Date().toISOString()
                };
                window.dispatchEvent(new CustomEvent('app:log-added', { detail }));
                if (DEV) console.log(`[API LOG] ${action}/${module}: ${(details || '').slice(0, 80)}`);
            })
            .catch(e => console.warn(
                `[API] Activity log write failed — action:${action} module:${module}:`,
                e.message
            ));
    }
};

window.API = API;
