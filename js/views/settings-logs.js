// js/views/settings-logs.js - System Activity Logs Module
// Handles real-time activity log fetching, filtering, searching, and pagination.

(function() {
  let logsPagination = { page: 1, limit: 10, total: 0 };
  let logsSearch = '';
  let logsModule = '';
  let _logSearchDebounce = null;

  const ACTION_LABELS = {
    create: { text: 'เพิ่มข้อมูล', color: '#16a34a' },
    update: { text: 'แก้ไขข้อมูล', color: '#2563eb' },
    delete: { text: 'ลบข้อมูล', color: '#dc2626' },
    assign: { text: 'มอบหมาย', color: '#7c3aed' },
    return: { text: 'รับคืน', color: '#0d9488' },
    repair: { text: 'แจ้งซ่อม', color: '#d97706' },
    complete_repair: { text: 'ซ่อมเสร็จ', color: '#16a34a' },
    login: { text: 'เข้าสู่ระบบ', color: '#4b5563' },
    system: { text: 'ระบบ', color: '#4b5563' },
    info: { text: 'ทั่วไป', color: '#4b5563' }
  };

  const MODULE_LABELS = {
    assets: 'ทะเบียนทรัพย์สิน',
    assignments: 'การมอบหมาย/คืน',
    maintenance: 'ซ่อมบำรุง',
    categories: 'หมวดหมู่',
    departments: 'แผนก/หน่วยงาน',
    employees: 'บุคลากร/ผู้ใช้',
    users: 'บัญชีผู้ใช้งาน',
    auth: 'การยืนยันตัวตน',
    system: 'ระบบ'
  };

  async function renderLogsTable() {
    const tbody = document.getElementById('logsTableBody');
    const pbar = document.getElementById('logsPaginationToolbar');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:24px;color:var(--ink-500);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" class="spinner"
               style="margin-right:8px;vertical-align:middle;">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          กำลังโหลดประวัติกิจกรรม...
        </td>
      </tr>
    `;

    try {
      const params = {
        page: logsPagination.page,
        limit: logsPagination.limit,
        excludeLogin: true
      };
      if (logsSearch.trim()) params.search = logsSearch.trim();
      if (logsModule) params.module = logsModule;

      const res = await API.get('logs', params);
      const logs = (res.data || []).filter(l => l.action !== 'login' && l.module !== 'auth');
      logsPagination.total = res.total || 0;
      const totalPages = Math.max(1, Math.ceil(logsPagination.total / logsPagination.limit));

      if (logs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5">
              <div class="empty-state">
                ${ICONS.info}
                <div class="et">ไม่พบประวัติกิจกรรม</div>
              </div>
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = logs.map(l => {
          const act = ACTION_LABELS[l.action] || { text: l.action, color: '#4b5563' };
          const mod = MODULE_LABELS[l.module] || l.module;
          const targetIdSpan = l.targetId ? `(${escapeHtml(l.targetId)})` : '';
          const targetInfo = l.targetName
            ? `<div style="font-size:11.5px;color:var(--ink-500);margin-top:2px;">
                 เป้าหมาย: ${escapeHtml(l.targetName)} ${targetIdSpan}
               </div>`
            : '';
          const roleInfo = l.userRole
            ? `<div style="font-size:11px;color:var(--ink-500);">${escapeHtml(l.userRole)}</div>`
            : '';

          return `
            <tr>
              <td style="font-size:12px;color:var(--ink-600);white-space:nowrap;"
                  title="${fmtDateTime(l.createdAt)}">
                🕒 ${timeAgo(l.createdAt)}<br>
                <span style="font-size:11px;color:var(--ink-400);">
                  ${fmtDateTime(l.createdAt)}
                </span>
              </td>
              <td>
                <span class="badge"
                      style="background:${act.color}15;color:${act.color};
                             border:1px solid ${act.color}40;font-size:11.5px;
                             padding:2px 8px;border-radius:4px;font-weight:600;">
                  ${act.text}
                </span>
              </td>
              <td style="font-size:12.5px;color:var(--ink-700);">${escapeHtml(mod)}</td>
              <td style="font-size:13px;line-height:1.4;font-weight:500;color:var(--ink-900);">
                ${escapeHtml(l.details || '-')}
                ${targetInfo}
              </td>
              <td style="font-size:12.5px;white-space:nowrap;">
                <span style="font-weight:600;color:var(--ink-900);">
                  👤 ${escapeHtml(l.userName || 'ระบบ')}
                </span>
                ${roleInfo}
              </td>
            </tr>
          `;
        }).join('');
      }

      if (pbar) {
        const startIdx = (logsPagination.page - 1) * logsPagination.limit;
        const countStart = logsPagination.total === 0 ? 0 : startIdx + 1;
        const countEnd = Math.min(startIdx + logsPagination.limit, logsPagination.total);

        pbar.innerHTML = `
          <div style="font-size:12.5px;color:var(--ink-500);">
            แสดง ${countStart} ถึง ${countEnd} จาก ${logsPagination.total} รายการ
          </div>
          <div style="display:flex;gap:4px;align-items:center;">
            <button class="btn btn-outline btn-sm"
                    id="btnPrevPageLogs"
                    ${logsPagination.page === 1 ? 'disabled' : ''}>
              ก่อนหน้า
            </button>
            <div style="padding:6px 10px;font-size:12.5px;">
              หน้า ${logsPagination.page} / ${totalPages}
            </div>
            <button class="btn btn-outline btn-sm"
                    id="btnNextPageLogs"
                    ${logsPagination.page === totalPages ? 'disabled' : ''}>
              ถัดไป
            </button>
          </div>
        `;

        document.getElementById('btnPrevPageLogs')?.addEventListener('click', () => {
          if (logsPagination.page > 1) {
            logsPagination.page--;
            renderLogsTable();
          }
        });

        document.getElementById('btnNextPageLogs')?.addEventListener('click', () => {
          if (logsPagination.page < totalPages) {
            logsPagination.page++;
            renderLogsTable();
          }
        });
      }
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:20px;color:var(--red-700);">
            เกิดข้อผิดพลาดในการโหลด log: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }

  function init() {
    logsPagination.page = 1;

    document.getElementById('btnRefreshLogs')?.addEventListener('click', () => {
      renderLogsTable();
    });

    document.getElementById('logsSearchInput')?.addEventListener('input', e => {
      logsSearch = e.target.value;
      logsPagination.page = 1;
      clearTimeout(_logSearchDebounce);
      _logSearchDebounce = setTimeout(renderLogsTable, 300);
    });

    document.getElementById('logsModuleSelect')?.addEventListener('change', e => {
      logsModule = e.target.value;
      logsPagination.page = 1;
      renderLogsTable();
    });

    renderLogsTable();
  }

  window.SettingsLogs = {
    init,
    renderTable: renderLogsTable
  };
})();
