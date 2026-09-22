// functions/api/dashboard/index.js — Dashboard summary (single round-trip via D1 batch)

import { json } from '../../_lib/response.js';
import { requireAuth } from '../../_lib/auth.js';

export async function onRequestGet(context) {
    const { env } = context;
    await requireAuth(context);

    // Counts are aggregated in SQL (GROUP BY) instead of shipping every asset row to the
    // client — one batch = one round-trip, and the payload stays tiny as the registry grows.
    const [statusAgg, catAgg, totalRow, categories, recentAssignments, recentMaintenance, dueMaintenance, recentLogs] = await env.DB.batch([
        env.DB.prepare('SELECT status, COUNT(*) AS count FROM Assets GROUP BY status'),
        env.DB.prepare("SELECT categoryId, COUNT(*) AS count FROM Assets WHERE status != 'broken' GROUP BY categoryId"),
        env.DB.prepare('SELECT COUNT(*) AS total FROM Assets'),
        env.DB.prepare('SELECT id, name FROM Categories'),
        env.DB.prepare('SELECT * FROM Assignments ORDER BY dateOut DESC LIMIT 5'),
        env.DB.prepare('SELECT * FROM Maintenance ORDER BY date DESC LIMIT 3'),
        env.DB.prepare("SELECT * FROM Maintenance WHERE status = 'in_progress' ORDER BY date ASC LIMIT 50"),
        env.DB.prepare("SELECT * FROM ActivityLogs WHERE action != 'login' AND module != 'auth' ORDER BY createdAt DESC LIMIT 20"),
    ]);

    const statusCounts = {};
    for (const r of statusAgg.results) statusCounts[r.status || 'ready'] = r.count;

    const categoryCounts = {}; // excludes 'broken' assets, matching the dashboard's "by category" chart
    for (const r of catAgg.results) if (r.categoryId) categoryCounts[r.categoryId] = r.count;

    return json({
        totalAssets: totalRow.results[0]?.total || 0,
        statusCounts,
        categoryCounts,
        categories: categories.results,
        recentAssignments: recentAssignments.results,
        recentMaintenance: recentMaintenance.results,
        dueMaintenance: dueMaintenance.results,
        recentLogs: recentLogs.results,
        generatedAt: new Date().toISOString(),
    });
}
