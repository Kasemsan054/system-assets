import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const [categories, departments, employees, assets, assignments, maintenance, settings] = await Promise.all([
      db.prepare('SELECT id, code, name FROM categories ORDER BY code ASC').all(),
      db.prepare('SELECT id, name FROM departments ORDER BY name ASC').all(),
      db.prepare('SELECT id, name, username, password, must_change_password as mustChangePassword, role, position, department_id as department, location, email FROM employees ORDER BY name ASC').all(),
      db.prepare('SELECT id, name, category_id as categoryId, department_id as departmentId, holder_id as holderId, holder_name as holderName, purchase_date as purchaseDate, return_date as returnDate, status, location, vendor, serial, note FROM assets ORDER BY id DESC').all(),
      db.prepare('SELECT id, asset_id as assetId, employee_id as employeeId, department_id as departmentId, date_out as dateOut, date_return as dateReturn, note FROM assignments ORDER BY date_out DESC').all(),
      db.prepare('SELECT id, asset_id as assetId, date, type, vendor, description, status, completed_date as completedDate FROM maintenance ORDER BY date DESC').all(),
      db.prepare('SELECT key, value FROM system_settings').all(),
    ]);

    const settingsMap: Record<string, string> = {};
    settings.results.forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({
      success: true,
      data: {
        categories: categories.results,
        departments: departments.results,
        employees: employees.results.map((e: any) => ({
          ...e,
          mustChangePassword: Boolean(e.mustChangePassword),
        })),
        assets: assets.results,
        assignments: assignments.results,
        maintenance: maintenance.results,
        settings: settingsMap,
      },
    });
  } catch (error: any) {
    console.error('Error fetching database sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();

    // If client sends full database state to push to D1
    if (body.categories && Array.isArray(body.categories)) {
      for (const c of body.categories) {
        await db.prepare('INSERT OR REPLACE INTO categories (id, code, name) VALUES (?, ?, ?)')
          .bind(c.id, c.code, c.name).run();
      }
    }

    if (body.departments && Array.isArray(body.departments)) {
      for (const d of body.departments) {
        await db.prepare('INSERT OR REPLACE INTO departments (id, name) VALUES (?, ?)')
          .bind(d.id, d.name).run();
      }
    }

    if (body.employees && Array.isArray(body.employees)) {
      for (const e of body.employees) {
        await db.prepare('INSERT OR REPLACE INTO employees (id, name, username, password, must_change_password, role, position, department_id, location, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(e.id, e.name, e.username, e.password || '', e.mustChangePassword ? 1 : 0, e.role || 'user', e.position || '', e.department || null, e.location || '', e.email || '').run();
      }
    }

    if (body.assets && Array.isArray(body.assets)) {
      for (const a of body.assets) {
        await db.prepare('INSERT OR REPLACE INTO assets (id, name, category_id, department_id, holder_id, holder_name, purchase_date, return_date, status, location, vendor, serial, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(a.id, a.name, a.categoryId, a.departmentId || null, a.holderId || null, a.holderName || '', a.purchaseDate || '', a.returnDate || null, a.status || 'ready', a.location || '', a.vendor || '', a.serial || '', a.note || '').run();
      }
    }

    if (body.assignments && Array.isArray(body.assignments)) {
      for (const asg of body.assignments) {
        await db.prepare('INSERT OR REPLACE INTO assignments (id, asset_id, employee_id, department_id, date_out, date_return, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(asg.id, asg.assetId, asg.employeeId, asg.departmentId || null, asg.dateOut || '', asg.dateReturn || null, asg.note || '').run();
      }
    }

    if (body.maintenance && Array.isArray(body.maintenance)) {
      for (const m of body.maintenance) {
        await db.prepare('INSERT OR REPLACE INTO maintenance (id, asset_id, date, type, vendor, description, status, completed_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(m.id, m.assetId, m.date || '', m.type || '', m.vendor || '', m.description || '', m.status || 'in_progress', m.completedDate || null).run();
      }
    }

    if (body.settings && typeof body.settings === 'object') {
      for (const [key, value] of Object.entries(body.settings)) {
        await db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
          .bind(key, String(value)).run();
      }
    }

    return NextResponse.json({ success: true, message: 'Database synced successfully' });
  } catch (error: any) {
    console.error('Error syncing database:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
