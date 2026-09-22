// functions/api/assets/[id].js — Asset item (GET, PUT, DELETE)
//  PUT is also allowed for 'assignments' / 'maintenance' holders because those flows
//  update holderId / status on the asset. DELETE requires the 'assets' permission.

import { json, ok, notFound } from '../../_lib/response.js';
import { requireAuth, requirePermission } from '../../_lib/auth.js';
import { readJson, buildUpdate } from '../../_lib/validate.js';
import { sanitizeAssetFields } from '../../_lib/models.js';

export async function onRequestGet(context) {
    const { env, params } = context;
    await requireAuth(context);

    const asset = await env.DB.prepare('SELECT * FROM Assets WHERE id = ?').bind(params.id).first();
    if (!asset) return notFound(`ไม่พบข้อมูลทรัพย์สินรหัส '${params.id}'`);
    return json(asset);
}

export async function onRequestPut(context) {
    const { env, request, params } = context;
    const user = await requirePermission(context, ['assets', 'assignments', 'maintenance'], 'ตำแหน่งของคุณไม่มีสิทธิ์แก้ไขข้อมูลทรัพย์สิน');

    const existing = await env.DB.prepare('SELECT id FROM Assets WHERE id = ?').bind(params.id).first();
    if (!existing) return notFound(`ไม่พบข้อมูลทรัพย์สินรหัส '${params.id}'`);

    const data = await readJson(request);
    const fields = sanitizeAssetFields(data);
    const q = buildUpdate('Assets', fields, params.id);
    if (!q) return ok({ message: 'ไม่มีข้อมูลให้อัปเดต', updated: [] });

    await env.DB.prepare(q.sql).bind(...q.values).run();

    // Auto-sync Assignments table when holder changes
    if (fields.holderId !== undefined || fields.holderName !== undefined) {
        const hasNewHolder = Boolean((fields.holderId && fields.holderId.trim()) || (fields.holderName && fields.holderName.trim()));
        const openAsg = await env.DB.prepare(
            "SELECT id, employeeId, holderName FROM Assignments WHERE assetId = ? AND (dateReturn IS NULL OR dateReturn = '')"
        ).bind(params.id).first();

        if (hasNewHolder) {
            const hId = (fields.holderId && fields.holderId.trim()) || null;
            const hName = hId ? null : ((fields.holderName && fields.holderName.trim()) || null);
            const deptId = fields.departmentId || existing.departmentId || null;
            const dateOut = fields.purchaseDate || existing.purchaseDate || new Date().toISOString().slice(0, 10);
            const note = fields.status === 'borrowed' ? 'ยืมใช้งาน' : 'เบิกใช้งาน';

            if (!openAsg) {
                const asgId = 'asg_' + crypto.randomUUID().slice(0, 12).replace(/-/g, '');
                await env.DB.prepare(
                    "INSERT INTO Assignments (id, assetId, employeeId, departmentId, holderName, dateOut, dateReturn, note) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)"
                ).bind(asgId, params.id, hId, deptId, hName, dateOut, note).run();
            } else if (openAsg.employeeId !== hId || openAsg.holderName !== hName) {
                await env.DB.prepare(
                    "UPDATE Assignments SET employeeId = ?, holderName = ?, departmentId = COALESCE(?, departmentId) WHERE id = ?"
                ).bind(hId, hName, deptId, openAsg.id).run();
            }
        } else if (openAsg) {
            // Holder cleared -> close open assignment
            const returnDate = fields.returnDate || new Date().toISOString().slice(0, 10);
            await env.DB.prepare(
                "UPDATE Assignments SET dateReturn = ? WHERE id = ?"
            ).bind(returnDate, openAsg.id).run();
        }
    }

    console.log(`[assets/[id]:PUT] '${user.username}' updated asset ${params.id} (${Object.keys(fields).join(', ')})`);
    return ok({ updated: Object.keys(fields) });
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const user = await requirePermission(context, 'assets', 'ตำแหน่งของคุณไม่มีสิทธิ์ลบทรัพย์สิน');

    const existing = await env.DB.prepare('SELECT id, name FROM Assets WHERE id = ?').bind(params.id).first();
    if (!existing) return notFound(`ไม่พบข้อมูลทรัพย์สินรหัส '${params.id}'`);

    // Atomic cascade: asset + its assignment and maintenance history
    await env.DB.batch([
        env.DB.prepare('DELETE FROM Assignments WHERE assetId = ?').bind(params.id),
        env.DB.prepare('DELETE FROM Maintenance WHERE assetId = ?').bind(params.id),
        env.DB.prepare('DELETE FROM Assets WHERE id = ?').bind(params.id),
    ]);

    console.log(`[assets/[id]:DELETE] '${user.username}' deleted asset ${params.id} (${existing.name}) with history`);
    return ok();
}
