// js/views/login.js - Employee ID Role-Based Login View

async function renderLogin(view) {
  // Clear sidebar when on login page
  const sidebarNav = document.getElementById('sidebarNav');
  const sidebarUser = document.getElementById('sidebarUserWrap') ||
                      document.getElementById('sidebarUser');
  if (sidebarNav) sidebarNav.innerHTML = '';
  if (sidebarUser) sidebarUser.innerHTML = '';
  setHeader('เข้าสู่ระบบ', 'กรุณายืนยันตัวตนด้วยรหัสพนักงาน');

  view.innerHTML = `
    <style>
      @keyframes loginFadeUp {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes loginFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50%       { transform: translateY(-14px) rotate(3deg); }
      }
      @keyframes loginPulse {
        0%, 100% { opacity: 0.15; transform: scale(1); }
        50%       { opacity: 0.28; transform: scale(1.06); }
      }
      @keyframes loginSpinBorder {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      .login-page-wrap {
        flex: 1;
        min-height: 100vh;
        display: flex;
        align-items: stretch;
        background: var(--paper);
        overflow: hidden;
        position: relative;
      }

      /* ── Left hero panel ── */
      .login-hero {
        display: none;
        flex: 1;
        background: linear-gradient(
          145deg, var(--navy-900) 0%, var(--navy-800) 55%, var(--navy-700) 100%
        );
        position: relative;
        overflow: hidden;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        padding: 48px 40px;
        gap: 28px;
      }
      @media (min-width: 860px) { .login-hero { display: flex; } }

      .login-hero-blob {
        position: absolute;
        border-radius: 50%;
        background: rgba(195,154,61,0.12);
        animation: loginPulse 6s ease-in-out infinite;
      }
      .login-hero-blob.b1 { width:320px;height:320px;top:-80px;left:-80px;animation-delay:0s; }
      .login-hero-blob.b2 { width:220px;height:220px;bottom:-50px;right:-60px;animation-delay:3s; }
      .login-hero-blob.b3 { width:140px;height:140px;bottom:100px;left:40px;animation-delay:1.5s; }

      .login-hero-icon {
        width: 76px; height: 76px;
        background: rgba(255,255,255,0.1);
        border: 1.5px solid rgba(195,154,61,0.5);
        border-radius: 22px;
        display: flex; align-items: center; justify-content: center;
        color: var(--gold-500);
        animation: loginFloat 5s ease-in-out infinite;
        box-shadow: 0 12px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
        position: relative; z-index: 2;
      }
      .login-hero-text {
        text-align: center;
        position: relative; z-index: 2;
      }
      .login-hero-text h2 {
        font-family: 'Kanit', sans-serif;
        font-size: 22px; font-weight: 700;
        color: #fff; margin: 0 0 10px 0;
        line-height: 1.3;
      }
      .login-hero-text p {
        font-size: 13.5px; color: rgba(255,255,255,0.65);
        margin: 0; line-height: 1.65; max-width: 280px;
      }
      .login-hero-features {
        display: flex; flex-direction: column; gap: 12px;
        position: relative; z-index: 2;
        width: 100%; max-width: 300px;
      }
      .login-hero-feature {
        display: flex; align-items: center; gap: 12px;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 11px 15px; border-radius: 10px;
      }
      .login-hero-feature svg { color: var(--gold-500); flex-shrink: 0; }
      .login-hero-feature span { font-size: 13px; color: rgba(255,255,255,0.8); }

      /* ── Right form panel ── */
      .login-form-panel {
        width: 100%;
        max-width: 520px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 28px;
        flex-shrink: 0;
      }
      @media (min-width: 860px) { .login-form-panel { max-width: 460px; } }

      .login-card {
        width: 100%;
        animation: loginFadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* Logo mark */
      .login-logo-wrap {
        display: flex; align-items: center; gap: 14px;
        margin-bottom: 28px;
      }
      .login-logo-mark {
        width: 48px; height: 48px; flex-shrink: 0;
        background: linear-gradient(135deg, var(--navy-700), var(--navy-900));
        border-radius: 13px;
        display: flex; align-items: center; justify-content: center;
        color: var(--gold-500);
        box-shadow: 0 6px 20px rgba(92,16,23,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
      }
      .login-logo-text h3 {
        font-family: 'Kanit', sans-serif;
        font-size: 15px; font-weight: 700;
        color: var(--ink-900); margin: 0; line-height: 1.25;
      }
      .login-logo-text span {
        font-size: 12px; color: var(--ink-500);
      }

      /* Heading */
      .login-heading { margin-bottom: 26px; }
      .login-heading h1 {
        font-family: 'Kanit', sans-serif;
        font-size: 24px; font-weight: 700;
        color: var(--ink-900); margin: 0 0 6px 0;
      }
      .login-heading p {
        font-size: 13.5px; color: var(--ink-500); margin: 0; line-height: 1.55;
      }

      /* Error box */
      .login-error-box {
        display: none;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        padding: 11px 14px;
        border-radius: 8px;
        font-size: 13px;
        margin-bottom: 20px;
        align-items: center;
        gap: 9px;
        animation: loginFadeUp 0.3s ease both;
      }

      /* Input groups */
      .login-field { margin-bottom: 18px; }
      .login-field label {
        font-size: 12.5px; font-weight: 700;
        color: var(--ink-700); display: block; margin-bottom: 7px;
        letter-spacing: 0.01em;
      }
      .login-input-wrap { position: relative; }
      .login-input-icon {
        position: absolute; left: 13px; top: 50%;
        transform: translateY(-50%);
        color: var(--ink-400, #9aa4b2);
        pointer-events: none;
        transition: color 0.2s;
        display: flex; align-items: center;
      }
      .login-input {
        width: 100%; height: 46px;
        border: 1.5px solid var(--line);
        border-radius: 9px;
        background: #fff;
        font-family: 'Sarabun', sans-serif;
        font-size: 14.5px;
        color: var(--ink-900);
        padding-left: 42px;
        padding-right: 14px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .login-input.has-toggle { padding-right: 46px; }
      .login-input:focus {
        border-color: var(--navy-700);
        box-shadow: 0 0 0 3.5px rgba(156,31,41,0.12);
      }
      .login-input:focus + .login-input-icon,
      .login-input-wrap:focus-within .login-input-icon {
        color: var(--navy-700);
      }
      .login-input::placeholder { color: var(--ink-300); }
      .login-input::-ms-reveal,
      .login-input::-ms-clear,
      input[type="password"]::-ms-reveal,
      input[type="password"]::-ms-clear {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      .login-pwd-toggle {
        position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer;
        color: var(--ink-400, #9aa4b2); padding: 4px;
        border-radius: 6px; display: flex; align-items: center;
        transition: color 0.2s, background 0.2s;
      }
      .login-pwd-toggle:hover { color: var(--ink-700); background: var(--paper-alt); }

      /* Submit button */
      .login-btn {
        width: 100%; height: 48px;
        background: linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%);
        color: #fff;
        border: none;
        border-radius: 9px;
        font-family: 'Kanit', sans-serif;
        font-size: 15px; font-weight: 600;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        box-shadow: 0 4px 14px rgba(92,16,23,0.35), 0 1px 3px rgba(0,0,0,0.2);
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        margin-top: 4px;
        letter-spacing: 0.02em;
        position: relative;
        overflow: hidden;
      }
      .login-btn::before {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
        pointer-events: none;
      }
      .login-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 7px 20px rgba(92,16,23,0.4), 0 2px 6px rgba(0,0,0,0.2);
      }
      .login-btn:active:not(:disabled) {
        transform: translateY(0px);
        box-shadow: 0 3px 10px rgba(92,16,23,0.3);
      }
      .login-btn:disabled {
        opacity: 0.7; cursor: not-allowed; transform: none;
      }
      .login-btn-spinner {
        width: 17px; height: 17px;
        border: 2.5px solid rgba(255,255,255,0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
        flex-shrink: 0;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Footer note */
      .login-footer-note {
        margin-top: 20px; text-align: center;
        font-size: 12px; color: var(--ink-400, #9aa4b2);
        line-height: 1.6;
      }
      .login-footer-note b { color: var(--ink-500); }
    </style>

    <div class="login-page-wrap">

      <!-- ── Hero Panel (left) ── -->
      <div class="login-hero">
        <div class="login-hero-blob b1"></div>
        <div class="login-hero-blob b2"></div>
        <div class="login-hero-blob b3"></div>

        <div class="login-hero-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8
                         a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>

        <div class="login-hero-text">
          <h2>ระบบทะเบียนทรัพย์สิน<br>องค์กร</h2>
          <p>บริหารจัดการทรัพย์สิน ติดตามสถานะ และออกรายงานได้อย่างมีประสิทธิภาพ</p>
        </div>

        <div class="login-hero-features">
          <div class="login-hero-feature">
            <svg width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span>บันทึกและติดตามทรัพย์สินทุกชิ้น</span>
          </div>
          <div class="login-hero-feature">
            <svg width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>ระบบสิทธิ์การเข้าถึงหลายระดับ</span>
          </div>
          <div class="login-hero-feature">
            <svg width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <span>รายงานและสถิติแบบ Real-time</span>
          </div>
        </div>
      </div>

      <!-- ── Form Panel (right) ── -->
      <div class="login-form-panel">
        <div class="login-card">

          <!-- Logo -->
          <div class="login-logo-wrap">
            <div class="login-logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8
                       a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div class="login-logo-text">
              <h3>AssetTrack</h3>
              <span>ระบบบริหารจัดการทรัพย์สิน</span>
            </div>
          </div>

          <!-- Heading -->
          <div class="login-heading">
            <h1>เข้าสู่ระบบ</h1>
            <p>กรุณาใส่รหัสพนักงานและรหัสผ่านของคุณ</p>
          </div>

          <!-- Error box -->
          <div id="loginError" class="login-error-box">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span id="loginErrorMsg">รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง</span>
          </div>

          <!-- Form -->
          <form id="loginForm">

            <div class="login-field">
              <label for="inputUsername">รหัสพนักงาน (Employee ID)</label>
              <div class="login-input-wrap">
                <input type="text" id="inputUsername" name="username" required
                  placeholder="เช่น 000001"
                  class="login-input"
                  autofocus autocomplete="username">
                <span class="login-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
              </div>
            </div>

            <div class="login-field">
              <label for="inputPassword">รหัสผ่าน (Password)</label>
              <div class="login-input-wrap">
                <input type="password" id="inputPassword" name="password" required
                  placeholder="อย่างน้อย 6 หลัก"
                  class="login-input has-toggle"
                  autocomplete="current-password">
                <span class="login-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <button type="button" id="btnTogglePassword" class="login-pwd-toggle"
                        title="แสดง/ซ่อนรหัสผ่าน">
                  <svg width="17" height="17" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" stroke-width="2"
                       id="pwdEyeIcon">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <button class="login-btn" id="btnLoginSubmit" type="submit">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" id="loginBtnIcon">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              เข้าสู่ระบบ
            </button>
          </form>

          <div class="login-footer-note">
            ระบบนี้สำหรับพนักงานที่ได้รับอนุญาตเท่านั้น<br>
            <b>หากมีปัญหาการเข้าสู่ระบบ กรุณาติดต่อ IT Support</b>
          </div>

        </div>
      </div>

    </div>
  `;

  // Password Visibility Toggle
  const pwdInput = document.getElementById('inputPassword');
  const btnToggle = document.getElementById('btnTogglePassword');
  if (btnToggle && pwdInput) {
    btnToggle.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      btnToggle.innerHTML = isPwd 
        ? `<svg width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2">
             <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
                      a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4
                      c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07
                      a3 3 0 1 1-4.24-4.24"/>
             <line x1="1" y1="1" x2="23" y2="23"/>
           </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2">
             <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
             <circle cx="12" cy="12" r="3"/>
           </svg>`;
    });
  }

  // Common Login Execution
  const doLogin = async (username, password) => {
    const errorBox = document.getElementById('loginError');
    const submitBtn = document.getElementById('btnLoginSubmit');
    if (errorBox) errorBox.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="login-btn-spinner"></span> กำลังเข้าสู่ระบบ...`;
    }

    try {
      const res = await API.login(username, password);
      if (res && res.success) {
        API.log(
          'login', 'auth',
          `เข้าสู่ระบบสำเร็จ: ${API.getUserName() || username} (Username: ${username})`,
          username, API.getUserName()
        );
        toast(`ยินดีต้อนรับ ${API.getUserName()}`);
        await syncDB();
        navigateTo('/dashboard');
      } else {
        throw new Error('เข้าสู่ระบบไม่สำเร็จ');
      }
    } catch (err) {
      if (errorBox) {
        errorBox.style.display = 'flex';
        document.getElementById('loginErrorMsg').textContent =
          err.message || 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg> เข้าสู่ระบบ`;
      }
    }
  };

  // Form Submit Handler
  document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('inputUsername').value.trim();
    const password = document.getElementById('inputPassword').value;
    await doLogin(username, password);
  });
}
