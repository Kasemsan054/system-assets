// js/views/settings.js - System Settings Coordinator View
// Manages organization branding, Excel backup/restore, and orchestrates sub-views.

async function renderSettings(view, forceReloadUsers = false) {
  setHeader(
    'ตั้งค่าระบบ',
    'ตั้งค่าองค์กร แผนก บุคลากรและบัญชีผู้ใช้งาน และการสำรองข้อมูล'
  );
  const canEdit = API.canEdit('settings');

  // Load users from API if not cached or forced
  let userListCache = window.SettingsUsers
    ? window.SettingsUsers.getUserListCache()
    : [];

  if (userListCache.length === 0 || forceReloadUsers) {
    try {
      const userRes = await API.get('users');
      userListCache = userRes.data || [];
      if (window.SettingsUsers) {
        window.SettingsUsers.setUserListCache(userListCache);
      }
    } catch (e) {
      userListCache = [];
    }
  }

  // --- Render Static Layout Shell ---
  view.innerHTML = `
    ${!canEdit ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;
                  border-radius:var(--radius-m);padding:12px 16px;margin-bottom:16px;
                  display:flex;align-items:center;gap:12px;font-size:13.5px;line-height:1.5;">
        <div style="font-size:20px;flex-shrink:0;">👁️</div>
        <div>
          <strong>โหมดดูข้อมูลเท่านั้น (Read-Only)</strong> — 
          ตำแหน่งของคุณ (${escapeHtml(API.getUserPosition() || 'ผู้ใช้งาน')}) 
          สามารถดูข้อมูลองค์กร แผนก และบุคลากรได้ แต่ไม่มีสิทธิ์แก้ไขการตั้งค่าระบบ
        </div>
      </div>
    ` : ''}

    <!-- Top Row: Org info & Excel Backup -->
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>ข้อมูลองค์กร</h3></div>
        <div class="card-pad">
          <form id="orgForm">
            <div class="field" style="margin-bottom:12px;">
              <label>ชื่อองค์กร</label>
              <input name="orgName"
                     value="${escapeHtml(DB.orgName)}"
                     ${canEdit ? '' : 'disabled'}>
            </div>
            <div class="field" style="margin-bottom:14px;">
              <label>ชื่อรอง (เช่น สำนักงาน/สาขา)</label>
              <input name="orgSub"
                     value="${escapeHtml(DB.orgSub || '')}"
                     ${canEdit ? '' : 'disabled'}>
            </div>
            ${canEdit ? `
              <button class="btn btn-primary" type="submit">
                ${ICONS.check}บันทึกข้อมูลองค์กร
              </button>
            ` : ''}
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>สำรอง / นำเข้าข้อมูล</h3></div>
        <div class="card-pad">
          <p style="font-size:13px;color:var(--ink-700);margin-top:0;">
            ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ Excel (.xlsx) เพื่อสำรองไว้ —
            ไฟล์จะมีหลายชีทแยกตามประเภทข้อมูล (ทรัพย์สิน, หมวดหมู่, แผนก, บุคลากร,
            การมอบหมาย, ซ่อมบำรุง) หรือนำไฟล์ที่เคยสำรองกลับเข้าสู่ระบบได้
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-outline" id="btnExport">
              ${ICONS.download}ส่งออกข้อมูล (Excel)
            </button>
            ${API.isAdmin() ? `
              <button class="btn btn-outline" id="btnImportTrigger">
                ${ICONS.upload}นำเข้าข้อมูล (Excel)
              </button>
              <input type="file" id="importFile" accept=".xlsx,.xls" style="display:none;">
            ` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Personnel & System Users Section (Full Width) -->
    <div class="card" style="margin-top:16px;">
      <div class="table-toolbar"
           style="justify-content:space-between;padding:12px 16px;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;flex:1;">
          <div>
            <h3 style="margin:0;font-size:16px;">บุคลากรและบัญชีผู้ใช้งานระบบ</h3>
            <div style="font-size:12px;color:var(--ink-500);margin-top:2px;">
              ข้อมูลบุคลากร สิทธิ์เข้าใช้งานระบบ (Username = รหัสพนักงาน) และทรัพย์สินที่ถือครอง
            </div>
          </div>
          <div class="search-box" style="max-width:280px;">
            ${ICONS.search}
            <input id="unifiedSearchInput" placeholder="ค้นหารหัส, ชื่อ, แผนก หรือตำแหน่ง...">
          </div>
          <select class="filter-select"
                  id="unifiedRoleSelect"
                  style="font-size:13px;padding:6px 10px;">
            <option value="all">สิทธิ์ทั้งหมด</option>
            <option value="admin">Admin ผู้ดูแลระบบ</option>
            <option value="user">User ทั่วไป</option>
            <option value="no_account">ยังไม่มีบัญชีระบบ</option>
          </select>
        </div>
        <div class="toolbar-right" style="display:flex;gap:8px;align-items:center;">
          ${canEdit ? `
            <button class="btn btn-outline btn-sm" id="btnBulkUnifiedAction" style="display:none;">
              จัดการที่เลือก (<span id="unifiedBulkCount">0</span>)
            </button>
            <button class="btn btn-primary btn-sm" id="btnAddUnifiedPerson">
              ${ICONS.plus}เพิ่มบุคลากร / บัญชีผู้ใช้
            </button>
          ` : ''}
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              ${canEdit ? `
                <th style="width:38px;text-align:center;">
                  <input type="checkbox" id="selectAllUnifiedCheckbox">
                </th>
              ` : ''}
              <th>รหัสพนักงาน (ID / Username)</th>
              <th>ชื่อ-สกุล</th>
              <th>แผนก</th>
              <th>ตำแหน่ง</th>
              <th>สิทธิ์การใช้งานระบบ</th>
              <th>ทรัพย์สินที่ถือครอง</th>
              <th style="text-align:right;">${canEdit ? 'การจัดการ' : 'สถานะ'}</th>
            </tr>
          </thead>
          <tbody id="unifiedTableBody"></tbody>
        </table>
      </div>
      <div class="table-toolbar"
           id="unifiedPaginationToolbar"
           style="border-top:1px solid var(--line);border-bottom:none;
                  justify-content:space-between;padding:10px 16px;">
      </div>
    </div>

    <!-- Bottom Row: Departments & Activity Logs -->
    <div class="grid grid-2" style="margin-top:16px;grid-template-columns:1fr 2fr;">
      <!-- Departments Management -->
      <div class="card" style="display:flex;flex-direction:column;">
        <div class="table-toolbar" style="justify-content:space-between;padding:12px 16px;">
          <div>
            <h3 style="margin:0;font-size:16px;">แผนก</h3>
            <div style="font-size:12px;color:var(--ink-500);margin-top:2px;">
              โครงสร้างแผนกภายในองค์กร
            </div>
          </div>
          <div class="toolbar-right">
            ${canEdit ? `
              <button class="btn btn-outline btn-sm" id="btnBulkDeptAction" style="display:none;">
                ลบที่เลือก (<span id="deptBulkCount">0</span>)
              </button>
              <button class="btn btn-primary btn-sm" id="btnAddDept">
                ${ICONS.plus}เพิ่มแผนก
              </button>
            ` : ''}
          </div>
        </div>
        <div class="timeline-scroll" style="max-height:420px;overflow-y:auto;overflow-x:auto;">
          <table class="data-table" style="position:relative;">
            <thead style="position:sticky;top:0;background:var(--paper-alt,#f8fafc);
                          z-index:2;box-shadow:0 1px 0 var(--line);">
              <tr>
                ${canEdit ? `
                  <th style="width:38px;text-align:center;">
                    <input type="checkbox" id="selectAllDeptCheckbox">
                  </th>
                ` : ''}
                <th>ชื่อแผนก</th>
                <th>จำนวนบุคลากร</th>
                ${canEdit ? '<th style="text-align:right;">การจัดการ</th>' : ''}
              </tr>
            </thead>
            <tbody id="deptTableBody"></tbody>
          </table>
        </div>
        <div class="table-toolbar"
             id="deptPaginationToolbar"
             style="border-top:1px solid var(--line);border-bottom:none;
                    justify-content:space-between;padding:8px 16px;margin-top:auto;">
        </div>
      </div>

      <!-- System Activity Logs Section -->
      <div class="card" style="display:flex;flex-direction:column;">
        <div class="table-toolbar"
             style="justify-content:space-between;padding:12px 16px;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;flex:1;">
            <div>
              <h3 style="margin:0;font-size:16px;">บันทึกกิจกรรมระบบ (Activity Logs)</h3>
              <div style="font-size:12px;color:var(--ink-500);margin-top:2px;">
                ตรวจสอบประวัติการแก้ไข เพิ่ม ลบ และการทำรายการทั้งหมดในระบบแบบเรียลไทม์
              </div>
            </div>
            <div class="search-box" style="max-width:240px;">
              ${ICONS.search}
              <input id="logsSearchInput" placeholder="ค้นหากิจกรรม, ผู้ใช้, ข้อมูล...">
            </div>
            <select class="filter-select"
                    id="logsModuleSelect"
                    style="font-size:13px;padding:6px 10px;">
              <option value="">ทุกหมวดหมู่การทำงาน</option>
              <option value="assets">ทะเบียนทรัพย์สิน</option>
              <option value="assignments">การมอบหมาย/คืน</option>
              <option value="maintenance">ซ่อมบำรุง</option>
              <option value="categories">หมวดหมู่ทรัพย์สิน</option>
              <option value="departments">แผนก/หน่วยงาน</option>
              <option value="employees">บุคลากร/ผู้ใช้</option>
              <option value="system">การตั้งค่าระบบ</option>
            </select>
          </div>
          <button class="btn btn-outline btn-sm" id="btnRefreshLogs" style="font-size:12.5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            รีเฟรช Log
          </button>
        </div>

        <div class="timeline-scroll" style="max-height:420px;overflow-y:auto;overflow-x:auto;">
          <table class="data-table" style="position:relative;">
            <thead style="position:sticky;top:0;background:var(--paper-alt,#f8fafc);
                          z-index:2;box-shadow:0 1px 0 var(--line);">
              <tr>
                <th style="width:160px;">วัน-เวลา</th>
                <th style="width:110px;">การทำงาน</th>
                <th style="width:130px;">หมวดหมู่</th>
                <th>รายละเอียดกิจกรรม</th>
                <th style="width:150px;">ผู้ดำเนินการ</th>
              </tr>
            </thead>
            <tbody id="logsTableBody">
              <tr>
                <td colspan="5" style="text-align:center;padding:24px;color:var(--ink-500);">
                  กำลังโหลดประวัติกิจกรรม...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-toolbar"
             id="logsPaginationToolbar"
             style="border-top:1px solid var(--line);border-bottom:none;
                    justify-content:space-between;padding:8px 16px;margin-top:auto;">
        </div>
      </div>
    </div>
  `;

  // --- Organization Form ---
  document.getElementById('orgForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    try {
      await API.request('settings', 'PUT', {
        orgName: fd.orgName || 'องค์กรของคุณ',
        orgSub: fd.orgSub || ''
      });
      DB.orgName = fd.orgName || 'องค์กรของคุณ';
      DB.orgSub = fd.orgSub || '';
      toast('บันทึกข้อมูลองค์กรเรียบร้อยแล้ว');
      applyBranding();
    } catch (err) {
      toast('เกิดข้อผิดพลาด: ' + err.message, true);
    }
  });

  // --- Excel Export & Import ---
  document.getElementById('btnExport')?.addEventListener('click', async () => {
    if (typeof XLSX === 'undefined') {
      toast('ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
      return;
    }
    const btn = document.getElementById('btnExport');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="spinner"
              style="width:14px;height:14px;display:inline-block;
                     vertical-align:middle;margin-right:6px;"></span>
        กำลังเตรียมข้อมูลสำรอง...
      `;
    }
    try {
      const [assetsRes, asgRes, mntRes] = await Promise.all([
        API.get('assets', { limit: 10000 }).catch(() => ({ data: DB.assets })),
        API.get('assignments', { limit: 10000 }).catch(() => ({ data: DB.assignments })),
        API.get('maintenance', { limit: 10000 }).catch(() => ({ data: DB.maintenance })),
      ]);
      const wb = buildWorkbook({
        categories: DB.categories,
        departments: DB.departments,
        employees: DB.employees,
        assets: assetsRes.data || DB.assets,
        assignments: asgRes.data || DB.assignments,
        maintenance: mntRes.data || DB.maintenance,
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `asset-management-backup-${dateStr}.xlsx`);
      toast('ส่งออกไฟล์ Excel สำรองข้อมูลเรียบร้อยแล้ว');
    } catch (err) {
      toast('เกิดข้อผิดพลาดขณะส่งออกไฟล์: ' + err.message, true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  });

  document.getElementById('btnImportTrigger')?.addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      toast('ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = new Uint8Array(reader.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const parsed = parseWorkbook(wb);

        document.body.insertAdjacentHTML('beforeend', `
          <div id="importOverlay"
               style="position:fixed;top:0;left:0;right:0;bottom:0;
                      background:rgba(255,255,255,0.8);z-index:9999;display:flex;
                      flex-direction:column;align-items:center;justify-content:center;
                      font-size:18px;backdrop-filter:blur(5px);">
            <div class="spinner"
                 style="margin-bottom:15px;width:40px;height:40px;
                        border:4px solid var(--primary-100,#f4e9d2);
                        border-top-color:var(--navy-800);border-radius:50%;
                        animation:spin 1s linear infinite;"></div>
            กำลังซิงค์ข้อมูลขึ้นระบบ...
          </div>
        `);

        const res = await API.bulkImport({
          departments: parsed.departments || [],
          employees: parsed.employees || [],
          categories: parsed.categories || [],
          assets: parsed.assets || [],
          assignments: parsed.assignments || [],
          maintenance: parsed.maintenance || [],
          orgName: parsed.orgName,
          orgSub: parsed.orgSub,
        });

        const s = res.summary || {};
        API.log(
          'import',
          'system',
          `นำเข้าข้อมูลจาก Excel: ทรัพย์สิน ${s.assets || 0}, บุคลากร ${s.employees || 0}, ` +
          `แผนก ${s.departments || 0}, หมวดหมู่ ${s.categories || 0}, ` +
          `มอบหมาย ${s.assignments || 0}, ซ่อมบำรุง ${s.maintenance || 0} รายการ`
        );

        await syncDB();
        const refreshedUsers = (await API.get('users')).data || [];
        if (window.SettingsUsers) window.SettingsUsers.setUserListCache(refreshedUsers);

        document.getElementById('importOverlay')?.remove();
        toast(`นำเข้าข้อมูลสำเร็จ ${res.written || 0} รายการ`);
        applyBranding();

        if (window.SettingsUsers) window.SettingsUsers.renderTable();
        if (window.SettingsDepartments) window.SettingsDepartments.renderTable();
      } catch (err) {
        document.getElementById('importOverlay')?.remove();
        const rowErrors = err?.payload?.errors;
        if (Array.isArray(rowErrors) && rowErrors.length) {
          const first = rowErrors[0];
          toast(`${err.message} — ${first.section} แถวที่ ${first.row}: ${first.error}`, true);
          console.warn('[import] Rejected rows:', rowErrors);
        } else {
          const msg = err?.message === 'invalid workbook'
            ? 'ไฟล์ไม่ถูกต้อง ไม่สามารถนำเข้าข้อมูลได้'
            : ('นำเข้าข้อมูลไม่สำเร็จ: ' + (err?.message || 'ไม่ทราบสาเหตุ'));
          toast(msg, true);
        }
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  });

  // --- Initialize Sub-Modules ---
  if (window.SettingsUsers) {
    window.SettingsUsers.init({
      canEdit,
      userListCache,
      onDataChange: async () => {
        await syncDB();
        if (window.SettingsDepartments) window.SettingsDepartments.renderTable();
      }
    });
  }

  if (window.SettingsDepartments) {
    window.SettingsDepartments.init({
      canEdit,
      container: view,
      onDataChange: async () => {
        await syncDB();
        if (window.SettingsUsers) window.SettingsUsers.renderTable();
      }
    });
  }

  if (window.SettingsLogs) {
    window.SettingsLogs.init();
  }
}
