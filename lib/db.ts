import path from 'path';
import fs from 'fs';

// D1-compatible interface
export interface D1Result<T = any> {
  results: T[];
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = any>(): Promise<D1Result<T>>;
  first<T = any>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<any>;
  batch?(statements: D1PreparedStatement[]): Promise<any[]>;
}

// ── Helper: read Wrangler OAuth token from local config file ──────────────────
function getWranglerToken(): string | null {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  try {
    const appData =
      process.env.APPDATA ||
      (process.platform === 'darwin'
        ? `${process.env.HOME}/Library/Application Support`
        : `${process.env.HOME}/.config`);
    const tomlPath = `${appData}/xdg.config/.wrangler/config/default.toml`;
    if (fs.existsSync(tomlPath)) {
      const content = fs.readFileSync(tomlPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('oauth_token')) {
          const eq = trimmed.indexOf('=');
          if (eq !== -1) {
            return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
          }
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ── Cloudflare D1 REST API wrapper (Node.js dev mode) ─────────────────────────
function createCloudflareRemoteDb(
  accountId: string,
  databaseId: string,
  token: string,
): D1Database {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  return {
    prepare(query: string): D1PreparedStatement {
      let boundValues: any[] = [];
      const stmtObj: D1PreparedStatement = {
        bind(...values: any[]) {
          boundValues = values;
          return stmtObj;
        },
        async all<T = any>(): Promise<D1Result<T>> {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql: query, params: boundValues }),
          });
          const json = await res.json() as any;
          if (!res.ok || !json.success)
            throw new Error(`D1 query error: ${JSON.stringify(json.errors || json)}`);
          const data = json.result?.[0];
          return { results: (data?.results || []) as T[], success: true, meta: data?.meta };
        },
        async first<T = any>(colName?: string): Promise<T | null> {
          const res = await stmtObj.all<T>();
          if (!res.results?.length) return null;
          const row = res.results[0] as any;
          return colName ? (row[colName] ?? null) : (row as T);
        },
        async run(): Promise<{ success: boolean; meta?: any }> {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql: query, params: boundValues }),
          });
          const json = await res.json() as any;
          if (!res.ok || !json.success)
            throw new Error(`D1 run error: ${JSON.stringify(json.errors || json)}`);
          return { success: true, meta: json.result?.[0]?.meta };
        },
      };
      return stmtObj;
    },
    async exec(query: string) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: query }),
      });
      return res.json();
    },
  };
}

// ── Local SQLite fallback (Node.js only) ─────────────────────────────────────
function createLocalSqliteDb(): D1Database {
  let DatabaseSync: any;
  try {
    const mod = 'node:' + 'sqlite';
    const req = typeof require !== 'undefined' ? require : null;
    if (req) DatabaseSync = req(mod).DatabaseSync;
  } catch {
    // node:sqlite not available or in edge/workers
  }

  if (!DatabaseSync) {
    throw new Error('Database is not available in this environment (Cloudflare D1 binding "DB" missing)');
  }

  const dbDir = path.join(process.cwd(), 'd1');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db = new DatabaseSync(path.join(dbDir, 'local.sqlite'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaPath = path.join(dbDir, 'schema.sql');
  if (fs.existsSync(schemaPath)) db.exec(fs.readFileSync(schemaPath, 'utf8'));

  const countRow = db.prepare('SELECT COUNT(*) as c FROM employees').get() as { c: number } | undefined;
  if (!countRow || countRow.c === 0) {
    const seedPath = path.join(dbDir, 'seed.sql');
    if (fs.existsSync(seedPath)) db.exec(fs.readFileSync(seedPath, 'utf8'));
  }

  return {
    prepare(query: string): D1PreparedStatement {
      let boundValues: any[] = [];
      const stmtObj = {
        bind(...values: any[]) { boundValues = values; return stmtObj; },
        async all<T = any>(): Promise<D1Result<T>> {
          const rows = db.prepare(query).all(...boundValues) as T[];
          return { results: rows, success: true };
        },
        async first<T = any>(colName?: string): Promise<T | null> {
          const row = db.prepare(query).get(...boundValues) as any;
          if (!row) return null;
          return colName ? (row[colName] ?? null) : (row as T);
        },
        async run(): Promise<{ success: boolean; meta?: any }> {
          const result = db.prepare(query).run(...boundValues);
          return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
        },
      };
      return stmtObj;
    },
    async exec(query: string) { return db.exec(query); },
  };
}

let _localInstance: D1Database | null = null;

/** SQL DDL for all tables — used by ensureTables() to self-heal missing schema */
const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT,
  must_change_password INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  position TEXT,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  holder_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  holder_name TEXT,
  purchase_date TEXT,
  return_date TEXT,
  status TEXT DEFAULT 'ready',
  location TEXT,
  vendor TEXT,
  serial TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  department_id TEXT,
  date_out TEXT NOT NULL,
  date_return TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS maintenance (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  vendor TEXT,
  description TEXT,
  status TEXT DEFAULT 'in_progress',
  completed_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_holder ON assets(holder_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_assignments_emp ON assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance(asset_id);
`;

const SEED_SQL = `
INSERT OR IGNORE INTO system_settings (key, value) VALUES
  ('orgName', 'บริษัท ควอนตัม ซิสเต็ม โพรเทคชั่น จำกัด'),
  ('orgSub', 'ระบบทะเบียนคุมทรัพย์สินและครุภัณฑ์ (Asset Registry)'),
  ('adminPin', '1234');
INSERT OR IGNORE INTO employees (id, name, username, password, must_change_password, role, position, location) VALUES
  ('emp_admin_system', 'ผู้ดูแลระบบ (Admin)', 'admin', 'ad6e58a3d80fee65064e90519d4effd7d7288157b2305d2b5472143947d6a421', 0, 'admin', 'ผู้ดูแลระบบสารสนเทศ', 'ศูนย์คอมพิวเตอร์');
`;

let _tablesEnsured = false;

/**
 * Ensures all required tables exist in the DB.
 * Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS.
 * Call this once per request from any API route that touches D1.
 */
export async function ensureTables(db: D1Database): Promise<void> {
  if (_tablesEnsured) return;
  try {
    // D1 exec doesn't support multiple statements; split on semicolons
    const stmts = SCHEMA_DDL.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      await db.prepare(stmt).run();
    }
    // Seed defaults if settings is empty
    try {
      const row = await db.prepare('SELECT COUNT(*) as cnt FROM system_settings').first<{ cnt: number }>();
      if (!row || row.cnt === 0) {
        const seedStmts = SEED_SQL.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of seedStmts) {
          await db.prepare(stmt).run();
        }
      }
    } catch { /* ignore seed errors */ }
    _tablesEnsured = true;
  } catch (e: any) {
    // Non-fatal: tables may already exist in Cloudflare D1 which doesn't support all DDL
    console.warn('[ensureTables] warning:', e?.message);
  }
}

/**
 * Returns a D1-compatible DB instance. Priority:
 * 1. Cloudflare native D1 binding (Workers / Pages edge runtime)
 * 2. OpenNext Cloudflare context binding (via Symbol.for('__cloudflare-context__'))
 * 3. Remote Cloudflare D1 via REST API (Node.js dev, with Wrangler token)
 * 4. Local SQLite via node:sqlite (offline fallback)
 *
 * Accepts an optional `envBinding` so API routes can pass `env.DB` directly.
 */
export function getDb(envBinding?: D1Database): D1Database {
  // 1. Passed-in binding from Cloudflare runtime context
  if (envBinding && typeof (envBinding as any).prepare === 'function') {
    return envBinding;
  }

  // 2. OpenNext Cloudflare context
  try {
    const cfContext = (globalThis as any)[Symbol.for('__cloudflare-context__')];
    if (cfContext?.env?.DB && typeof cfContext.env.DB.prepare === 'function') {
      return cfContext.env.DB as D1Database;
    }
  } catch { /* ignore */ }

  // 3. globalThis.DB or process.env.DB (edge runtime)
  const global = (globalThis as any).DB || (process.env as any).DB;
  if (global && typeof global.prepare === 'function') return global as D1Database;

  // 4. Remote REST API (Node.js dev with Wrangler token)
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '8d2da515314ff1d19f23584184c8e847';
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID || '9b5674d3-c3ae-4121-bfc4-fd5c928a39ad';
  const token = getWranglerToken();

  // ข้ามการต่อ Cloudflare D1 หากอยู่ในโหมดพัฒนา (กันปัญหา Token หมดอายุ)
  if (token && process.env.NODE_ENV === 'production') {
    return createCloudflareRemoteDb(accountId, databaseId, token);
  }

  // 5. Local SQLite fallback
  if (!_localInstance) _localInstance = createLocalSqliteDb();
  return _localInstance;
}
