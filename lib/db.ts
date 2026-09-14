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

let activeDbInstance: D1Database | null = null;

function getCloudflareToken(): string | null {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN;
  }
  try {
    const appData =
      process.env.APPDATA ||
      (process.platform === 'darwin'
        ? path.join(process.env.HOME || '', 'Library/Application Support')
        : path.join(process.env.HOME || '', '.config'));
    const tomlPath = path.join(appData, 'xdg.config', '.wrangler', 'config', 'default.toml');
    if (fs.existsSync(tomlPath)) {
      const content = fs.readFileSync(tomlPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('oauth_token')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            return parts[1].trim().replace(/^["']|["']$/g, '');
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function createCloudflareRemoteDb(accountId: string, databaseId: string, token: string): D1Database {
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
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: query,
              params: boundValues,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(`Cloudflare D1 Query Error: ${JSON.stringify(json.errors || json)}`);
          }
          const data = json.result?.[0];
          return {
            results: (data?.results || []) as T[],
            success: true,
            meta: data?.meta,
          };
        },
        async first<T = any>(colName?: string): Promise<T | null> {
          const res = await this.all<T>();
          if (!res.results || res.results.length === 0) return null;
          const firstRow = res.results[0] as any;
          if (colName) return firstRow[colName] ?? null;
          return firstRow;
        },
        async run(): Promise<{ success: boolean; meta?: any }> {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: query,
              params: boundValues,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(`Cloudflare D1 Run Error: ${JSON.stringify(json.errors || json)}`);
          }
          const data = json.result?.[0];
          return {
            success: true,
            meta: data?.meta,
          };
        },
      };
      return stmtObj;
    },
    async exec(query: string) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: query }),
      });
      return res.json();
    },
  };
}

function createLocalSqliteDb(): D1Database {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite');
  const dbDir = path.join(process.cwd(), 'd1');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'local.sqlite');
  const db = new DatabaseSync(dbPath);

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema if not exists
  const schemaPath = path.join(dbDir, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  // Insert default admin if no employees exist
  const countRow = db.prepare("SELECT COUNT(*) as c FROM employees").get() as { c: number } | undefined;
  if (!countRow || countRow.c === 0) {
    const seedPath = path.join(dbDir, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      db.exec(seedSql);
    }
  }

  return {
    prepare(query: string): D1PreparedStatement {
      let boundValues: any[] = [];
      const stmtObj = {
        bind(...values: any[]) {
          boundValues = values;
          return stmtObj;
        },
        async all<T = any>(): Promise<D1Result<T>> {
          const stmt = db.prepare(query);
          const rows = stmt.all(...boundValues) as T[];
          return {
            results: rows,
            success: true,
          };
        },
        async first<T = any>(colName?: string): Promise<T | null> {
          const stmt = db.prepare(query);
          const row = stmt.get(...boundValues) as any;
          if (!row) return null;
          if (colName) return row[colName] ?? null;
          return row as T;
        },
        async run(): Promise<{ success: boolean; meta?: any }> {
          const stmt = db.prepare(query);
          const result = stmt.run(...boundValues);
          return {
            success: true,
            meta: {
              changes: result.changes,
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
      };
      return stmtObj;
    },
    async exec(query: string) {
      return db.exec(query);
    },
  };
}

/**
 * Initializes and returns a D1-compatible database instance.
 * Priority:
 * 1. Cloudflare Native D1 Binding (Edge runtime / Cloudflare Pages / Workers)
 * 2. Remote Cloudflare D1 via REST API (Using Wrangler OAuth token or API Token)
 * 3. Local SQLite (Fallback for offline development)
 */
export function getDb(): D1Database {
  if (activeDbInstance) {
    return activeDbInstance;
  }

  // 1. Cloudflare Native Binding
  const cloudflareDb = (globalThis as any).DB || (process.env as any).DB;
  if (cloudflareDb && typeof cloudflareDb.prepare === 'function') {
    activeDbInstance = cloudflareDb as D1Database;
    return activeDbInstance;
  }

  // 2. Real Remote Cloudflare D1 via HTTPS API
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '8d2da515314ff1d19f23584184c8e847';
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID || '9b5674d3-c3ae-4121-bfc4-fd5c928a39ad';
  const token = getCloudflareToken();

  if (accountId && databaseId && token) {
    try {
      activeDbInstance = createCloudflareRemoteDb(accountId, databaseId, token);
      return activeDbInstance;
    } catch (err) {
      console.warn('Failed to connect to remote Cloudflare D1, falling back to local SQLite:', err);
    }
  }

  // 3. Local SQLite fallback
  activeDbInstance = createLocalSqliteDb();
  return activeDbInstance;
}
