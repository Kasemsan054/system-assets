/* ---------------------------- Data Cache Layer ---------------------------- */
// In-memory cache for reference data fetched from the API.
// Retry logic added: syncDB will retry once on failure after a 2s delay.

let DB = {
  orgName: 'องค์กรของคุณ',
  orgSub: '',
  categories: [],
  departments: [],
  employees: [],
  // assets, assignments, maintenance are fetched per-page in views, but cached here for helpers
  assets: [],
  assignments: [],
  maintenance: [],
  seq: {},
  _bootstrapped: false,
  _lastSyncAt: null,
  _syncErrors: [],   // Track which endpoints failed for better diagnostics
};

// ── syncDB with retry ───────────────────────────────────────────────────────
async function syncDB(attempt = 1) {
  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 2000;

  DB._syncErrors = []; // Reset on each sync attempt

  // Not logged in (login page): only the public branding settings are reachable.
  if (!API.isLoggedIn()) {
    try {
      const s = await API.get('settings');
      DB.orgName = s.orgName || 'องค์กรของคุณ';
      DB.orgSub  = s.orgSub  || '';
    } catch (e) {
      console.warn('[syncDB] Could not load branding settings:', e.message);
    }
    return true;
  }

  const endpoints = ['categories', 'departments', 'employees', 'settings'];

  // Fetch all in parallel — one slow endpoint won't block others
  const settled = await Promise.allSettled([
    API.get('categories', { limit: 1000 }),
    API.get('departments', { limit: 1000 }),
    API.get('employees', { limit: 1000 }),
    API.get('settings')
  ]);

  // Session was rejected mid-sync (token expired / user removed) — API redirected to login.
  if (!API.isLoggedIn()) return false;

  let anyFailed = false;

  settled.forEach((result, i) => {
    const endpointName = endpoints[i];
    if (result.status === 'fulfilled') {
      const data = result.value;
      if (endpointName === 'categories')  DB.categories  = data.data || [];
      if (endpointName === 'departments') DB.departments = data.data || [];
      if (endpointName === 'employees')   DB.employees   = data.data || [];
      if (endpointName === 'settings') {
        DB.orgName = data.orgName || 'องค์กรของคุณ';
        DB.orgSub  = data.orgSub  || '';
      }
    } else {
      // Log exactly which endpoint failed and why — not just a generic error
      console.error(
        `[syncDB] ❌ Failed to fetch '${endpointName}' (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        result.reason?.message || result.reason
      );
      DB._syncErrors.push({
        endpoint: endpointName,
        error: result.reason?.message || String(result.reason)
      });
      anyFailed = true;
    }
  });

  // Retry once if any endpoint failed — handles transient network issues
  if (anyFailed && attempt < MAX_ATTEMPTS) {
    console.warn(
      `[syncDB] ⚠️ Some endpoints failed — retrying in ${RETRY_DELAY_MS}ms... ` +
      `(attempt ${attempt + 1}/${MAX_ATTEMPTS})`
    );
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    return syncDB(attempt + 1);
  }

  if (anyFailed) {
    const failedList = DB._syncErrors.map(e => `'${e.endpoint}'`).join(', ');
    const errorMsg = `ไม่สามารถดึงข้อมูลบางส่วนได้ (${failedList}) กรุณาตรวจสอบการเชื่อมต่อ`;
    console.error('[syncDB] ❌ Sync failed after max retries. Failed endpoints:', DB._syncErrors);
    if (typeof toast === 'function') toast(errorMsg, true);
    // Still mark bootstrapped if we got at least partial data — app should still work
    if (DB.categories.length > 0 || DB.departments.length > 0 || DB.employees.length > 0) {
      DB._bootstrapped = true;
    }
    return false; // Indicate partial/failed sync to caller
  }

  DB._bootstrapped = true;
  DB._lastSyncAt = new Date();
  if (window.APP_DEV) {
    console.log(
      `[syncDB] ✅ Sync complete — categories:${DB.categories.length}, ` +
      `departments:${DB.departments.length}, employees:${DB.employees.length}`
    );
  }
  return true; // Full success
}

// Helpers that remain synchronous are in utils.js

function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }

function thaiYear(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.getFullYear() + 543;
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function fmtDate(dStr) {
  if (!dStr) return '-';
  const d = new Date(dStr);
  if (isNaN(d)) return '-';
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function fmtDateTime(dStr) {
  if (!dStr) return '-';
  const d = new Date(dStr);
  if (isNaN(d)) return '-';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${h}:${m} น.`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return '-';
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 45) return 'เมื่อสักครู่';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชั่วโมงที่แล้ว`;
  if (diffSec < 172800) return 'เมื่อวานนี้';
  return fmtDate(dateStr);
}

function fmtMoney(n) {
  n = Number(n) || 0;
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s).replace(/[&<>"']/g, c => map[c]);
}