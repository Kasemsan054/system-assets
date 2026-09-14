import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare('SELECT id, code, name FROM categories ORDER BY code ASC').all();
    return NextResponse.json({ success: true, data: result.results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = body.id || `cat_${Date.now().toString(36)}`;
    const code = body.code?.trim().toUpperCase();
    const name = body.name?.trim();

    if (!code || !name) {
      return NextResponse.json({ success: false, error: 'Code and Name are required' }, { status: 400 });
    }

    await db.prepare('INSERT INTO categories (id, code, name) VALUES (?, ?, ?)')
      .bind(id, code, name).run();

    return NextResponse.json({ success: true, data: { id, code, name } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, code, name } = body;

    if (!id || !code || !name) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    await db.prepare('UPDATE categories SET code = ?, name = ? WHERE id = ?')
      .bind(code.trim().toUpperCase(), name.trim(), id).run();

    return NextResponse.json({ success: true, data: { id, code, name } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
