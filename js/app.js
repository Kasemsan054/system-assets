/* ---------------------------- Router / Nav ---------------------------- */
const NAV_GROUPS = [
  {
    title: 'งานบริการและทรัพย์สิน',
    items: [
      {path:'/dashboard', label:'แดชบอร์ด', icon:'dashboard'},
      {path:'/assets', label:'ทะเบียนทรัพย์สิน', icon:'assets'},
      {path:'/assignments', label:'การเบิก–ยืม/มอบหมาย', icon:'assign'},
      {path:'/maintenance', label:'ซ่อมบำรุง', icon:'maintenance'},
    ]
  },
  {
    title: 'การจัดการระบบ',
    items: [
      {path:'/categories', label:'หมวดหมู่ทรัพย์สิน', icon:'category', perm:'categories'},
      {path:'/settings', label:'ตั้งค่าระบบ', icon:'settings', perm:'settings'},
    ]
  }
];

function navigateTo(url, replace = false) {
  if (replace) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
  router();
}
window.navigateTo = navigateTo;

function toggleSidebar(open){
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if(open === undefined){
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
  } else if(open){
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  } else {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }
}

function updateSidebarUser(){
  const token = localStorage.getItem('ams_token');
  const userBox = document.getElementById('sidebarUserWrap') || document.getElementById('sidebarUser');
  if(!userBox) return;

  if(!token){
    userBox.style.display = 'none';
    return;
  }
  userBox.style.display = 'block';

  const user = API.getUser();
  const isAdmin = API.isAdmin();
  const userName = API.getUserName();
  const userPos = API.getUserPosition();
  const roleBadge = isAdmin ? 'Admin' : (userPos || 'User');
  const roleClass = isAdmin ? 'admin' : 'user';
  const avatarText = isAdmin ? 'ผด' : (userName.slice(0,2) || 'จน');
  const empIdText = user.username || user.employeeId || (isAdmin ? 'admin' : 'user');
  const deptName = user.departmentId ? (getDepartment(user.departmentId)?.name || '') : '';

  userBox.innerHTML = `
    <div class="sidebar-user" id="sidebarUserBtn"
         title="จัดการบัญชีของคุณ (${escapeHtml(userName)})"
         role="button" tabindex="0">
      <div class="sidebar-user-avatar-wrap">
        <div class="sidebar-user-avatar ${roleClass}">${avatarText}</div>
        <span class="sidebar-user-status-dot" title="ออนไลน์"></span>
      </div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name" title="${escapeHtml(userName)}">${escapeHtml(userName)}</div>
        <div class="sidebar-user-sub"
             title="${escapeHtml(userPos || (isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'))}">
          ${escapeHtml(userPos || (isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'))}
        </div>
        <span class="role-badge ${roleClass}">${escapeHtml(roleBadge)}</span>
      </div>
      <div class="sidebar-user-chevron">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" width="16" height="16">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>

    <div class="sidebar-user-dropdown" id="sidebarUserDropdown">
      <div class="sidebar-dropdown-header">
        <div class="sd-avatar-row">
          <div class="sidebar-user-avatar ${roleClass}"
               style="width:38px;height:38px;font-size:13.5px;">
            ${avatarText}
          </div>
          <div class="sd-profile-info">
            <div class="sd-name" title="${escapeHtml(userName)}">${escapeHtml(userName)}</div>
            <div class="sd-username">รหัส: ${escapeHtml(empIdText)}</div>
          </div>
        </div>
        <div class="sd-meta-row">
          <span class="role-badge ${roleClass}">${escapeHtml(roleBadge)}</span>
          ${deptName ? `
            <span class="sd-dept-tag" title="${escapeHtml(deptName)}">
              ${escapeHtml(deptName)}
            </span>` : ''}
        </div>
      </div>

      <div class="sd-menu-list">
        <button type="button" class="sidebar-dropdown-item" id="btnSidebarChangePwd">
          <div class="sd-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              <circle cx="12" cy="16" r="1"/>
            </svg>
          </div>
          <div class="sd-item-text">
            <div class="sd-item-title">เปลี่ยนรหัสผ่าน</div>
            <div class="sd-item-desc">อัปเดตรหัสผ่านใหม่ของคุณ</div>
          </div>
        </button>
      </div>

      <div class="sd-divider"></div>

      <button type="button" class="sidebar-dropdown-item danger" id="btnSidebarLogout">
        <div class="sd-item-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <div class="sd-item-text">
          <div class="sd-item-title">ออกจากระบบ</div>
          <div class="sd-item-desc">สิ้นสุดการเข้าใช้งานระบบ</div>
        </div>
      </button>
    </div>
  `;

  const btn = document.getElementById('sidebarUserBtn');
  const dropdown = document.getElementById('sidebarUserDropdown');

  function closeDropdown() {
    dropdown?.classList.remove('show');
    btn?.classList.remove('active');
  }

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('show');
    if (isOpen) {
      closeDropdown();
    } else {
      dropdown.classList.add('show');
      btn.classList.add('active');
    }
  });

  btn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });

  document.getElementById('btnSidebarChangePwd')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDropdown();
    openChangePasswordModal();
  });

  document.getElementById('btnSidebarLogout')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDropdown();
    API.logout();
    navigateTo('/login');
    toast('ออกจากระบบแล้ว');
  });

  // Global click-outside and escape key listener
  if (!window._sidebarDropdownClickBound) {
    window._sidebarDropdownClickBound = true;
    document.addEventListener('click', (e) => {
      const dd = document.getElementById('sidebarUserDropdown');
      const uBtn = document.getElementById('sidebarUserBtn');
      if (dd && !dd.contains(e.target) && !uBtn?.contains(e.target)) {
        dd.classList.remove('show');
        uBtn?.classList.remove('active');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const dd = document.getElementById('sidebarUserDropdown');
        const uBtn = document.getElementById('sidebarUserBtn');
        dd?.classList.remove('show');
        uBtn?.classList.remove('active');
      }
    });
  }
}

function openChangePasswordModal(){
  const userName = API.getUserName();
  openModal(`
    <div class="modal-head">
      <h3>เปลี่ยนรหัสผ่าน (${escapeHtml(userName)})</h3>
      <button class="modal-close" id="mClose">${ICONS.x}</button>
    </div>
    <form id="sidebarChangePwdForm">
      <div class="modal-body">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;` +
                   `border-radius:var(--radius-m);padding:12px 14px;` +
                   `font-size:13px;margin-bottom:16px;line-height:1.5;">
          🔒 กรุณากำหนดรหัสผ่านใหม่ที่มีความยาวอย่างน้อย 6 ตัวอักษร
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label>รหัสผ่านใหม่ <span style="color:var(--red-600);">* (อย่างน้อย 6 ตัวอักษร)</span></label>
          <input type="password" name="newPassword" id="modalNewPwd" minlength="6"
                 required placeholder="กรอกรหัสผ่านใหม่" autocomplete="new-password">
        </div>
        <div class="field" style="margin-bottom:6px;">
          <label>ยืนยันรหัสผ่านใหม่ <span style="color:var(--red-600);">*</span></label>
          <input type="password" name="confirmPassword" id="modalConfirmPwd" minlength="6"
                 required placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" autocomplete="new-password">
        </div>
        <div id="modalChangePwdErr"
             style="color:var(--red-600);font-size:12.5px;min-height:18px;margin-top:6px;">
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" id="mCancel">ยกเลิก</button>
        <button type="submit" class="btn btn-primary" id="btnModalSavePwd">
          ${ICONS.check} บันทึกรหัสผ่านใหม่
        </button>
      </div>
    </form>
  `);

  document.getElementById('mClose').onclick = closeModal;
  document.getElementById('mCancel').onclick = closeModal;
  
  const form = document.getElementById('sidebarChangePwdForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('modalChangePwdErr');
    errEl.textContent = '';
    const newPwd = document.getElementById('modalNewPwd').value.trim();
    const confirmPwd = document.getElementById('modalConfirmPwd').value.trim();
    if (newPwd.length < 6) {
      errEl.textContent = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
      return;
    }
    if (newPwd !== confirmPwd) {
      errEl.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบ';
      return;
    }
    const currentUser = API.getUser();
    if (!currentUser?.id) {
      errEl.textContent = 'ไม่พบข้อมูลผู้ใช้งาน กรุณาออกจากระบบแล้วเข้าใหม่';
      return;
    }
    const btnSave = document.getElementById('btnModalSavePwd');
    if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'กำลังบันทึก...'; }
    try {
      await API.update('users', currentUser.id, { password: newPwd });
      localStorage.removeItem('ams_must_change_pwd');
      closeModal();
      toast('เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว');
    } catch(err) {
      if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = `${ICONS.check} บันทึกรหัสผ่านใหม่`; }
      errEl.textContent = 'เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    }
  };
}

function getRouteInfo() {
  // If arrived with legacy hash e.g. #/assets/AST-001, migrate immediately to clean path
  if (location.hash && location.hash.startsWith('#/')) {
    const clean = location.hash.slice(1);
    history.replaceState(null, '', clean);
  }

  const rawPath = location.pathname.replace(/^\/+|\/+$/g, '');
  // Ignore index.html or 404.html in path
  const cleanPath = (rawPath === 'index.html' || rawPath === '404.html' || !rawPath) ? '' : rawPath;
  const parts = cleanPath.split('/');
  const token = localStorage.getItem('ams_token');
  const route = parts[0] || (token ? 'dashboard' : 'login');
  const param = parts.slice(1).join('/') || null;
  return { route, param };
}

function renderSidebarNav(){
  const { route } = getRouteInfo();
  const currentBase = '/' + route;
  const token = localStorage.getItem('ams_token');
  const navContainer = document.getElementById('sidebarNav');
  
  // Hide nav if not logged in
  if (!token) {
    if(navContainer) navContainer.innerHTML = '';
    updateSidebarUser();
    return;
  }
  
  let navHtml = '';

  NAV_GROUPS.forEach(group => {
    const visibleItems = group.items.filter(item => {
      if (item.perm && !API.canEdit(item.perm)) return false;
      return true;
    });
    if(visibleItems.length === 0) return;

    navHtml += `<div class="nav-group">`;
    navHtml += `<div class="nav-group-title">${group.title}</div>`;
    
    visibleItems.forEach(n => {
      const active = currentBase === n.path;
      let badgeHtml = '';
      
      // Dynamic count badges — prefer server-side counts (accurate on every page),
      // fall back to whatever is cached from a page the user has already opened.
      if(n.path === '/maintenance'){
        const activeMaint = DB._counts?.activeMaintenance ??
          (DB.maintenance || []).filter(m => m.status === 'in_progress').length;
        if(activeMaint > 0) badgeHtml = `<span class="nav-badge" title="งานซ่อมค้าง ${activeMaint} รายการ">${activeMaint}</span>`;
      } else if(n.path === '/assignments'){
        const activeAssigned = DB._counts?.activeAssignments ??
          (DB.assignments || []).filter(a => !a.dateReturn).length;
        if(activeAssigned > 0) badgeHtml = `<span class="nav-badge" title="กำลังถือครอง ${activeAssigned} รายการ">${activeAssigned}</span>`;
      }

      navHtml += `<a class="nav-item ${active?'active':''}" href="${n.path}" data-path="${n.path}">
        ${ICONS[n.icon]}
        <span>${n.label}</span>
        ${badgeHtml}
      </a>`;
    });
    navHtml += `</div>`;
  });

  if(navContainer) navContainer.innerHTML = navHtml;
  updateSidebarUser();
  
  document.querySelectorAll('.nav-item[data-path]').forEach(el=>{
    el.addEventListener('click', (e)=>{ 
      e.preventDefault();
      navigateTo(el.dataset.path); 
      toggleSidebar(false);
    });
  });
}

function checkMustChangePassword(){
  const token = localStorage.getItem('ams_token');
  const mustChange = localStorage.getItem('ams_must_change_pwd') === 'true';
  if(!token || !mustChange) return;
  if(document.getElementById('forceChangePwdModal')) return;

  openModal(`
    <div id="forceChangePwdModal" style="max-width:460px;">
      <div class="modal-head"
           style="background:var(--paper-alt);border-bottom:1px solid var(--line);padding:14px 18px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:38px;height:38px;border-radius:50%;background:#fef3c7;` +
                     `color:#d97706;display:flex;align-items:center;` +
                     `justify-content:center;flex-shrink:0;">
            ${ICONS.lock}
          </div>
          <div>
            <h3 style="margin:0;font-size:16px;color:var(--ink-900);">
              แจ้งเตือน: เปลี่ยนรหัสผ่านเข้าสู่ระบบ
            </h3>
            <div style="font-size:12px;color:var(--ink-500);">
              กรุณาเปลี่ยนรหัสผ่านสำหรับการเข้าสู่ระบบครั้งแรก
            </div>
          </div>
        </div>
      </div>
      <form id="forceChangePwdForm">
        <div class="modal-body" style="padding:18px 20px;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;` +
                     `border-radius:var(--radius-m);padding:12px 14px;` +
                     `font-size:13px;margin-bottom:16px;line-height:1.5;">
            🔒 คุณเข้าสู่ระบบด้วยรหัสผ่านเริ่มต้นของระบบ เพื่อความปลอดภัย
            กรุณากำหนดรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร) ก่อนเข้าใช้งาน
          </div>
          <div class="field" style="margin-bottom:14px;">
            <label>รหัสผ่านใหม่
              <span style="color:var(--red-600); font-weight:normal;">* (อย่างน้อย 6 ตัวอักษร)</span>
            </label>
            <input type="password" name="newPassword" id="forceNewPwd" minlength="6"
                   required placeholder="กรอกรหัสผ่านใหม่" autocomplete="new-password">
          </div>
          <div class="field" style="margin-bottom:6px;">
            <label>ยืนยันรหัสผ่านใหม่
              <span style="color:var(--red-600); font-weight:normal;">*</span>
            </label>
            <input type="password" name="confirmPassword" id="forceConfirmPwd" minlength="6"
                   required placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" autocomplete="new-password">
          </div>
          <div id="forcePwdErr"
               style="color:var(--red-600);font-size:12.5px;min-height:18px;margin-top:6px;">
          </div>
        </div>
        <div class="modal-foot" style="padding:12px 20px;">
          <button type="button" class="btn btn-outline" id="btnForceLogout">ออกจากระบบ</button>
          <button type="submit" class="btn btn-primary" id="btnForceSave">
            ${ICONS.check} บันทึกรหัสผ่านใหม่
          </button>
        </div>
      </form>
    </div>
  `, { noBackdropClose: true });

  const form = document.getElementById('forceChangePwdForm');
  const errEl = document.getElementById('forcePwdErr');
  const btnLogout = document.getElementById('btnForceLogout');

  if(btnLogout){
    btnLogout.onclick = () => {
      API.logout();
      closeModal();
      navigateTo('/login');
      toast('ออกจากระบบแล้ว');
    };
  }

  if(form){
    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.textContent = '';
      const newPwd = document.getElementById('forceNewPwd').value.trim();
      const confirmPwd = document.getElementById('forceConfirmPwd').value.trim();

      if(newPwd.length < 6){
        errEl.textContent = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
        return;
      }
      if(newPwd !== confirmPwd){
        errEl.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบ';
        return;
      }

      const currentUser = API.getUser();
      if(!currentUser || !currentUser.id){
        errEl.textContent = 'ไม่พบข้อมูลผู้ใช้งาน กรุณาออกจากระบบแล้วเข้าใหม่';
        return;
      }

      const btnSave = document.getElementById('btnForceSave');
      if(btnSave) { btnSave.disabled = true; btnSave.textContent = 'กำลังบันทึก...'; }

      try {
        await API.update('users', currentUser.id, { password: newPwd });

        localStorage.removeItem('ams_must_change_pwd');
        closeModal();
        toast('เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว ยินดีต้อนรับเข้าสู่ระบบ!');
      } catch(err) {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = `${ICONS.check} บันทึกรหัสผ่านใหม่`;
        }
        errEl.textContent = 'เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }
    };
  }
}

function setHeader(breadcrumb, title){
  document.getElementById('breadcrumb').textContent = breadcrumb;
  document.getElementById('pageTitle').textContent = title;
}

async function router(){
  const { route, param } = getRouteInfo();
  if (window.APP_DEV) {
    const targetStr = `/${route}${param ? '/' + param : ''}`;
    console.log(`%c[Router] 🧭 Navigating to: ${targetStr}`, 'color:#8b5cf6;font-weight:600;');
  }
  renderSidebarNav();
  const view = document.getElementById('view');

  // Toggle login-mode class on body to hide sidebar/topbar when on login page
  if (route === 'login') {
    document.body.classList.add('login-mode');
  } else {
    document.body.classList.remove('login-mode');
  }

  const token = localStorage.getItem('ams_token');
  if (!token && route !== 'login') {
    navigateTo('/login', true);
    return;
  }

  // Check first-login password change
  if (token && route !== 'login') {
    checkMustChangePassword();
    
    // Guard system management routes if not permitted
    if (route === 'settings' && !API.canEdit('settings')) {
      toast('คุณไม่มีสิทธิ์เข้าถึงหน้าการตั้งค่าระบบ', true);
      navigateTo('/dashboard', true);
      return;
    }
    if (route === 'categories' && !API.canEdit('categories')) {
      toast('คุณไม่มีสิทธิ์เข้าถึงหน้าหมวดหมู่ทรัพย์สิน', true);
      navigateTo('/dashboard', true);
      return;
    }
  }

  const routes = {
    login: async ()=> await renderLogin(view),
    dashboard: async ()=> await renderDashboard(view),
    assets: async ()=> param ? await renderAssetDetail(view, param) : await renderAssetsList(view),
    categories: async ()=> await renderCategories(view),
    assignments: async ()=> await renderAssignments(view),
    maintenance: async ()=> await renderMaintenance(view),
    settings: async ()=> await renderSettings(view),
  };
  
  try {
    if(route !== 'login' && !DB._bootstrapped) {
      view.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--ink-500);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" class="spinner">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg> กำลังโหลดข้อมูล...
        </div>`;
      await syncDB();
    }
    const renderFn = routes[route] || routes.dashboard;
    await renderFn();
  } catch (err) {
    // [FIX B9] Show actionable error UI with retry instead of just displaying err.message
    console.error(`[router] ❌ Render failed for route '${route}':`, err);
    view.innerHTML = `
      <div style="padding:48px 24px;text-align:center;max-width:480px;margin:0 auto;">
        <div style="width:52px;height:52px;border-radius:50%;background:#fef2f2;` +
                   `color:#dc2626;display:flex;align-items:center;` +
                   `justify-content:center;margin:0 auto 16px;font-size:22px;">⚠️</div>
        <h3 style="margin:0 0 8px;color:var(--ink-900);font-size:17px;">เกิดข้อผิดพลาด</h3>
        <p style="color:var(--ink-500);font-size:13.5px;margin:0 0 20px;line-height:1.6;">
          ${escapeHtml(err.message || 'ไม่สามารถโหลดหน้านี้ได้')}
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button onclick="router()"
                  style="padding:8px 20px;border-radius:8px;background:var(--accent-600,#7c3aed);` +
                        `color:#fff;border:none;cursor:pointer;font-size:14px;font-weight:600;">
            🔄 ลองใหม่
          </button>
          <button onclick="navigateTo('/dashboard')"
                  style="padding:8px 20px;border-radius:8px;` +
                        `background:transparent;color:var(--ink-600);` +
                        `border:1px solid var(--line);cursor:pointer;font-size:14px;">
            🏠 แดชบอร์ด
          </button>
        </div>
        <p style="color:var(--ink-400);font-size:11.5px;margin:16px 0 0;">
          รายละเอียด: ${escapeHtml(err.message)} — ดูเพิ่มเติมใน Console (F12)
        </p>
      </div>`;
  }
  window.scrollTo(0,0);
}

function rerender(){ router(); }

/** Fetch small server-side counts for the sidebar badges so they are correct on every page. */
async function loadSidebarCounts(){
  if(!API.isLoggedIn()) return;
  try{
    const [asg, mnt, heldAssets] = await Promise.all([
      API.get('assignments', { open: 'true', limit: 1 }).catch(() => null),
      API.get('maintenance', { status: 'in_progress', limit: 1 }).catch(() => null),
      API.get('assets', { held: 'true', limit: 1 }).catch(() => null),
    ]);
    if(!API.isLoggedIn()) return;
    const activeCount = Math.max(asg?.total ?? 0, heldAssets?.total ?? 0);
    DB._counts = {
      activeAssignments: activeCount || (DB._counts?.activeAssignments ?? 0),
      activeMaintenance: mnt?.total ?? DB._counts?.activeMaintenance ?? 0,
    };
    renderSidebarNav();
  }catch(e){ /* non-blocking */ }
}

/* ---------------------------- Real-time Silent Auto-Sync ---------------------------- */
let _syncTimer = null;
let _isSyncing = false;

async function silentAutoSync() {
  if (_isSyncing) return;
  // Skip if tab is hidden, modal is active, or not logged in
  if (document.hidden || document.querySelector('.modal-backdrop') ||
      !localStorage.getItem('ams_token')) return;

  _isSyncing = true;
  try {
    await syncDB();
    loadSidebarCounts();
    const { route } = getRouteInfo();
    
    // Smoothly update dashboard if user is viewing it
    if (route === 'dashboard') {
      const view = document.getElementById('view');
      if (view && typeof renderDashboard === 'function') {
        await renderDashboard(view, true);
      }
    }
    renderSidebarNav();
  } catch(e) {
    // Non-blocking background sync error ignore
  } finally {
    _isSyncing = false;
  }
}

function startAutoSync() {
  if (_syncTimer) clearInterval(_syncTimer);
  // Auto-sync every 15s in background without lag
  _syncTimer = setInterval(silentAutoSync, 15000);

  // Sync on tab re-focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) silentAutoSync();
  });
  window.addEventListener('focus', () => {
    silentAutoSync();
  });

  // Listen to instant log events
  window.addEventListener('app:log-added', () => {
    const { route } = getRouteInfo();
    if (route === 'dashboard') {
      const view = document.getElementById('view');
      if (view && typeof renderDashboard === 'function') {
        renderDashboard(view, true);
      }
    }
    renderSidebarNav();
  });
}

/* ---------------------------- Branding / boot ---------------------------- */
function applyBranding(){
  // Keep the fixed asset-system logo (SVG in .brand-mark); only the org name is dynamic.
  const orgEl = document.getElementById('brandOrgName');
  if (orgEl) orgEl.textContent = DB.orgName || 'องค์กรของคุณ';
}
function updateClock(){
  const now = new Date();
  const days=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const dateStr = fmtDate(now.toISOString());
  document.getElementById('todayPill').textContent = `วัน${days[now.getDay()]}ที่ ${dateStr}`;
}

function wireGlobalUI(){
  if (window._globalUIWired) return;
  window._globalUIWired = true;

  // Safety net: catch anything that slips past a view's own try/catch so the app never
  // breaks silently. Logged always; surfaced as a toast only in dev (?debug=1 on prod).
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason || 'unknown');
    console.error('[global] Unhandled promise rejection:', e.reason);
    if (window.APP_DEV && typeof toast === 'function') toast('ข้อผิดพลาดที่ไม่ถูกจัดการ: ' + msg, true);
  });
  window.addEventListener('error', (e) => {
    // Ignore resource load errors (img/script) — only report real script exceptions.
    if (e.error) console.error('[global] Uncaught error:', e.error);
  });

  // Mobile sidebar controls
  document.getElementById('hamburgerBtn')?.addEventListener('click', ()=> toggleSidebar(true));
  document.getElementById('sidebarCloseBtn')?.addEventListener('click', ()=> toggleSidebar(false));
  document.getElementById('sidebarBackdrop')?.addEventListener('click', ()=> toggleSidebar(false));

  // Clean HTML5 path routing with popstate
  window.addEventListener('popstate', router);
  // Backward compatibility: redirect any legacy hash bookmarks
  window.addEventListener('hashchange', () => {
    if (location.hash && location.hash.startsWith('#/')) {
      history.replaceState(null, '', location.hash.slice(1));
    }
    router();
  });

  // Global click interception for clean SPA links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    const isInternal = href && href.startsWith('/') && !href.startsWith('/api') &&
                       !href.startsWith('//') && link.target !== '_blank';
    if (isInternal) {
      e.preventDefault();
      navigateTo(href);
    }
  });

  // Keep the date pill correct across midnight
  setInterval(updateClock, 60 * 1000);
}

function showConnectionError(){
  const view = document.getElementById('view');
  if (!view) return;
  console.error('[boot] ❌ Total sync failure — showing retry screen');
  view.innerHTML = `
    <div style="padding:64px 24px;text-align:center;max-width:440px;margin:0 auto;">
      <div style="font-size:40px;margin-bottom:16px;">📡</div>
      <h3 style="margin:0 0 10px;color:var(--ink-900);font-size:18px;">
        ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้
      </h3>
      <p style="color:var(--ink-500);font-size:13.5px;margin:0 0 24px;line-height:1.7;">
        ระบบไม่สามารถดึงข้อมูลเริ่มต้นจาก Cloudflare D1 ได้<br>
        กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง
      </p>
      ${DB._syncErrors?.length ? `
        <p style="font-size:11.5px;color:var(--ink-400);margin:0 0 16px;">
          ข้อผิดพลาด: ${escapeHtml(DB._syncErrors.map(e => `${e.endpoint}: ${e.error}`).join(' | '))}
        </p>` : ''}
      <button onclick="window.location.reload()"
              style="padding:10px 28px;border-radius:10px;background:var(--accent-600,#7c3aed);` +
                    `color:#fff;border:none;cursor:pointer;font-size:15px;font-weight:600;">
        🔄 ลองเชื่อมต่อใหม่
      </button>
    </div>`;
}

async function boot(){
  wireGlobalUI();
  updateClock();
  applyBranding();

  // 1. Validate any stored session with the server (clears it on 401 → login page).
  if (API.isLoggedIn()) {
    await API.checkSession();
  }

  // 2. Load reference data (or just branding when logged out). Total failure → retry screen.
  let syncOk = false;
  try {
    syncOk = await syncDB();
  } catch(bootErr) {
    console.error('[boot] ❌ syncDB threw unexpected error:', bootErr);
  }
  applyBranding();

  if (!syncOk && API.isLoggedIn()) {
    if (DB._bootstrapped) {
      console.warn('[boot] ⚠️ Partial sync — some reference data may be stale or missing');
    } else {
      showConnectionError();
      return; // wait for the user to retry
    }
  }

  // 3. Normalize initial path if at root or index.html
  const rawPath = location.pathname.replace(/^\/+|\/+$/g, '');
  if (!rawPath || rawPath === 'index.html' || rawPath === '404.html') {
    history.replaceState(null, '', API.isLoggedIn() ? '/dashboard' : '/login');
  }

  await router();
  loadSidebarCounts();
  startAutoSync();
}
boot();