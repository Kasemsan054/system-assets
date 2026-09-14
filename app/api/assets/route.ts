import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare(
      `SELECT id, name, category_id as categoryId, department_id as departmentId, 
              holder_id as holderId, holder_name as holderName, purchase_date as purchaseDate, 
              return_date as returnDate, status, location, vendor, serial, note, created_at as createdAt
       FROM assets ORDER BY id DESC`
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

    const id = body.id || `ast_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    await db.prepare(
      `INSERT INTO assets (id, name, category_id, department_id, holder_id, holder_name, purchase_date, return_date, status, location, vendor, serial, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      name,
      body.categoryId || 'cat_it',
      body.departmentId || null,
      body.holderId || null,
      body.holderName || '',
      body.purchaseDate || new Date().toISOString().split('T')[0],
      body.returnDate || null,
      body.status || 'ready',
      body.location || '',
      body.vendor || '',
      body.serial || '',
      body.note || ''
    ).run();

    return NextResponse.json({ success: true, data: { id, ...body } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
