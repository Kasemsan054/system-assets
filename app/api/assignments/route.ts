import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare(
      `SELECT id, asset_id as assetId, employee_id as employeeId, department_id as departmentId, 
              date_out as dateOut, date_return as dateReturn, note, created_at as createdAt
       FROM assignments ORDER BY date_out DESC`
    ).all();

    return NextResponse.json({ success: true, data: result.results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = body.id || `asg_${Date.now().toString(36)}`;
    if (!body.assetId || !body.employeeId) {
      return NextResponse.json({ success: false, error: 'Asset ID and Employee ID are required' }, { status: 400 });
    }

    await db.prepare(
      `INSERT INTO assignments (id, asset_id, employee_id, department_id, date_out, date_return, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.assetId,
      body.employeeId,
      body.departmentId || null,
      body.dateOut || new Date().toISOString().split('T')[0],
      body.dateReturn || null,
      body.note || ''
    ).run();

    // If new assignment and returnDate is null, update asset holder
    if (!body.dateReturn) {
      await db.prepare('UPDATE assets SET holder_id = ?, status = ? WHERE id = ?')
        .bind(body.employeeId, 'issued', body.assetId).run();
    }

    return NextResponse.json({ success: true, data: { id, ...body } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, dateReturn, note } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await db.prepare(
      `UPDATE assignments SET
        date_return = COALESCE(?, date_return),
        note = COALESCE(?, note)
       WHERE id = ?`
    ).bind(dateReturn, note, id).run();

    // If returning assignment, clear asset holder
    if (dateReturn) {
      const asg = await db.prepare('SELECT asset_id FROM assignments WHERE id = ?').bind(id).first();
      if (asg && asg.asset_id) {
        await db.prepare('UPDATE assets SET holder_id = NULL, status = ? WHERE id = ?')
          .bind('ready', asg.asset_id).run();
      }
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

    await db.prepare('DELETE FROM assignments WHERE id = ?').bind(id).run();
    return NextResponse.json({ success: true, message: 'Assignment deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
