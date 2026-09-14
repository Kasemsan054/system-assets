import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.prepare(
      `SELECT id, asset_id as assetId, date, type, vendor, description, status, 
              completed_date as completedDate, created_at as createdAt
       FROM maintenance ORDER BY date DESC`
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

    const id = body.id || `mnt_${Date.now().toString(36)}`;
    if (!body.assetId || !body.type) {
      return NextResponse.json({ success: false, error: 'Asset ID and Type are required' }, { status: 400 });
    }

    await db.prepare(
      `INSERT INTO maintenance (id, asset_id, date, type, vendor, description, status, completed_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      body.assetId,
      body.date || new Date().toISOString().split('T')[0],
      body.type,
      body.vendor || '',
      body.description || '',
      body.status || 'in_progress',
      body.completedDate || null
    ).run();

    // If repair is in progress, update asset status to repair
    if (body.status === 'in_progress') {
      await db.prepare('UPDATE assets SET status = ? WHERE id = ?').bind('repair', body.assetId).run();
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
    const { id, status, completedDate, description, vendor, type } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await db.prepare(
      `UPDATE maintenance SET
        status = COALESCE(?, status),
        completed_date = ?,
        description = COALESCE(?, description),
        vendor = COALESCE(?, vendor),
        type = COALESCE(?, type)
       WHERE id = ?`
    ).bind(status, completedDate !== undefined ? completedDate : null, description, vendor, type, id).run();

    // If finished repair, return asset status to ready
    if (status === 'done') {
      const mnt = await db.prepare('SELECT asset_id FROM maintenance WHERE id = ?').bind(id).first();
      if (mnt && mnt.asset_id) {
        await db.prepare('UPDATE assets SET status = ? WHERE id = ?').bind('ready', mnt.asset_id).run();
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

    await db.prepare('DELETE FROM maintenance WHERE id = ?').bind(id).run();
    return NextResponse.json({ success: true, message: 'Maintenance record deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
