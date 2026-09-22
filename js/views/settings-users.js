// js/views/settings-users.js - Unified Personnel & User Accounts Module
// Manages personnel, user accounts, roles, permissions, passwords, and actions.

(function() {
  let unifiedPagination = { page: 1, limit: 10 };
  let unifiedSelection = [];
  let unifiedSearch = '';
  let unifiedRoleFilter = 'all';
  let userListCache = [];
  let _options = {};

  function generateRandomPassword(length = 10) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@#$!%&*';
    const all = upper + lower + digits + special;

    let result = [
      upper.charAt(Math.floor(Math.random() * upper.length)),
      lower.charAt(Math.floor(Math.random() * lower.length)),
      digits.charAt(Math.floor(Math.random() * digits.length)),
      special.charAt(Math.floor(Math.random() * special.length)),
    ];
    for (let i = result.length; i < length; i++) {
      result.push(all.charAt(Math.floor(Math.random() * all.length)));
    }
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result.join('');
  }

  function getFullUnifiedList() {
    const unifiedMap = new Map();

    DB.employees.forEach(e => {
      const user = userListCache.find(u =>
        (u.employeeId && u.employeeId.toLowerCase() === e.id.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === e.id.toLowerCase())
      );
      const perms = user
        ? (typeof user.permissions === 'string'
            ? JSON.parse(user.permissions || '[]')
            : (user.permissions || []))
        : [];

      const count = (e.assetCount !== undefined && e.assetCount !== null)
        ? Number(e.assetCount)
        : DB.assets.filter(a => a.holderId === e.id).length;

      unifiedMap.set(e.id.toLowerCase(), {
        id: e.id,
        employeeId: e.id,
        username: user ? user.username : e.id,
        name: e.name,
        departmentId: e.departmentId || null,
        departmentName: DB.departments.find(d => d.id === e.departmentId)?.name || '-',
        position: e.position || e.location || '-',
        location: e.position || e.location || '-',
        user: user || null,
        userId: user ? user.id : null,
        hasAccount: !!user,
        role: user ? user.role : null,
        permissions: perms,
        mustChangePassword: user ? Boolean(user.mustChangePassword) : false,
        assetsCount: count,
        isEmployee: true
      });
    });

    userListCache.forEach(u => {
      const empKey = (u.employeeId || u.username).toLowerCase();
      const userKey = u.username.toLowerCase();
      if (!unifiedMap.has(empKey) && !unifiedMap.has(userKey)) {
        const perms = typeof u.permissions === 'string'
          ? JSON.parse(u.permissions || '[]')
          : (u.permissions || []);

        const linkedEmp = DB.employees.find(e =>
          (u.employeeId && e.id.toLowerCase() === u.employeeId.toLowerCase()) ||
          e.id.toLowerCase() === u.username.toLowerCase()
        );

        let count = 0;
        if (linkedEmp && linkedEmp.assetCount !== undefined && linkedEmp.assetCount !== null) {
          count = Number(linkedEmp.assetCount);
        } else {
          count = DB.assets.filter(a =>
            a.holderId === u.username ||
            (u.employeeId && a.holderId === u.employeeId)
          ).length;
        }

        unifiedMap.set(userKey, {
          id: u.employeeId || u.username,
          employeeId: u.employeeId || u.username,
          username: u.username,
          name: u.name,
          departmentId: u.departmentId || null,
          departmentName: DB.departments.find(d => d.id === u.departmentId)?.name || '-',
          position: u.role === 'admin' ? 'ผู้ดูแลระบบ' : '-',
          location: u.role === 'admin' ? 'ผู้ดูแลระบบ' : '-',
          user: u,
          userId: u.id,
          hasAccount: true,
          role: u.role,
          permissions: perms,
          mustChangePassword: Boolean(u.mustChangePassword),
          assetsCount: count,
          isEmployee: false
        });
      }
    });

    return Array.from(unifiedMap.values());
  }

  function updateUnifiedSelectionUI(paginated = []) {
    document.querySelectorAll('.row-checkbox-unified').forEach(cb => {
      cb.checked = unifiedSelection.includes(cb.value);
    });

    const selectAllCb = document.getElementById('selectAllUnifiedCheckbox');
    if (selectAllCb && paginated.length > 0) {
      selectAllCb.checked = paginated.every(item => unifiedSelection.includes(item.id));
    }

    const btnBulk = document.getElementById('btnBulkUnifiedAction');
    const countSpan = document.getElementById('unifiedBulkCount');
    if (btnBulk && countSpan) {
      countSpan.textContent = unifiedSelection.length;
      btnBulk.style.display = (_options.canEdit && unifiedSelection.length > 0)
        ? 'inline-flex'
        : 'none';
    }
  }

  function renderUnifiedTable() {
    const tbody = document.getElementById('unifiedTableBody');
    const pbar = document.getElementById('unifiedPaginationToolbar');
    if (!tbody || !pbar) return;

    const fullUnifiedList = getFullUnifiedList();

    const filtered = fullUnifiedList.filter(item => {
      if (unifiedRoleFilter === 'admin' && item.role !== 'admin') return false;
      if (unifiedRoleFilter === 'user' && item.role !== 'user') return false;
      if (unifiedRoleFilter === 'no_account' && item.hasAccount) return false;

      if (unifiedSearch.trim()) {
        const q = unifiedSearch.toLowerCase().trim();
        const idMatch = item.id.toLowerCase().includes(q);
        const nameMatch = item.name.toLowerCase().includes(q);
        const userMatch = item.username ? item.username.toLowerCase().includes(q) : false;
        const deptMatch = item.departmentName.toLowerCase().includes(q);
        const posMatch = item.position.toLowerCase().includes(q);
        return idMatch || nameMatch || userMatch || deptMatch || posMatch;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (a.username === 'admin') return -1;
      if (b.username === 'admin') return 1;
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });

    const totalPages = Math.ceil(filtered.length / unifiedPagination.limit) || 1;
    if (unifiedPagination.page > totalPages) unifiedPagination.page = totalPages;
    const startIdx = (unifiedPagination.page - 1) * unifiedPagination.limit;
    const paginated = filtered.slice(startIdx, startIdx + unifiedPagination.limit);

    const permLabels = {
      assets: 'ทรัพย์สิน',
      categories: 'หมวดหมู่',
      assignments: 'การมอบหมาย',
      maintenance: 'ซ่อมบำรุง',
      settings: 'ตั้งค่า'
    };

    const canEdit = _options.canEdit;
    const currentUser = _options.currentUser;

    tbody.innerHTML = paginated.map(item => {
      const isSelf = currentUser && (
        currentUser.id === item.userId ||
        currentUser.username === item.username
      );

      let roleBadge = '';
      if (item.role === 'admin') {
        roleBadge = `
          <span class="tag" style="background:#f3e8ff;color:#7e22ce;">
            <span class="tag-dot" style="background:#7e22ce;"></span>Admin (จัดการได้ทุกหน้า)
          </span>`;
      } else if (item.role === 'user') {
        let permDesc = '';
        if (item.permissions && item.permissions.length > 0) {
          const names = item.permissions.includes('*')
            ? 'ทุกหน้า'
            : item.permissions.map(p => permLabels[p] || p).join(', ');
          permDesc = `
            <div style="font-size:11px;color:var(--ink-600);margin-top:2px;">
              แก้ไข: ${escapeHtml(names)}
            </div>`;
        } else {
          permDesc = `
            <div style="font-size:11px;color:var(--ink-400);margin-top:2px;">
              ดูข้อมูลอย่างเดียว
            </div>`;
        }
        roleBadge = `
          <span class="tag" style="background:var(--blue-100);color:var(--blue-700);">
            <span class="tag-dot" style="background:var(--blue-700);"></span>User
          </span>${permDesc}`;
      } else {
        roleBadge = `
          <span class="tag" style="background:var(--paper-alt);color:var(--ink-500);">
            <span class="tag-dot" style="background:var(--ink-300);"></span>ไม่มีบัญชี
          </span>`;
      }

      const assetBadge = item.assetsCount > 0
        ? `<span class="tag" style="background:var(--green-100);color:var(--green-700);font-weight:600;">
             ${item.assetsCount} รายการ
           </span>`
        : `<span style="color:var(--ink-300);font-size:12px;">-</span>`;

      const isMainAdmin = item.username === 'admin' || item.userId === 'usr_admin';

      return `
        <tr>
          ${canEdit ? `
            <td style="text-align:center;">
              <input type="checkbox" class="row-checkbox-unified" value="${escapeHtml(item.id)}">
            </td>
          ` : ''}
          <td>
            <b style="font-family:monospace;font-size:14px;color:var(--navy-800);">
              ${escapeHtml(item.id)}
            </b>
            ${isSelf ? `
              <span style="font-size:11px;color:var(--navy-800);background:var(--amber-100);
                           padding:2px 6px;border-radius:4px;margin-left:4px;font-weight:600;">
                (บัญชีคุณ)
              </span>` : ''}
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(item.name)}</div>
          </td>
          <td>${escapeHtml(item.departmentName)}</td>
          <td>
            <span style="color:var(--ink-800);font-weight:500;font-size:13px;">
              ${escapeHtml(item.position || item.location || '-')}
            </span>
          </td>
          <td>
            ${roleBadge}
            ${item.mustChangePassword ? `
              <div style="font-size:11px;color:var(--amber-700);margin-top:2px;">
                ⚠️ บังคับเปลี่ยนรหัสผ่าน
              </div>` : ''}
          </td>
          <td>${assetBadge}</td>
          ${canEdit ? `
            <td style="text-align:right;">
              <div class="row-actions" style="justify-content:flex-end;">
                <button class="icon-btn"
                        title="แก้ไขข้อมูลบุคลากรและสิทธิ์"
                        data-editunified="${escapeHtml(item.id)}">
                  ${ICONS.edit}
                </button>
                <button class="icon-btn"
                        title="${item.hasAccount ? 'เปลี่ยนรหัสผ่าน' : 'เปิดบัญชีและตั้งรหัสผ่าน'}"
                        data-pwdunified="${escapeHtml(item.id)}">
                  ${ICONS.lock}
                </button>
                ${(!isSelf && !isMainAdmin) ? `
                <button class="icon-btn danger"
                        title="ลบข้อมูล"
                        data-delunified="${escapeHtml(item.id)}">
                  ${ICONS.trash}
                </button>
              ` : ''}
              </div>
            </td>
          ` : `
            <td style="text-align:right;">
              <span style="font-size:12px;color:var(--ink-400);">-</span>
            </td>
          `}
        </tr>
      `;
    }).join('') || `
      <tr>
        <td colspan="${canEdit ? 8 : 7}">
          <div class="empty-state">
            <div class="et">ไม่พบข้อมูลบุคลากรและผู้ใช้งาน</div>
          </div>
        </td>
      </tr>
    `;

    const countStart = filtered.length === 0 ? 0 : startIdx + 1;
    const countEnd = Math.min(startIdx + unifiedPagination.limit, filtered.length);
    pbar.innerHTML = `
      <div style="font-size:12.5px;color:var(--ink-500);">
        แสดง ${countStart} ถึง ${countEnd} จากทั้งหมด ${filtered.length} รายการ
      </div>
      <div style="display:flex;gap:4px;align-items:center;">
        <button class="btn btn-outline btn-sm"
                id="btnPrevPageUnified"
                ${unifiedPagination.page === 1 ? 'disabled' : ''}>
          ก่อนหน้า
        </button>
        <div style="padding:4px 10px;font-size:12.5px;">
          หน้า ${unifiedPagination.page} / ${totalPages}
        </div>
        <button class="btn btn-outline btn-sm"
                id="btnNextPageUnified"
                ${unifiedPagination.page >= totalPages ? 'disabled' : ''}>
          ถัดไป
        </button>
      </div>
    `;

    document.getElementById('btnPrevPageUnified')?.addEventListener('click', () => {
      unifiedPagination.page--;
      renderUnifiedTable();
    });
    document.getElementById('btnNextPageUnified')?.addEventListener('click', () => {
      unifiedPagination.page++;
      renderUnifiedTable();
    });

    tbody.querySelectorAll('.row-checkbox-unified').forEach(cb => {
      cb.addEventListener('change', e => {
        if (e.target.checked) {
          if (!unifiedSelection.includes(e.target.value)) unifiedSelection.push(e.target.value);
        } else {
          unifiedSelection = unifiedSelection.filter(id => id !== e.target.value);
        }
        updateUnifiedSelectionUI(paginated);
      });
    });

    tbody.querySelectorAll('[data-editunified]').forEach(b => {
      b.addEventListener('click', () => openEditUnifiedModal(b.dataset.editunified));
    });
    tbody.querySelectorAll('[data-pwdunified]').forEach(b => {
      b.addEventListener('click', () => openPasswordUnifiedModal(b.dataset.pwdunified));
    });
    tbody.querySelectorAll('[data-delunified]').forEach(b => {
      b.addEventListener('click', () => openDeleteUnifiedModal(b.dataset.delunified));
    });

    updateUnifiedSelectionUI(paginated);
  }

  function openAddUnifiedModal() {
    const initialPassword = generateRandomPassword(8);

    openModal(`
      <div class="modal-head" style="padding:16px 22px;border-bottom:1px solid var(--line);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:38px;height:38px;border-radius:var(--radius-m);
               background:#f0fdf4;color:#15803d;display:flex;
               align-items:center;justify-content:center;flex-shrink:0;">
            ${ICONS.plus}
          </div>
          <div>
            <h3 style="margin:0;font-size:16.5px;font-weight:700;color:var(--ink-900);">
              เพิ่มบุคลากรและบัญชีผู้ใช้งาน
            </h3>
            <div style="font-size:12px;color:var(--ink-500);margin-top:2px;">
              กรอกข้อมูลบุคลากร พร้อมเปิดสิทธิ์เข้าใช้งานระบบตามบทบาท
            </div>
          </div>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <form id="createUnifiedPersonForm">
        <div class="modal-body" style="padding:20px 22px;">
          <div style="background:#ffffff;border:1px solid var(--line);
                 border-radius:var(--radius-m);padding:16px;margin-bottom:14px;
                 box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="font-weight:700;font-size:13.5px;color:var(--ink-800);
                 margin-bottom:12px;display:flex;align-items:center;gap:7px;">
              <span style="color:var(--navy-700);">${ICONS.assets}</span>
              <span>ข้อมูลทั่วไปของบุคลากร</span>
            </div>
            <div class="grid grid-2" style="gap:12px;margin-bottom:12px;">
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">
                  รหัสพนักงาน (ID) <span class="req">*</span>
                </label>
                <input name="id" id="newEmpIdInput" required placeholder="เช่น 000001 หรือ EMP002"
                  style="font-family:monospace;font-weight:700;font-size:14px;
                         border-radius:var(--radius-s);">
                <div id="empIdError"
                     style="font-size:11px;color:#dc2626;margin-top:3px;display:none;"></div>
                <div style="font-size:11px;color:var(--ink-500);margin-top:3px;">
                  ใช้ระบุตัวตนและเป็น Username ในระบบ
                </div>
              </div>
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">
                  ชื่อ-สกุล <span class="req">*</span>
                </label>
                <input name="name"
                       required
                       placeholder="เช่น นายสมชาย ใจดี"
                       style="border-radius:var(--radius-s);">
              </div>
            </div>

            <div class="grid grid-2" style="gap:12px;">
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">สังกัดแผนก</label>
                <select name="departmentId" style="border-radius:var(--radius-s);">
                  ${DB.departments.map(d => `
                    <option value="${d.id}">
                      ${escapeHtml(d.name)}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">
                  ตำแหน่งงาน <span class="req">*</span>
                </label>
                <input name="location"
                       id="newPersonPositionInput"
                       list="posSuggestions"
                       required
                       placeholder="เช่น เจ้าหน้าที่พัสดุ, ช่างเทคนิค"
                       style="border-radius:var(--radius-s);">
                <datalist id="posSuggestions">
                  <option value="ผู้ดูแลระบบ">
                  <option value="เจ้าหน้าที่พัสดุและทะเบียนครุภัณฑ์">
                  <option value="ช่างเทคนิคซ่อมบำรุง">
                  <option value="หัวหน้าแผนก / ผู้จัดการ">
                  <option value="พนักงานทั่วไป">
                </datalist>
              </div>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;
                 padding:16px;border-radius:var(--radius-m);">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
                  font-weight:600;font-size:13.5px;margin:0;user-select:none;">
              <input type="checkbox"
                     id="cbCreateAcc"
                     checked
                     style="width:17px;height:17px;accent-color:var(--navy-800);border-radius:4px;">
              <span>เปิดสิทธิ์เข้าใช้งานระบบ (สร้างบัญชีผู้ใช้งานทันที)</span>
            </label>

            <div id="accDetailsSection"
                 style="margin-top:14px;padding-top:14px;border-top:1px dashed #cbd5e1;">
              <div class="field" style="margin-bottom:14px;">
                <label style="font-size:12.5px;font-weight:600;">
                    สิทธิ์การใช้งาน (Role) <span class="req">*</span>
                  </label>
                <select name="role" id="newPersonRoleSelect" style="border-radius:var(--radius-s);">
                  <option value="user" selected>User (ผู้ใช้งานทั่วไป)</option>
                  <option value="admin">Admin (ผู้ดูแลระบบ - สิทธิ์เต็มทุกส่วน)</option>
                </select>
              </div>

              <div class="field" style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;
                            align-items:center;margin-bottom:8px;">
                  <span style="font-weight:600;font-size:12.5px;color:var(--ink-800);">
                    สิทธิ์การแก้ไขข้อมูลในระบบ (ตามตำแหน่ง)
                  </span>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm" id="btnToggleAllPerms"
                            style="font-size:11px;padding:2px 8px;border-radius:var(--radius-s);">
                      เลือกทั้งหมด
                    </button>
                    <span style="font-size:11.5px;color:var(--ink-500);">
                      (ทุกตำแหน่งดูข้อมูลทั้งเว็บได้)
                    </span>
                  </div>
                </div>
                <div style="grid grid-cols-2;gap:8px;" class="grid">
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                 padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                 border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox" name="perm_assets" value="assets"
                           style="accent-color:var(--navy-800);"> 📦 ทะเบียนทรัพย์สิน
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                 padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                 border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox" name="perm_categories" value="categories"
                           style="accent-color:var(--navy-800);"> 🏷️ หมวดหมู่ทรัพย์สิน
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                 padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                 border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox" name="perm_assignments" value="assignments"
                           style="accent-color:var(--navy-800);"> 📋 การมอบหมาย/เบิกยืม
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                 padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                 border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox" name="perm_maintenance" value="maintenance"
                           style="accent-color:var(--navy-800);"> 🔧 บันทึกซ่อมบำรุง
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                 padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                 border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox" name="perm_settings" value="settings"
                           style="accent-color:var(--navy-800);"> ⚙️ ตั้งค่าระบบและแผนก
                  </label>
                </div>
              </div>

              <div class="field">
                <label style="display:flex;justify-content:space-between;align-items:center;
                        font-size:12.5px;font-weight:600;margin-bottom:6px;">
                  <span>รหัสผ่านเริ่มต้น (Initial Password) <span class="req">*</span></span>
                  <span style="font-size:11px;color:var(--ink-500);font-weight:normal;">
                    พิมพ์กำหนดเอง หรือกดสุ่มใหม่
                  </span>
                </label>
                <div style="display:flex;gap:8px;">
                  <input type="text" name="password" id="newAccPasswordInput"
                         value="${initialPassword}" minlength="6"
                    style="font-family:monospace;font-size:14.5px;font-weight:700;
                         color:var(--navy-800);border-radius:var(--radius-s);">
                  <button type="button" class="btn btn-outline"
                          id="btnRegenAccPassword" title="สุ่มรหัสผ่านใหม่"
                    style="padding:0 14px;flex-shrink:0;border-radius:var(--radius-s);
                                 font-size:12.5px;">
                    🔄 สุ่มใหม่
                  </button>
                  <button type="button" class="btn btn-outline"
                          id="btnCopyAccPassword" title="คัดลอกรหัสผ่าน"
                    style="padding:0 14px;flex-shrink:0;border-radius:var(--radius-s);
                                 font-size:12.5px;">
                    📋 คัดลอก
                  </button>
                </div>
                <div id="pwdError" style="font-size:11.5px;color:#dc2626;
                            margin-top:6px;display:none;"></div>
                <div style="font-size:11.5px;color:var(--amber-700);margin-top:6px;">
                  * รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร
                  (ระบบจะแจ้งเตือนให้เปลี่ยนรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก)
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-foot"
             style="padding:14px 22px;border-top:1px solid var(--line);gap:10px;">
          <button type="button" class="btn btn-outline" id="mCancel"
                  style="border-radius:var(--radius-m);">
            ยกเลิก
          </button>
          <button type="submit" class="btn btn-primary"
                  style="border-radius:var(--radius-m);">
            ${ICONS.check} บันทึกข้อมูลบุคลากร
          </button>
        </div>
      </form>
    `);

    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;

    const cb = document.getElementById('cbCreateAcc');
    const sec = document.getElementById('accDetailsSection');
    const pwdInput = document.getElementById('newAccPasswordInput');
    const posInput = document.getElementById('newPersonPositionInput');
    const roleSelect = document.getElementById('newPersonRoleSelect');

    function applyAddPreset() {
      const role = roleSelect?.value || 'user';
      const pos = (posInput?.value || '').toLowerCase();
      const cbAssets = document.querySelector('input[name="perm_assets"]');
      const cbCats = document.querySelector('input[name="perm_categories"]');
      const cbAssign = document.querySelector('input[name="perm_assignments"]');
      const cbMaint = document.querySelector('input[name="perm_maintenance"]');
      const cbSettings = document.querySelector('input[name="perm_settings"]');
      if (!cbAssets) return;

      if (role === 'admin') {
        cbAssets.checked = true;
        cbCats.checked = true;
        cbAssign.checked = true;
        cbMaint.checked = true;
        cbSettings.checked = true;
      } else {
        cbAssets.checked = /พัสดุ|ทะเบียน|ทรัพย์สิน|ไอที|it|admin|ผู้ดูแล/.test(pos);
        cbCats.checked = /พัสดุ|ทะเบียน|ทรัพย์สิน|ไอที|it|admin|ผู้ดูแล/.test(pos);
        cbAssign.checked = /พัสดุ|ทะเบียน|ทรัพย์สิน|ผู้จัดการ|หัวหน้า|ไอที|it|admin|ผู้ดูแล/.test(pos);
        cbMaint.checked = /ช่าง|ซ่อม|บำรุง|เทคนิค|engineer|technician|admin|ผู้ดูแล/.test(pos);
        cbSettings.checked = /ผู้ดูแล|admin/.test(pos);
      }
    }

    posInput?.addEventListener('input', applyAddPreset);
    roleSelect?.addEventListener('change', applyAddPreset);

    cb?.addEventListener('change', () => {
      sec.style.display = cb.checked ? 'block' : 'none';
      if (cb.checked) {
        pwdInput.setAttribute('required', 'required');
      } else {
        pwdInput.removeAttribute('required');
      }
    });

    document.getElementById('btnRegenAccPassword')?.addEventListener('click', () => {
      pwdInput.value = generateRandomPassword(8);
      toast('สุ่มรหัสผ่านใหม่เรียบร้อยแล้ว');
    });

    document.getElementById('btnCopyAccPassword')?.addEventListener('click', () => {
      navigator.clipboard.writeText(pwdInput.value);
      toast('คัดลอกรหัสผ่านแล้ว: ' + pwdInput.value);
    });

    document.getElementById('createUnifiedPersonForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(ev.target).entries());
      const empId = fd.id ? fd.id.trim() : '';
      if (!empId) {
        toast('กรุณากรอกรหัสพนักงาน', true);
        return;
      }

      if (DB.employees.some(e => e.id.toLowerCase() === empId.toLowerCase())) {
        toast('รหัสพนักงาน "' + empId + '" มีอยู่ในระบบแล้ว กรุณาตรวจสอบรหัสพนักงาน', true);
        return;
      }

      const shouldCreateAcc = document.getElementById('cbCreateAcc')?.checked;
      if (shouldCreateAcc) {
        if (userListCache.some(u => u.username.toLowerCase() === empId.toLowerCase())) {
          toast('ชื่อผู้ใช้งาน (รหัสพนักงาน) "' + empId + '" มีอยู่ในระบบบัญชีผู้ใช้แล้ว', true);
          return;
        }
        if (!fd.password || fd.password.length < 6) {
          toast('รหัสผ่านต้องมีความยาวไม่ต่ำกว่า 6 ตัวอักษร', true);
          return;
        }
      }

      const perms = [];
      ['assets', 'categories', 'assignments', 'maintenance', 'settings'].forEach(p => {
        if (ev.target.querySelector(`input[name="perm_${p}"]`)?.checked) perms.push(p);
      });
      if (fd.role === 'admin') perms.push('*');

      try {
        const posVal = fd.location ? fd.location.trim() : '';
        await API.create('employees', {
          id: empId,
          name: fd.name.trim(),
          departmentId: fd.departmentId || null,
          position: posVal,
          location: posVal
        });

        if (shouldCreateAcc) {
          await API.create('users', {
            username: empId,
            password: fd.password,
            name: fd.name.trim(),
            role: fd.role || 'user',
            employeeId: empId,
            departmentId: fd.departmentId || null,
            permissions: perms
          });
        }

        closeModal();

        if (shouldCreateAcc) {
          openModal(`
            <div class="modal-head">
        <h3>เพิ่มบุคลากรและบัญชีสำเร็จ</h3>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
            <div class="modal-body">
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                 color:#166534;padding:12px;border-radius:var(--radius-s);
                 font-size:13px;margin-bottom:16px;">
                บันทึกข้อมูลบุคลากรและสร้างบัญชีผู้ใช้สำหรับเข้าระบบเรียบร้อยแล้ว:
              </div>
              <div style="background:var(--paper-alt);border:1px solid var(--line);
                 border-radius:var(--radius-s);padding:14px;
                 font-family:monospace;font-size:14px;line-height:1.9;">
                <div><b>รหัสพนักงาน (Username):</b>
                <span style="color:var(--navy-800);">${escapeHtml(empId)}</span>
              </div>
                <div>
                  <b>รหัสผ่านเข้าระบบ (Password):</b>
                  <span style="color:var(--primary,#7e1721);font-weight:bold;">
                    ${escapeHtml(fd.password)}
                  </span>
                </div>
                <div><b>ชื่อ-สกุล:</b> ${escapeHtml(fd.name)}</div>
                <div><b>สิทธิ์:</b>
                ${fd.role === 'admin' ? 'Admin (ผู้ดูแลระบบ)' : 'User (ผู้ใช้งานทั่วไป)'}
              </div>
              </div>
            </div>
            <div class="modal-foot">
              <button type="button" class="btn btn-outline" id="mCloseSuccess">ปิด</button>
              <button type="button" class="btn btn-primary" id="btnCopyAllCreds">
                📋 คัดลอกข้อมูลส่งให้พนักงาน
              </button>
            </div>
          `);
          document.getElementById('mClose').onclick = closeModal;
          document.getElementById('mCloseSuccess').onclick = closeModal;
          document.getElementById('btnCopyAllCreds')?.addEventListener('click', () => {
            const credText = [
              'ข้อมูลเข้าสู่ระบบจัดการทรัพย์สิน',
              `รหัสพนักงาน (Username): ${empId}`,
              `รหัสผ่าน (Password): ${fd.password}`,
              `ชื่อ-สกุล: ${fd.name}`
            ].join('\n');
            navigator.clipboard.writeText(credText);
            toast('คัดลอกข้อมูลเข้าสู่ระบบแล้ว');
          });
        } else {
          toast('เพิ่มข้อมูลบุคลากรเรียบร้อยแล้ว');
        }

        await syncDB();
        userListCache = (await API.get('users')).data || [];
        renderUnifiedTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (err) {
        toast('เกิดข้อผิดพลาด: ' + err.message, true);
      }
    });
  }

  function openEditUnifiedModal(itemId) {
    const fullUnifiedList = getFullUnifiedList();
    const target = fullUnifiedList.find(x => x.id === itemId);
    if (!target) return;

    const currentUser = _options.currentUser;
    const isSelf = currentUser && (
      currentUser.id === target.userId ||
      currentUser.username === target.username
    );
    const initialPwd = generateRandomPassword(8);
    const posVal = (target.position && target.position !== '-')
      ? target.position
      : ((target.location && target.location !== '-') ? target.location : '');

    openModal(`
      <div class="modal-head" style="padding:16px 22px;border-bottom:1px solid var(--line);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:38px;height:38px;border-radius:var(--radius-m);
               background:#eff6ff;color:#1d4ed8;display:flex;
               align-items:center;justify-content:center;flex-shrink:0;">
            ${ICONS.edit}
          </div>
          <div>
            <h3 style="margin:0;font-size:16.5px;font-weight:700;color:var(--ink-900);">
              แก้ไขข้อมูลบุคลากรและสิทธิ์ผู้ใช้
            </h3>
            <div style="font-size:12px;color:var(--ink-500);margin-top:2px;">
              รหัสพนักงาน: <b style="font-family:monospace;color:var(--navy-800);">
                ${escapeHtml(target.id)}
              </b> ·
              สถานะบัญชี:
              <span style="font-weight:600;
                           color:${target.hasAccount ? 'var(--green-700)' : 'var(--ink-400)'};">
                ${target.hasAccount ? 'มีบัญชีในระบบ' : 'ไม่มีบัญชี'}
              </span>
            </div>
          </div>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>

      <form id="editUnifiedPersonForm">
        <div class="modal-body" style="padding:20px 22px;">
          <div style="background:#ffffff;border:1px solid var(--line);
                      border-radius:var(--radius-m);padding:16px;margin-bottom:14px;
                      box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="font-weight:700;font-size:13.5px;color:var(--ink-800);
                        margin-bottom:12px;display:flex;align-items:center;gap:7px;">
              <span style="color:var(--navy-700);">${ICONS.assets}</span>
              <span>ข้อมูลบุคลากร</span>
            </div>
            <div class="grid grid-2" style="gap:12px;margin-bottom:12px;">
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">
                  รหัสพนักงาน (ID / Username)
                </label>
                <input value="${escapeHtml(target.id)}"
                       disabled
                       style="background:#f8fafc;font-family:monospace;font-weight:700;
                              color:var(--ink-600);border-radius:var(--radius-s);">
              </div>
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">
                  ชื่อ-สกุล <span class="req">*</span>
                </label>
                <input name="name"
                       value="${escapeHtml(target.name)}"
                       required
                       style="border-radius:var(--radius-s);">
              </div>
            </div>

            <div class="grid grid-2" style="gap:12px;">
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">สังกัดแผนก</label>
                <select name="departmentId" style="border-radius:var(--radius-s);">
                  <option value="">-- ไม่ระบุ --</option>
                  ${DB.departments.map(d => `
                    <option value="${d.id}" ${target.departmentId === d.id ? 'selected' : ''}>
                      ${escapeHtml(d.name)}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="field">
                <label style="font-size:12.5px;font-weight:600;">
                  ตำแหน่งงาน <span class="req">*</span>
                </label>
                <input name="location"
                       id="editPersonPositionInput"
                       value="${escapeHtml(posVal)}"
                       list="posSuggestionsEdit"
                       required
                       placeholder="เช่น เจ้าหน้าที่พัสดุ, ช่างเทคนิค"
                       style="border-radius:var(--radius-s);">
                <datalist id="posSuggestionsEdit">
                  <option value="ผู้ดูแลระบบ">
                  <option value="เจ้าหน้าที่พัสดุและทะเบียนครุภัณฑ์">
                  <option value="ช่างเทคนิคซ่อมบำรุง">
                  <option value="หัวหน้าแผนก / ผู้จัดการ">
                  <option value="พนักงานทั่วไป">
                </datalist>
              </div>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;
                      padding:16px;border-radius:var(--radius-m);">
            <div style="display:flex;justify-content:space-between;
                        align-items:center;margin-bottom:12px;">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
                            font-weight:700;font-size:13.5px;margin:0;user-select:none;">
                <input type="checkbox"
                       id="cbEnableAccount"
                       ${target.hasAccount ? 'checked' : ''}
                       ${target.username === 'admin' ? 'disabled' : ''}
                       style="width:17px;height:17px;accent-color:var(--navy-800);
                              border-radius:4px;">
                <span>เปิดสิทธิ์การใช้งานระบบ (มีบัญชีผู้ใช้)</span>
              </label>
              ${isSelf ? `
                <span style="font-size:11.5px;color:var(--amber-700);background:#fef3c7;
                             padding:3px 8px;border-radius:4px;font-weight:600;">
                  ⚠️ คุณกำลังแก้ไขบัญชีของตัวเอง
                </span>
              ` : ''}
            </div>

            <div id="accEditDetailsSection"
                 style="display:${target.hasAccount ? 'block' : 'none'};
                        padding-top:12px;border-top:1px dashed #cbd5e1;">
              <div class="field" style="margin-bottom:14px;">
                <label style="font-size:12.5px;font-weight:600;">
                  สิทธิ์การใช้งาน (Role) <span class="req">*</span>
                </label>
                <select name="role"
                        id="editPersonRoleSelect"
                        ${isSelf && target.role === 'admin' ? 'disabled' : ''}
                        style="border-radius:var(--radius-s);">
                  <option value="user" ${target.role !== 'admin' ? 'selected' : ''}>
                    User (ผู้ใช้งานทั่วไป)
                  </option>
                  <option value="admin" ${target.role === 'admin' ? 'selected' : ''}>
                    Admin (ผู้ดูแลระบบ - สิทธิ์เต็มทุกส่วน)
                  </option>
                </select>
                ${isSelf && target.role === 'admin' ? `
                  <div style="font-size:11px;color:var(--ink-500);margin-top:3px;">
                    ไม่สามารถลดสิทธิ์ Admin ของตัวเองได้
                  </div>
                ` : ''}
              </div>

              <div class="field" style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;
                            align-items:center;margin-bottom:8px;">
                  <span style="font-weight:600;font-size:12.5px;color:var(--ink-800);">
                    สิทธิ์การแก้ไขข้อมูลในระบบ (ตามตำแหน่ง)
                  </span>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <button type="button"
                            class="btn btn-outline btn-sm"
                            id="btnToggleAllPermsEdit"
                            style="font-size:11px;padding:2px 8px;border-radius:var(--radius-s);">
                      เลือกทั้งหมด
                    </button>
                    <span style="font-size:11.5px;color:var(--ink-500);">
                      (ทุกตำแหน่งดูข้อมูลทั้งเว็บได้)
                    </span>
                  </div>
                </div>
                <div style="grid grid-cols-2;gap:8px;" class="grid">
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                                padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                                border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox"
                           name="perm_assets"
                           value="assets"
                           ${(target.permissions &&
                             (target.permissions.includes('*') ||
                              target.permissions.includes('assets'))) ? 'checked' : ''}
                           style="accent-color:var(--navy-800);">
                    📦 ทะเบียนทรัพย์สิน
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                                padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                                border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox"
                           name="perm_categories"
                           value="categories"
                           ${(target.permissions &&
                             (target.permissions.includes('*') ||
                              target.permissions.includes('categories'))) ? 'checked' : ''}
                           style="accent-color:var(--navy-800);">
                    🏷️ หมวดหมู่ทรัพย์สิน
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                                padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                                border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox"
                           name="perm_assignments"
                           value="assignments"
                           ${(target.permissions &&
                             (target.permissions.includes('*') ||
                              target.permissions.includes('assignments'))) ? 'checked' : ''}
                           style="accent-color:var(--navy-800);">
                    📋 การมอบหมาย/เบิกยืม
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                                padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                                border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox"
                           name="perm_maintenance"
                           value="maintenance"
                           ${(target.permissions &&
                             (target.permissions.includes('*') ||
                              target.permissions.includes('maintenance'))) ? 'checked' : ''}
                           style="accent-color:var(--navy-800);">
                    🔧 บันทึกซ่อมบำรุง
                  </label>
                  <label style="font-size:12.5px;display:flex;align-items:center;gap:8px;
                                padding:9px 12px;background:#ffffff;border:1px solid #e2e8f0;
                                border-radius:var(--radius-s);cursor:pointer;">
                    <input type="checkbox"
                           name="perm_settings"
                           value="settings"
                           ${(target.permissions &&
                             (target.permissions.includes('*') ||
                              target.permissions.includes('settings'))) ? 'checked' : ''}
                           style="accent-color:var(--navy-800);">
                    ⚙️ ตั้งค่าระบบและแผนก
                  </label>
                </div>
              </div>

              ${!target.hasAccount ? `
              <div class="field" id="newAccountPasswordBlock">
                <label style="display:flex;justify-content:space-between;align-items:center;
                        font-size:12.5px;font-weight:600;margin-bottom:6px;">
                  <span>รหัสผ่านเริ่มต้นสำหรับเปิดบัญชี <span class="req">*</span></span>
                  <span style="font-size:11px;color:var(--ink-500);font-weight:normal;">
                    พิมพ์กำหนดเอง หรือกดสุ่มใหม่
                  </span>
                </label>
                <div style="display:flex;gap:8px;">
                  <input type="text" name="newPasswordForOpen"
                         id="newPwdForOpenInput" value="${initialPwd}" minlength="6"
                    style="font-family:monospace;font-size:14.5px;font-weight:700;
                         color:var(--navy-800);border-radius:var(--radius-s);">
                  <button type="button" class="btn btn-outline" id="btnRegenOpenPwd" title="สุ่มใหม่"
                    style="padding:0 14px;flex-shrink:0;border-radius:var(--radius-s);
                                 font-size:12.5px;">
                    🔄 สุ่มใหม่
                  </button>
                  <button type="button" class="btn btn-outline" id="btnCopyOpenPwd" title="คัดลอก"
                    style="padding:0 14px;flex-shrink:0;border-radius:var(--radius-s);
                                 font-size:12.5px;">
                    📋 คัดลอก
                  </button>
                </div>
                <div style="font-size:11.5px;color:var(--amber-700);margin-top:6px;">
                    * บังคับเปลี่ยนรหัสผ่านเมื่อ Login ครั้งแรก
                  </div>
              </div>
              ` : `
              <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:12px 14px;background:#ffffff;border:1px solid #e2e8f0;
                            border-radius:var(--radius-s);margin-top:10px;">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--ink-800);">
                        รหัสผ่านบัญชีผู้ใช้งาน
                      </div>
                  <div style="font-size:11.5px;color:var(--ink-500);margin-top:2px;">
                        ต้องการเปลี่ยนรหัสผ่านใหม่ให้กับผู้ใช้งานคนนี้หรือไม่
                      </div>
                </div>
                <button type="button" class="btn btn-outline btn-sm"
                              id="btnQuickOpenPwdReset"
                              style="border-radius:var(--radius-s);font-size:12px;font-weight:600;">
                        🔑 เปลี่ยนรหัสผ่าน
                      </button>
              </div>
              `}
            </div>
          </div>
        </div>

        <div class="modal-foot"
             style="padding:14px 22px;border-top:1px solid var(--line);gap:10px;">
          <button type="button" class="btn btn-outline" id="mCancel"
                  style="border-radius:var(--radius-m);">
            ยกเลิก
          </button>
          <button type="submit" class="btn btn-primary"
                  style="border-radius:var(--radius-m);">
            ${ICONS.check} บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </form>
    `);

    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;

    const cbEnable = document.getElementById('cbEnableAccount');
    const accSec = document.getElementById('accEditDetailsSection');
    const posInput = document.getElementById('editPersonPositionInput');
    const roleSelect = document.getElementById('editPersonRoleSelect');

    function applyEditPreset() {
      const role = roleSelect?.value || 'user';
      const pos = (posInput?.value || '').toLowerCase();
      const cbAssets = document.querySelector('input[name="perm_assets"]');
      const cbCats = document.querySelector('input[name="perm_categories"]');
      const cbAssign = document.querySelector('input[name="perm_assignments"]');
      const cbMaint = document.querySelector('input[name="perm_maintenance"]');
      const cbSettings = document.querySelector('input[name="perm_settings"]');
      if (!cbAssets) return;

      if (role === 'admin') {
        cbAssets.checked = true;
        cbCats.checked = true;
        cbAssign.checked = true;
        cbMaint.checked = true;
        cbSettings.checked = true;
      } else {
        cbAssets.checked = /พัสดุ|ทะเบียน|ทรัพย์สิน|ไอที|it|admin|ผู้ดูแล/.test(pos);
        cbCats.checked = /พัสดุ|ทะเบียน|ทรัพย์สิน|ไอที|it|admin|ผู้ดูแล/.test(pos);
        cbAssign.checked = /พัสดุ|ทะเบียน|ทรัพย์สิน|ผู้จัดการ|หัวหน้า|ไอที|it|admin|ผู้ดูแล/.test(pos);
        cbMaint.checked = /ช่าง|ซ่อม|บำรุง|เทคนิค|engineer|technician|admin|ผู้ดูแล/.test(pos);
        cbSettings.checked = /ผู้ดูแล|admin/.test(pos);
      }
    }

    posInput?.addEventListener('input', applyEditPreset);
    roleSelect?.addEventListener('change', applyEditPreset);

    cbEnable?.addEventListener('change', () => {
      accSec.style.display = cbEnable.checked ? 'block' : 'none';
    });

    document.getElementById('btnToggleAllPermsEdit')?.addEventListener('click', () => {
      const allCb = document.querySelectorAll('#accEditDetailsSection input[name^="perm_"]');
      const allChecked = Array.from(allCb).every(c => c.checked);
      allCb.forEach(c => { c.checked = !allChecked; });
    });

    const openPwdInput = document.getElementById('newPwdForOpenInput');
    document.getElementById('btnRegenOpenPwd')?.addEventListener('click', () => {
      if (openPwdInput) {
        openPwdInput.value = generateRandomPassword(8);
        toast('สุ่มรหัสผ่านใหม่เรียบร้อยแล้ว');
      }
    });
    document.getElementById('btnCopyOpenPwd')?.addEventListener('click', () => {
      if (openPwdInput) {
        navigator.clipboard.writeText(openPwdInput.value);
        toast('คัดลอกรหัสผ่านแล้ว: ' + openPwdInput.value);
      }
    });

    document.getElementById('btnQuickOpenPwdReset')?.addEventListener('click', () => {
      closeModal();
      openPasswordUnifiedModal(target.id);
    });

    document.getElementById('editUnifiedPersonForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(ev.target).entries());
      const perms = [];
      ['assets', 'categories', 'assignments', 'maintenance', 'settings'].forEach(p => {
        if (ev.target.querySelector(`input[name="perm_${p}"]`)?.checked) perms.push(p);
      });
      if (fd.role === 'admin') perms.push('*');

      try {
        const posVal = fd.location ? fd.location.trim() : '';
        if (target.isEmployee) {
          await API.update('employees', target.id, {
            name: fd.name.trim(),
            departmentId: fd.departmentId || null,
            position: posVal,
            location: posVal
          });
        }

        const isEnableChecked = document.getElementById('cbEnableAccount')?.checked;

        if (target.hasAccount && isEnableChecked) {
          const userUpdates = {
            name: fd.name.trim(),
            departmentId: fd.departmentId || null,
            permissions: perms
          };
          if (!isSelf || target.role !== 'admin') {
            userUpdates.role = fd.role || 'user';
          }
          await API.update('users', target.userId, userUpdates);
        } else if (!target.hasAccount && isEnableChecked) {
          const newPwd = fd.newPasswordForOpen;
          if (!newPwd || newPwd.length < 6) {
            toast('รหัสผ่านสำหรับเปิดบัญชีต้องมีความยาวอย่างน้อย 6 ตัวอักษร', true);
            return;
          }
          await API.create('users', {
            username: target.id,
            password: newPwd,
            name: fd.name.trim(),
            role: fd.role || 'user',
            employeeId: target.id,
            departmentId: fd.departmentId || null,
            permissions: perms,
            mustChangePassword: 1
          });
        } else if (target.hasAccount && !isEnableChecked) {
          if (isSelf) {
            toast('ไม่สามารถปิดการใช้งานบัญชีของตนเองที่กำลังล็อกอินอยู่ได้', true);
            return;
          }
          await API.remove('users', target.userId);
        }

        closeModal();
        toast('บันทึกการแก้ไขเรียบร้อยแล้ว');
        await syncDB();
        userListCache = (await API.get('users')).data || [];
        renderUnifiedTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (err) {
        toast('เกิดข้อผิดพลาด: ' + err.message, true);
      }
    });
  }

  function openPasswordUnifiedModal(itemId) {
    const fullUnifiedList = getFullUnifiedList();
    const target = fullUnifiedList.find(x => x.id === itemId);
    if (!target) return;
    const autoPwd = generateRandomPassword(10);

    openModal(`
      <div class="modal-head" style="border-bottom:1px solid var(--line);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#fef3c7;
               color:#b45309;display:flex;align-items:center;
               justify-content:center;flex-shrink:0;font-size:17px;">
            🔑
          </div>
          <div>
            <h3 style="margin:0;font-size:15px;">
              ${target.hasAccount ? 'รีเซ็ตรหัสผ่าน' : 'ตั้งรหัสผ่านและเปิดบัญชี'}
            </h3>
            <div style="font-size:12px;color:var(--ink-500);margin-top:1px;">
              ${escapeHtml(target.name)}</div>
          </div>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <form id="pwdUnifiedForm">
        <div class="modal-body">
          <div style="background:var(--paper-alt);padding:10px 14px;
                 border-radius:var(--radius-s);margin-bottom:14px;
                 font-size:13px;line-height:1.7;">
            <div><b>Username:</b>
              <span style="font-family:monospace;font-weight:700;color:var(--navy-800);">
                ${escapeHtml(target.username || target.id)}
              </span>
            </div>
            <div><b>ชื่อ-สกุล:</b> ${escapeHtml(target.name)}</div>
          </div>

          ${target.hasAccount ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;
                 border-radius:var(--radius-s);padding:10px 14px;
                 margin-bottom:14px;font-size:12.5px;color:#92400e;line-height:1.6;">
            ⚠️ <b>หมายเหตุ:</b> หลังจาก Admin รีเซ็ตรหัสผ่านแล้ว ผู้ใช้จะถูก
              <b>บังคับให้ตั้งรหัสผ่านใหม่</b> ทันทีที่เข้าสู่ระบบครั้งถัดไป
          </div>
          ` : ''}

          <div class="field" style="margin-bottom:12px;">
            <label style="display:flex;justify-content:space-between;align-items:center;">
              <span>${target.hasAccount ? 'รหัสผ่านชั่วคราว' : 'รหัสผ่านเริ่มต้น'}
                  <span class="req">*</span></span>
              <span style="font-size:11.5px;color:var(--ink-500);">อย่างน้อย 6 ตัวอักษร</span>
            </label>
            <div style="display:flex;gap:6px;">
              <input type="text" name="newPassword" id="pwdNewInput"
                       value="${autoPwd}" required minlength="6"
                style="font-family:monospace;font-size:14.5px;font-weight:700;color:var(--navy-800);">
              <button type="button" class="btn btn-outline" id="btnRegenPwd"
                        title="สุ่มรหัสผ่านใหม่" style="padding:0 12px;flex-shrink:0;">
                  🔄
                </button>
              <button type="button" class="btn btn-outline" id="btnCopyPwd"
                        title="คัดลอกรหัสผ่าน" style="padding:0 12px;flex-shrink:0;">
                  📋
                </button>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
          <button type="submit" class="btn btn-primary">
            ${ICONS.check}${target.hasAccount ? 'รีเซ็ตรหัสผ่าน' : 'เปิดบัญชีและบันทึก'}
          </button>
        </div>
      </form>
    `);

    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;

    const pwdInput = document.getElementById('pwdNewInput');

    document.getElementById('btnRegenPwd')?.addEventListener('click', () => {
      pwdInput.value = generateRandomPassword(10);
      toast('สุ่มรหัสผ่านชั่วคราวใหม่แล้ว');
    });

    document.getElementById('btnCopyPwd')?.addEventListener('click', () => {
      navigator.clipboard.writeText(pwdInput.value);
      toast('คัดลอกรหัสผ่านแล้ว');
    });

    document.getElementById('pwdUnifiedForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(ev.target).entries());
      const newPwd = fd.newPassword;
      if (!newPwd || newPwd.length < 6) {
        toast('รหัสผ่านต้องมีความยาวไม่ต่ำกว่า 6 ตัวอักษร', true);
        return;
      }

      try {
        if (target.hasAccount && target.userId) {
          await API.update('users', target.userId, {
            password: newPwd,
            mustChangePassword: 1
          });
          API.log(
            'update',
            'employees',
            `Admin รีเซ็ตรหัสผ่านให้: ${target.name} (${target.username || target.id})`,
            target.userId,
            target.name
          );
        } else {
          await API.create('users', {
            username: target.id,
            password: newPwd,
            name: target.name,
            role: 'user',
            employeeId: target.id,
            departmentId: target.departmentId,
            mustChangePassword: 1
          });
          API.log(
            'create',
            'employees',
            `เปิดบัญชีผู้ใช้ใหม่สำหรับ: ${target.name} (${target.id})`,
            target.id,
            target.name
          );
        }
        closeModal();

        openModal(`
          <div class="modal-head">
        <h3>${target.hasAccount ? 'รีเซ็ตรหัสผ่านสำเร็จ' : 'เปิดบัญชีสำเร็จ'}</h3>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
          <div class="modal-body">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                 color:#166534;padding:12px;border-radius:var(--radius-s);
                 font-size:13px;margin-bottom:16px;">
              ${target.hasAccount
                ? `✅ รีเซ็ตรหัสผ่านเรียบร้อยแล้ว
                   ผู้ใช้จะถูกบังคับเปลี่ยนรหัสผ่านใหม่ทันทีที่เข้าสู่ระบบครั้งถัดไป`
                : `✅ สร้างบัญชีผู้ใช้งานใหม่เรียบร้อยแล้ว
                   ผู้ใช้จะถูกบังคับเปลี่ยนรหัสผ่านใหม่ทันทีที่เข้าสู่ระบบ`}
            </div>
            <div style="background:var(--paper-alt);border:1px solid var(--line);
                 border-radius:var(--radius-s);padding:14px;
                 font-family:monospace;font-size:14px;line-height:1.9;">
              <div><b>Username:</b>
                <span style="color:var(--navy-800);font-weight:700;">
                  ${escapeHtml(target.username || target.id)}
                </span>
              </div>
              <div><b>รหัสผ่านชั่วคราว:</b>
                <span style="color:var(--primary,#7e1721);font-weight:bold;">
                  ${escapeHtml(newPwd)}
                </span>
              </div>
              <div><b>ชื่อ-สกุล:</b> ${escapeHtml(target.name)}</div>
            </div>
            <div style="font-size:12px;color:var(--amber-700);margin-top:10px;
                  padding:8px 12px;background:#fffbeb;border-radius:var(--radius-s);
                  border:1px solid #fde68a;">
              📋 คัดลอกข้อมูลนี้ส่งให้ผู้ใช้ — ผู้ใช้จะต้องตั้งรหัสผ่านใหม่ด้วยตนเองหลังจาก Login
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-outline" id="mCloseSuccess">ปิด</button>
            <button type="button" class="btn btn-primary" id="btnCopyPwdDone">
              📋 คัดลอกข้อมูลส่งให้ผู้ใช้
            </button>
          </div>
        `);
        document.getElementById('mClose').onclick = closeModal;
        document.getElementById('mCloseSuccess').onclick = closeModal;
        document.getElementById('btnCopyPwdDone')?.addEventListener('click', () => {
          const credText = [
            'ข้อมูลเข้าสู่ระบบจัดการทรัพย์สิน',
            `Username: ${target.username || target.id}`,
            `รหัสผ่านชั่วคราว: ${newPwd}`,
            `ชื่อ-สกุล: ${target.name}`,
            '',
            '⚠️ กรุณาเปลี่ยนรหัสผ่านใหม่ทันทีหลังจาก Login'
          ].join('\n');
          navigator.clipboard.writeText(credText);
          toast('คัดลอกข้อมูลแล้ว');
        });

        await syncDB();
        userListCache = (await API.get('users')).data || [];
        renderUnifiedTable();
      } catch (err) {
        toast('เกิดข้อผิดพลาด: ' + err.message, true);
      }
    });
  }

  function openDeleteUnifiedModal(itemId) {
    const fullUnifiedList = getFullUnifiedList();
    const target = fullUnifiedList.find(x => x.id === itemId);
    if (!target) return;

    const currentUser = _options.currentUser;
    const isSelf = currentUser && (
      currentUser.id === target.userId ||
      currentUser.username === target.username
    );

    if (isSelf) {
      toast('ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้', true);
      return;
    }
    if (target.username === 'admin' || target.userId === 'usr_admin') {
      toast('ไม่สามารถลบผู้ดูแลระบบหลักของระบบได้', true);
      return;
    }
    if ((Number(target.assetsCount) || 0) > 0 ||
        DB.assets.some(a => a.holderId === target.id) ||
        DB.assignments.some(a => a.employeeId === target.id)) {
      toast(
        'ไม่สามารถลบได้ เนื่องจากบุคลากรนี้มีประวัติหรือกำลังถือครองทรัพย์สิน' +
        'อยู่ในระบบ กรุณาโอนย้ายทรัพย์สินก่อน',
        true
      );
      return;
    }

    openModal(`
      <div class="modal-head" style="border-bottom:1px solid #fee2e2;background:#fff5f5;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:#fee2e2;
               color:#dc2626;display:flex;align-items:center;
               justify-content:center;flex-shrink:0;">
            ${ICONS.trash}
          </div>
          <h3 style="margin:0;color:#991b1b;">ยืนยันการลบข้อมูล</h3>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <p style="margin:0;font-size:14px;color:var(--ink-800);">
          คุณต้องการลบข้อมูลบุคลากร <b>${escapeHtml(target.name)}</b> (รหัส: ${escapeHtml(target.id)})
          ${target.hasAccount ? 'รวมถึงบัญชีผู้ใช้งานระบบ' : ''} ใช่หรือไม่?
        </p>
        <p style="font-size:12.5px;color:var(--red-700);margin-top:8px;">⚠️ การลบจะไม่สามารถกู้คืนได้</p>
      </div>
      <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
        <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button class="btn btn-danger" id="mConfirmDelUnified">${ICONS.trash} ยืนยันการลบ</button>
      </div>
    `);

    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;
    document.getElementById('mConfirmDelUnified').onclick = async () => {
      const btn = document.getElementById('mConfirmDelUnified');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังลบ...'; }
      try {
        if (target.isEmployee) {
          await API.remove('employees', target.id);
        }
        if (target.hasAccount && target.userId) {
          await API.remove('users', target.userId);
        }
        API.log(
          'delete',
          'employees',
          `ลบข้อมูลบุคลากร: ${target.name} (รหัส: ${target.id})`,
          target.id,
          target.name
        );
        unifiedSelection = unifiedSelection.filter(id => id !== target.id);
        closeModal();
        toast('ลบข้อมูลเรียบร้อยแล้ว');
        await syncDB();
        userListCache = (await API.get('users')).data || [];
        renderUnifiedTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (err) {
        toast('ลบไม่สำเร็จ: ' + err.message, true);
        if (btn) { btn.disabled = false; btn.innerHTML = `${ICONS.trash} ยืนยันการลบ`; }
      }
    };
  }

  function handleBulkUnifiedDelete() {
    const fullUnifiedList = getFullUnifiedList();
    const itemsToDelete = fullUnifiedList.filter(item => unifiedSelection.includes(item.id));
    const currentUser = _options.currentUser;

    const safeToDelete = itemsToDelete.filter(item => {
      const isSelf = currentUser && (
        currentUser.id === item.userId ||
        currentUser.username === item.username
      );
      const isMainAdmin = item.username === 'admin' || item.userId === 'usr_admin';
      const hasAssets = (Number(item.assetsCount) || 0) > 0 ||
        DB.assets.some(a => a.holderId === item.id) ||
        DB.assignments.some(a => a.employeeId === item.id);
      return !isSelf && !isMainAdmin && !hasAssets;
    });

    if (safeToDelete.length === 0) {
      toast('ไม่มีรายการที่สามารถลบได้ (เป็นบัญชีผู้ดูแลระบบหลัก หรือมีทรัพย์สินถือครองอยู่)', true);
      return;
    }

    openModal(`
      <div class="modal-head" style="border-bottom:1px solid #fee2e2;background:#fff5f5;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:#fee2e2;
               color:#dc2626;display:flex;align-items:center;
               justify-content:center;flex-shrink:0;">
            ${ICONS.trash}
          </div>
          <h3 style="margin:0;color:#991b1b;">ยืนยันการลบหลายรายการ</h3>
        </div>
        <button class="modal-close" id="mClose">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <p style="margin:0;font-size:14px;color:var(--ink-800);">
          คุณต้องการลบข้อมูลบุคลากรและบัญชีผู้ใช้งานที่เลือกจำนวน
          <b>${safeToDelete.length}</b> รายการ ใช่หรือไม่?
        </p>
        ${safeToDelete.length < itemsToDelete.length ? `
          <p style="font-size:12.5px;color:var(--amber-700);margin-top:8px;line-height:1.5;">
            ⚠️ ข้าม ${itemsToDelete.length - safeToDelete.length} รายการ
            (เนื่องจากเป็นบัญชีของคุณเอง ผู้ดูแลระบบหลัก หรือมีทรัพย์สินถือครองอยู่)
          </p>
        ` : ''}
        <div style="max-height:160px;overflow-y:auto;background:var(--paper-alt);
                    border:1px solid var(--line);border-radius:var(--radius-s);
                    padding:8px 12px;margin-top:12px;font-size:13px;">
          ${safeToDelete.map(item => `
            <div>• <b>${escapeHtml(item.id)}</b> - ${escapeHtml(item.name)}</div>
          `).join('')}
        </div>
      </div>
      <div class="modal-foot" style="background:var(--paper-alt);border-top:1px solid var(--line);">
        <button class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button class="btn btn-danger" id="mConfirmBulkUnified">
            ${ICONS.trash} ยืนยันการลบ ${safeToDelete.length} รายการ
          </button>
      </div>
    `);

    document.getElementById('mClose').onclick = closeModal;
    document.getElementById('mCancel').onclick = closeModal;
    document.getElementById('mConfirmBulkUnified').onclick = async () => {
      const btn = document.getElementById('mConfirmBulkUnified');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังลบ...'; }
      try {
        const delCount = safeToDelete.length;
        await Promise.all(safeToDelete.map(async item => {
          if (item.isEmployee) await API.remove('employees', item.id);
          if (item.hasAccount && item.userId) await API.remove('users', item.userId);
        }));

        API.log('delete', 'employees', `ลบข้อมูลบุคลากรและบัญชีแบบกลุ่มจำนวน ${delCount} รายการ`);
        unifiedSelection = unifiedSelection.filter(id => !safeToDelete.some(item => item.id === id));
        closeModal();
        toast('ลบรายการที่เลือกเรียบร้อยแล้ว');
        await syncDB();
        userListCache = (await API.get('users')).data || [];
        renderUnifiedTable();
        if (_options.onDataChange) _options.onDataChange();
      } catch (err) {
        toast('เกิดข้อผิดพลาดในการลบ: ' + err.message, true);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${ICONS.trash} ยืนยันการลบ ${safeToDelete.length} รายการ`;
        }
      }
    };
  }

  function init(options = {}) {
    _options = options;
    userListCache = options.userListCache || [];

    document.getElementById('unifiedSearchInput')?.addEventListener('input', e => {
      unifiedSearch = e.target.value;
      unifiedPagination.page = 1;
      renderUnifiedTable();
    });

    document.getElementById('unifiedRoleSelect')?.addEventListener('change', e => {
      unifiedRoleFilter = e.target.value;
      unifiedPagination.page = 1;
      renderUnifiedTable();
    });

    document.getElementById('selectAllUnifiedCheckbox')?.addEventListener('change', e => {
      const fullUnifiedList = getFullUnifiedList();
      const filtered = fullUnifiedList.filter(item => {
        if (unifiedRoleFilter === 'admin' && item.role !== 'admin') return false;
        if (unifiedRoleFilter === 'user' && item.role !== 'user') return false;
        if (unifiedRoleFilter === 'no_account' && item.hasAccount) return false;
        if (unifiedSearch.trim()) {
          const q = unifiedSearch.toLowerCase().trim();
          return item.id.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            (item.username ? item.username.toLowerCase().includes(q) : false) ||
            item.departmentName.toLowerCase().includes(q) ||
            item.position.toLowerCase().includes(q);
        }
        return true;
      });

      const startIdx = (unifiedPagination.page - 1) * unifiedPagination.limit;
      const paginated = filtered.slice(startIdx, startIdx + unifiedPagination.limit);

      if (e.target.checked) {
        paginated.forEach(item => {
          if (!unifiedSelection.includes(item.id)) unifiedSelection.push(item.id);
        });
      } else {
        unifiedSelection = unifiedSelection.filter(id => !paginated.some(item => item.id === id));
      }
      updateUnifiedSelectionUI(paginated);
    });

    document.getElementById('btnBulkUnifiedAction')?.addEventListener('click', handleBulkUnifiedDelete);
    document.getElementById('btnAddUnifiedPerson')?.addEventListener('click', openAddUnifiedModal);

    renderUnifiedTable();
  }

  window.SettingsUsers = {
    init,
    renderTable: renderUnifiedTable,
    setUserListCache: users => { userListCache = users || []; },
    getUserListCache: () => userListCache,
    generateRandomPassword
  };
})();
