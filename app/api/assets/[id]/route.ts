import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();

    const asset = await db.prepare(
      `SELECT id, name, category_id as categoryId, department_id as departmentId, 
              holder_id as holderId, holder_name as holderName, purchase_date as purchaseDate, 
              return_date as returnDate, status, location, vendor, serial, note, created_at as createdAt
       FROM assets WHERE id = ?`
    ).bind(id).first();

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const [assignments, maintenance] = await Promise.all([
      db.prepare('SELECT id, asset_id as assetId, employee_id as employeeId, department_id as departmentId, date_out as dateOut, date_return as dateReturn, note FROM assignments WHERE asset_id = ? ORDER BY date_out DESC').bind(id).all(),
      db.prepare('SELECT id, asset_id as assetId, date, type, vendor, description, status, completed_date as completedDate FROM maintenance WHERE asset_id = ? ORDER BY date DESC').bind(id).all(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...asset,
        assignments: assignments.results,
        maintenance: maintenance.results,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await req.json();

    await db.prepare(
      `UPDATE assets SET
        name = COALESCE(?, name),
        category_id = COALESCE(?, category_id),
        department_id = COALESCE(?, department_id),
        holder_id = ?,
        holder_name = ?,
        purchase_date = COALESCE(?, purchase_date),
        return_date = ?,
        status = COALESCE(?, status),
        location = COALESCE(?, location),
        vendor = COALESCE(?, vendor),
        serial = COALESCE(?, serial),
        note = COALESCE(?, note)
       WHERE id = ?`
    ).bind(
      body.name,
      body.categoryId,
      body.departmentId,
      body.holderId !== undefined ? body.holderId : null,
      body.holderName !== undefined ? body.holderName : '',
      body.purchaseDate,
      body.returnDate !== undefined ? body.returnDate : null,
      body.status,
      body.location,
      body.vendor,
      body.serial,
      body.note,
      id
    ).run();

    return NextResponse.json({ success: true, data: { id, ...body } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();

    await db.prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
    return NextResponse.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
