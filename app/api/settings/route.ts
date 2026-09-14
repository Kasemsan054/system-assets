import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare('SELECT key, value FROM system_settings').all();
    const settings: Record<string, string> = {};
    result.results.forEach((r: any) => {
      settings[r.key] = r.value;
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    for (const [key, value] of Object.entries(body)) {
      await db.prepare(
        'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
      ).bind(key, String(value)).run();
    }

    return NextResponse.json({ success: true, message: 'Settings saved' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
