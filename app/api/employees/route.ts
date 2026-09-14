import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare(
      `SELECT id, name, username, password, must_change_password as mustChangePassword, 
              role, position, department_id as department, location, email, created_at as createdAt
       FROM employees ORDER BY name ASC`
    ).all();

    return NextResponse.json({
      success: true,
      data: result.results.map((e: any) => ({
        ...e,
        mustChangePassword: Boolean(e.mustChangePassword),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = body.id || `emp_${Date.now().toString(36)}`;
    const name = body.name?.trim();
    const username = body.username?.trim();

    if (!name || !username) {
      return NextResponse.json({ success: false, error: 'Name and Username are required' }, { status: 400 });
    }

    await db.prepare(
      `INSERT INTO employees (id, name, username, password, must_change_password, role, position, department_id, location, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      name,
      username,
      body.password || '',
      body.mustChangePassword ? 1 : 0,
      body.role || 'user',
      body.position || '',
      body.department || null,
      body.location || '',
      body.email || ''
    ).run();

    return NextResponse.json({ success: true, data: { id, ...body } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await db.prepare(
      `UPDATE employees SET
        name = COALESCE(?, name),
        username = COALESCE(?, username),
        password = COALESCE(?, password),
        must_change_password = COALESCE(?, must_change_password),
        role = COALESCE(?, role),
        position = COALESCE(?, position),
        department_id = COALESCE(?, department_id),
        location = COALESCE(?, location),
        email = COALESCE(?, email)
       WHERE id = ?`
    ).bind(
      body.name,
      body.username,
      body.password,
      body.mustChangePassword !== undefined ? (body.mustChangePassword ? 1 : 0) : null,
      body.role,
      body.position,
      body.department,
      body.location,
      body.email,
      id
    ).run();

    return NextResponse.json({ success: true, data: { ...body } });
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

    await db.prepare('DELETE FROM employees WHERE id = ?').bind(id).run();
    return NextResponse.json({ success: true, message: 'Employee deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
