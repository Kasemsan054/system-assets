'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Icons } from './Icons';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoaded, login, changeUserPassword, db } = useApp();
  const [mounted, setMounted] = useState(false);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // First-time change password step
  const [mustChangeUser, setMustChangeUser] = useState<{ id: string; name: string } | null>(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // While SSR or loading, render nothing (avoid flash)
  if (!mounted || !isLoaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--paper)',
      }}>
        <div className="login-page-spinner" />
      </div>
    );
  }

  // If logged in AND no forced password change, render app normally
  if (currentUser && !currentUser.mustChangePassword) {
    return <>{children}</>;
  }

  // If currentUser is set but mustChangePassword, show change-password form
  // (prefill mustChangeUser so the form shows immediately)
  if (currentUser?.mustChangePassword && !mustChangeUser) {
    // Defer to setState below — will be set by login() returning mustChange
  }

  // --- Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }
    if (res.mustChange && res.userId) {
      setMustChangeUser({ id: res.userId, name: res.name || username });
      return;
    }
    // Logged in successfully — currentUser is set, guard re-renders with children
    setUsername('');
    setPassword('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (newPass.length < 4) { setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร'); return; }
    if (newPass !== confirmPass) { setErrorMsg('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน'); return; }
    const userId = mustChangeUser?.id || currentUser?.id;
    if (userId) {
      setLoading(true);
      await changeUserPassword(userId, newPass);
      setLoading(false);
      setMustChangeUser(null);
      setNewPass('');
      setConfirmPass('');
      // changeUserPassword sets currentUser.mustChangePassword = false → guard renders children
    }
  };

  // Derive who we're changing password for
  const changePwdUser = mustChangeUser || (currentUser?.mustChangePassword ? { id: currentUser.id, name: currentUser.name } : null);

  // --- Login / Change-Password Page ---
  return (
    <div className="login-page">
      {/* Decorative background blobs */}
      <div className="login-page-blob login-page-blob-1" />
      <div className="login-page-blob login-page-blob-2" />

      {/* Left panel — branding */}
      <div className="login-page-left">
        <div className="login-page-brand">
          <div className="login-page-logo-wrap">
            <Icons.shield size={44} />
          </div>
          <h1 className="login-page-brand-name">{db.orgName || 'ระบบทะเบียนทรัพย์สิน'}</h1>
          <p className="login-page-brand-sub">{db.orgSub || 'Asset Management System'}</p>
        </div>

        <div className="login-page-features">
          {[
            { icon: <Icons.box size={20} />, label: 'ทะเบียนทรัพย์สินครบวงจร' },
            { icon: <Icons.users size={20} />, label: 'บริหารผู้ใช้งานหลายระดับ' },
            { icon: <Icons.activity size={20} />, label: 'รายงานและการวิเคราะห์' },
          ].map((f, i) => (
            <div key={i} className="login-page-feature-item">
              <span className="login-page-feature-icon">{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        <p className="login-page-copy">© {new Date().getFullYear()} ระบบทะเบียนทรัพย์สิน</p>
      </div>

      {/* Right panel — form */}
      <div className="login-page-right">
        <div className="login-page-card">
          {!changePwdUser ? (
            <>
              <div className="login-page-card-header">
                <div className="login-page-card-icon">
                  <Icons.lock size={26} />
                </div>
                <h2 className="login-page-card-title">เข้าสู่ระบบ</h2>
                <p className="login-page-card-sub">กรุณายืนยันตัวตนเพื่อเข้าใช้งาน</p>
              </div>

              {errorMsg && (
                <div className="login-page-error">
                  <Icons.alertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="login-page-form">
                <div className="login-page-field">
                  <label htmlFor="lp-username">ชื่อผู้ใช้งาน</label>
                  <div className="login-page-input-wrap">
                    <span className="login-page-input-icon"><Icons.user size={16} /></span>
                    <input
                      id="lp-username"
                      type="text"
                      required
                      autoFocus
                      autoComplete="username"
                      placeholder="กรอกชื่อผู้ใช้"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="login-page-field">
                  <label htmlFor="lp-password">รหัสผ่าน</label>
                  <div className="login-page-input-wrap">
                    <span className="login-page-input-icon"><Icons.lock size={16} /></span>
                    <input
                      id="lp-password"
                      type={showPass ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="กรอกรหัสผ่าน"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="login-page-eye"
                      onClick={() => setShowPass((p) => !p)}
                      tabIndex={-1}
                    >
                      {showPass ? <Icons.eyeOff size={16} /> : <Icons.eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-page-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="login-page-spinner-sm" />
                  ) : (
                    <><Icons.logIn size={18} /> เข้าสู่ระบบ</>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="login-page-card-header">
                <div className="login-page-card-icon" style={{ background: 'var(--amber-100)', color: 'var(--amber-700)' }}>
                  <Icons.key size={26} />
                </div>
                <h2 className="login-page-card-title">ตั้งรหัสผ่านใหม่</h2>
                <p className="login-page-card-sub">
                  สวัสดีคุณ <b>{changePwdUser?.name}</b><br />
                  เนื่องจากเป็นการเข้าสู่ระบบครั้งแรก กรุณาตั้งรหัสผ่านใหม่
                </p>
              </div>

              {errorMsg && (
                <div className="login-page-error">
                  <Icons.alertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="login-page-form">
                <div className="login-page-field">
                  <label htmlFor="lp-newpass">รหัสผ่านใหม่</label>
                  <div className="login-page-input-wrap">
                    <span className="login-page-input-icon"><Icons.lock size={16} /></span>
                    <input
                      id="lp-newpass"
                      type={showNewPass ? 'text' : 'password'}
                      required
                      autoFocus
                      placeholder="อย่างน้อย 4 ตัวอักษร"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                    <button type="button" className="login-page-eye" onClick={() => setShowNewPass(p => !p)} tabIndex={-1}>
                      {showNewPass ? <Icons.eyeOff size={16} /> : <Icons.eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="login-page-field">
                  <label htmlFor="lp-confirmpass">ยืนยันรหัสผ่านใหม่</label>
                  <div className="login-page-input-wrap">
                    <span className="login-page-input-icon"><Icons.lock size={16} /></span>
                    <input
                      id="lp-confirmpass"
                      type={showConfirmPass ? 'text' : 'password'}
                      required
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                    />
                    <button type="button" className="login-page-eye" onClick={() => setShowConfirmPass(p => !p)} tabIndex={-1}>
                      {showConfirmPass ? <Icons.eyeOff size={16} /> : <Icons.eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="login-page-submit" disabled={loading}>
                  {loading ? <span className="login-page-spinner-sm" /> : <><Icons.check size={18} /> บันทึกและเข้าใช้งาน</>}
                </button>

                {mustChangeUser && (
                  <button
                    type="button"
                    className="login-page-back"
                    onClick={() => { setMustChangeUser(null); setErrorMsg(''); }}
                  >
                    ← ย้อนกลับ
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
