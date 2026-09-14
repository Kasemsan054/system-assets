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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite');
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

/**
 * Returns a D1-compatible DB instance. Priority:
 * 1. Cloudflare native D1 binding (Workers / Pages edge runtime)
 * 2. Remote Cloudflare D1 via REST API (Node.js dev, with Wrangler token)
 * 3. Local SQLite via node:sqlite (offline fallback)
 *
 * Accepts an optional `envBinding` so API routes can pass `env.DB` directly.
 */
export function getDb(envBinding?: D1Database): D1Database {
  // 1. Passed-in binding from Cloudflare runtime context
  if (envBinding && typeof (envBinding as any).prepare === 'function') {
    return envBinding;
  }

  // 2. globalThis.DB (edge runtime)
  const global = (globalThis as any).DB;
  if (global && typeof global.prepare === 'function') return global as D1Database;

  // 3. Remote REST API (Node.js dev with Wrangler token)
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '8d2da515314ff1d19f23584184c8e847';
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID || '9b5674d3-c3ae-4121-bfc4-fd5c928a39ad';
  const token = getWranglerToken();

  if (token) {
    return createCloudflareRemoteDb(accountId, databaseId, token);
  }

  // 4. Local SQLite fallback
  if (!_localInstance) _localInstance = createLocalSqliteDb();
  return _localInstance;
}
