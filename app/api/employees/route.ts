import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare(
      `SELECT id, name, username, password, must_change_password as mustChangePassword, 
              role, position, department_id as department, location, created_at as createdAt
       FROM employees ORDER BY name ASC`
    ).all();

    return NextResponse.json({
      success: true,
      data: result.results.map((e: any) => ({
        ...e,
        departmentId: e.department,
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

    const deptVal = body.department ?? body.departmentId ?? body.department_id ?? null;
    const pwd = body.password ? await hashPassword(body.password) : '';

    await db.prepare(
      `INSERT INTO employees (id, name, username, password, must_change_password, role, position, department_id, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      name,
      username,
      pwd,
      body.mustChangePassword ? 1 : 0,
      body.role || 'user',
      body.position || '',
      deptVal,
      body.location || ''
    ).run();

    return NextResponse.json({
      success: true,
      data: {
        id,
        name,
        username,
        role: body.role || 'user',
        position: body.position || '',
        department: deptVal,
        departmentId: deptVal,
        location: body.location || '',
        mustChangePassword: Boolean(body.mustChangePassword),
      },
    });
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

    const fields: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      fields.push('name = ?');
      values.push(body.name?.trim() || '');
    }
    if (body.username !== undefined) {
      fields.push('username = ?');
      values.push(body.username?.trim() || '');
    }
    if (body.password !== undefined) {
      const hashed = await hashPassword(body.password);
      fields.push('password = ?');
      values.push(hashed);
    }
    if (body.mustChangePassword !== undefined) {
      fields.push('must_change_password = ?');
      values.push(body.mustChangePassword ? 1 : 0);
    }
    if (body.role !== undefined) {
      fields.push('role = ?');
      values.push(body.role);
    }
    if (body.position !== undefined) {
      fields.push('position = ?');
      values.push(body.position);
    }

    const deptVal = body.department !== undefined ? body.department : (body.departmentId !== undefined ? body.departmentId : body.department_id);
    if (deptVal !== undefined) {
      fields.push('department_id = ?');
      values.push(deptVal || null);
    }

    if (body.location !== undefined) {
      fields.push('location = ?');
      values.push(body.location);
    }

    if (fields.length > 0) {
      values.push(id);
      await db.prepare(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    }

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
