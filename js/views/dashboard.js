/* ---------------------------- DASHBOARD VIEW ---------------------------- */
async function renderDashboard(view, silent = false) {
  setHeader('หน้าหลัก', 'แดชบอร์ดภาพรวมทรัพย์สิน');
  
  if (!silent) {
    // Only show loading if not silent
    const currentContent = view.querySelector('#dashboardContainer');
    if (!currentContent) {
      view.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--ink-500);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" class="spinner">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg> กำลังโหลดข้อมูล...
        </div>`;
    }
  }

  let dashData;
  try {
    dashData = await API.get('dashboard');
  } catch (err) {
    if (!silent) {
      view.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--red-700);">
          เกิดข้อผิดพลาดในการดึงข้อมูลแดชบอร์ด: ${escapeHtml(err.message)}
        </div>`;
    }
    return;
  }
  
  // Server sends pre-aggregated counts (statusCounts/categoryCounts/totalAssets).
  // Fall back to counting a raw asset array if an older payload shape is ever returned.
  const rawAssets = dashData.assets || null;
  const statusMap = dashData.statusCounts ||
    (rawAssets ? rawAssets.reduce((m, a) => { m[a.status] = (m[a.status] || 0) + 1; return m; }, {}) : {});
  const statusAt = k => statusMap[k] || 0;

  const totalAssets = (dashData.totalAssets != null)
    ? dashData.totalAssets
    : (rawAssets ? rawAssets.length : Object.values(statusMap).reduce((s, n) => s + n, 0));
  const readyCount = statusAt('ready');
  const issuedCount = statusAt('issued');
  const repairCount = statusAt('repair');

  const catCountMap = dashData.categoryCounts ||
    (rawAssets ? rawAssets.reduce((m, a) => {
      if (a.status !== 'broken' && a.categoryId) m[a.categoryId] = (m[a.categoryId] || 0) + 1;
      return m;
    }, {}) : {});
  const byCategory = (dashData.categories || []).map(c => ({
    name: c.name,
    count: catCountMap[c.id] || 0
  })).sort((a, b) => b.count - a.count);
  const maxCat = Math.max(1, ...byCategory.map(c => c.count));

  // Build the donut from STATUS_LABELS so every backend status is represented (and stays in sync).
  const statusCounts = Object.entries(STATUS_LABELS)
    .map(([key, meta]) => ({ key, label: meta.label, color: meta.color || '#8590a0', count: statusAt(key) }))
    .filter(s => s.count > 0);

  const totalForDonut = statusCounts.reduce((s, x) => s + x.count, 0) || 1;
  let acc = 0;
  const gradParts = statusCounts.map(s => {
    const start = acc / totalForDonut * 360;
    acc += s.count;
    const end = acc / totalForDonut * 360;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(', ');

  // Build rich activity logs (excluding login events)
  const recentActivity = [];
  if (dashData.recentLogs && dashData.recentLogs.length > 0) {
    const nonLoginLogs = dashData.recentLogs.filter(
      l => l.action !== 'login' && l.module !== 'auth'
    );
    nonLoginLogs.forEach(l => {
      let icon = ICONS.check;
      let dotBg = 'var(--navy-800)';
      
      if (l.action === 'delete') {
        icon = ICONS.trash;
        dotBg = 'var(--red-600)';
      } else if (l.action === 'repair' || l.action === 'complete_repair' ||
                 l.module === 'maintenance') {
        icon = ICONS.wrench;
        dotBg = 'var(--amber-600)';
      } else if (l.action === 'assign' || l.action === 'return' ||
                 l.module === 'assignments') {
        icon = ICONS.assign;
        dotBg = 'var(--blue-600)';
      } else if (l.action === 'create' || l.module === 'assets') {
        icon = ICONS.assets;
        dotBg = 'var(--green-600)';
      } else if (l.module === 'system' || l.module === 'settings') {
        icon = ICONS.settings;
        dotBg = 'var(--navy-700)';
      }

      recentActivity.push({
        date: l.createdAt,
        text: l.details || `${l.action} ${l.targetName || ''}`,
        userName: l.userName || 'ระบบ',
        userRole: l.userRole || '',
        icon,
        dotBg
      });
    });
  } else {
    // Fallback to legacy assignments and maintenance
    (dashData.recentAssignments || []).forEach(a => {
      recentActivity.push({
        date: a.dateOut,
        text: `มอบหมายทรัพย์สิน (${a.assetId}) ให้บุคลากร (${a.employeeId})`,
        userName: 'เจ้าหน้าที่',
        icon: ICONS.assign,
        dotBg: 'var(--blue-600)'
      });
    });
    (dashData.recentMaintenance || []).forEach(m => {
      recentActivity.push({
        date: m.date,
        text: `แจ้งซ่อมทรัพย์สิน (${m.assetId}) — ${m.type}`,
        userName: 'ฝ่ายซ่อมบำรุง',
        icon: ICONS.wrench,
        dotBg: 'var(--amber-600)'
      });
    });
    recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  const dueMaintenance = dashData.dueMaintenance || [];

  view.innerHTML = `
    <div id="dashboardContainer">
      <div class="grid grid-3" style="margin-bottom:16px;">
        <div class="card kpi-card">
          <div class="kpi-bar" style="background:var(--navy-800)"></div>
          <div class="kpi-label">ทรัพย์สินทั้งหมด</div>
          <div class="kpi-value">${totalAssets.toLocaleString()}</div>
          <div class="kpi-sub">รายการที่ขึ้นทะเบียน</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-bar" style="background:var(--green-700)"></div>
          <div class="kpi-label">พร้อมใช้</div>
          <div class="kpi-value">${readyCount.toLocaleString()}</div>
          <div class="kpi-sub">รายการ · เบิกใช้แล้ว ${issuedCount} รายการ</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-bar" style="background:var(--amber-700)"></div>
          <div class="kpi-label">ส่งซ่อม</div>
          <div class="kpi-value">${repairCount.toLocaleString()}</div>
          <div class="kpi-sub">รายการ</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:16px;">
        <div class="card">
          <div class="card-head">
            <h3>จำนวนทรัพย์สินตามหมวดหมู่</h3>
            <span class="hint">ไม่รวมรายการที่เสียแล้ว</span>
          </div>
          <div class="card-pad">
            ${byCategory.map(c => `
              <div class="bar-row">
                <div class="bar-label" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${c.count / maxCat * 100}%"></div>
                </div>
                <div class="bar-count">${c.count}</div>
              </div>`).join('') || `<div class="empty-state"><div class="et">ยังไม่มีข้อมูล</div></div>`}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>สถานะทรัพย์สิน</h3></div>
          <div class="card-pad">
            <div class="donut-wrap">
              <div class="donut-center" style="background:conic-gradient(${gradParts});">
                <div class="donut-hole">
                  <div class="n">${totalAssets}</div>
                  <div class="l">รายการ</div>
                </div>
              </div>
              <div class="legend">
                ${statusCounts.map(s => `
                  <div class="legend-item">
                    <span class="legend-sw" style="background:${s.color}"></span>
                    ${s.label} (${s.count})
                  </div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card" style="display:flex;flex-direction:column;">
          <div class="card-head"
               style="display:flex;justify-content:space-between;align-items:center;">
            <h3>กิจกรรมล่าสุด</h3>
            <button class="btn btn-outline btn-sm" id="btnRefreshDash"
                    style="font-size:12px;padding:3px 9px;background:#fff;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <path d="M23 4v6h-6"/>
                <path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              รีเฟรช
            </button>
          </div>
          <div class="card-pad timeline-scroll">
            <div class="timeline">
              ${recentActivity.map(a => `
                <div class="tl-item">
                  <div class="tl-dot"
                       style="background:${a.dotBg || 'var(--navy-800)'};color:#fff;` +
                             `display:flex;align-items:center;justify-content:center;">
                    ${a.icon}
                  </div>
                  <div class="tl-content" style="flex:1;">
                    <div class="tl-title"
                         style="font-weight:600;color:var(--ink-900);line-height:1.4;">
                      ${escapeHtml(a.text)}
                    </div>
                    <div class="tl-meta"
                         style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;` +
                                `margin-top:3px;font-size:11.5px;color:var(--ink-500);">
                      <span title="${fmtDateTime(a.date)}">🕒 ${timeAgo(a.date)}</span>
                      ${a.userName ? `
                        <span style="background:var(--paper-alt);padding:1px 6px;` +
                                     `border-radius:4px;color:var(--ink-700);">
                          👤 ${escapeHtml(a.userName)}
                        </span>` : ''}
                    </div>
                  </div>
                </div>`).join('') || `
                <div class="empty-state">
                  <div class="et">ยังไม่มีกิจกรรม</div>
                </div>`}
            </div>
          </div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;">
          <div class="card-head"><h3>งานซ่อมบำรุงที่รอดำเนินการ</h3></div>
          <div class="card-pad timeline-scroll">
            <div class="timeline">
              ${dueMaintenance.map(m => `
                <div class="tl-item">
                  <div class="tl-dot" style="background:var(--amber-500);color:#fff;">
                    ${ICONS.wrench}
                  </div>
                  <div class="tl-content">
                    <div class="tl-title" style="font-weight:600;">
                      แจ้งซ่อม: ${escapeHtml(m.type)}
                    </div>
                    <div class="tl-meta">🕒 ${fmtDate(m.date)}</div>
                  </div>
                </div>`).join('') || `
                <div class="empty-state">
                  <div class="et">ไม่มีงานซ่อมค้าง</div>
                </div>`}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnRefreshDash')?.addEventListener('click', async () => {
    toast('กำลังอัปเดตข้อมูลแดชบอร์ด...');
    await renderDashboard(view, true);
    toast('ข้อมูลเป็นปัจจุบันแล้ว');
  });
}
