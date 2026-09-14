import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare('SELECT id, name FROM departments ORDER BY name ASC').all();
    return NextResponse.json({ success: true, data: result.results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = body.id || `dep_${Date.now().toString(36)}`;
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    await db.prepare('INSERT INTO departments (id, name) VALUES (?, ?)').bind(id, name).run();
    return NextResponse.json({ success: true, data: { id, name } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, name } = body;

    if (!id || !name?.trim()) {
      return NextResponse.json({ success: false, error: 'ID and Name are required' }, { status: 400 });
    }

    await db.prepare('UPDATE departments SET name = ? WHERE id = ?').bind(name.trim(), id).run();
    return NextResponse.json({ success: true, data: { id, name: name.trim() } });
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

    await db.prepare('DELETE FROM departments WHERE id = ?').bind(id).run();
    return NextResponse.json({ success: true, message: 'Department deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
