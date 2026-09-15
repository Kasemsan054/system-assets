'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/context/AppContext';
import { Icons } from './Icons';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, changeUserPassword, showToast } = useApp();

  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // First-time change password step
  const [mustChangeUser, setMustChangeUser] = useState<{ id: string; name: string } | null>(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const res = login(username.trim(), password);
    if (!res.success) {
      setErrorMsg(res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }

    if (res.mustChange && res.userId) {
      setMustChangeUser({ id: res.userId, name: res.name || username });
      return;
    }

    showToast(`ยินดีต้อนรับคุณ ${res.name || username}`);
    onClose();
    setUsername('');
    setPassword('');
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 4) {
      setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (newPass !== confirmPass) {
      setErrorMsg('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }

    if (mustChangeUser) {
      changeUserPassword(mustChangeUser.id, newPass);
      showToast('ตั้งรหัสผ่านใหม่และเข้าสู่ระบบเรียบร้อยแล้ว');
      setMustChangeUser(null);
      setNewPass('');
      setConfirmPass('');
      onClose();
    }
  };

  return createPortal(
    <div className="login-modal-backdrop" onClick={onClose}>
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} aria-label="ปิด">
          <Icons.x size={18} />
        </button>

        {!mustChangeUser ? (
          <div>
            <div className="login-modal-header">
              <div className="login-icon-badge">
                <Icons.lock size={28} />
              </div>
              <h2 className="login-title">เข้าสู่ระบบ</h2>
              <p className="login-sub">ระบบบริหารและทะเบียนทรัพย์สิน (AMS)</p>
            </div>

            {errorMsg && <div className="login-error-alert">{errorMsg}</div>}

            <form onSubmit={handleLoginSubmit}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>ชื่อผู้ใช้งาน (Username) <span className="req">*</span></label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="เช่น admin หรือ user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>รหัสผ่าน (Password) <span className="req">*</span></label>
                <input
                  type="password"
                  required
                  placeholder="กรอกรหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="login-modal-header">
              <div className="login-icon-badge" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Icons.key size={28} />
              </div>
              <h2 className="login-title">ตั้งรหัสผ่านใหม่</h2>
              <p className="login-sub">
                สวัสดีคุณ <b>{mustChangeUser.name}</b> เนื่องจากนี่เป็นการเข้าสู่ระบบครั้งแรก กรุณาเปลี่ยนรหัสผ่านเพื่อความปลอดภัยและจดจำง่าย
              </p>
            </div>

            {errorMsg && <div className="login-error-alert">{errorMsg}</div>}

            <form onSubmit={handleChangePasswordSubmit}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>รหัสผ่านใหม่ <span className="req">*</span></label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="อย่างน้อย 4 ตัวอักษร"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>ยืนยันรหัสผ่านใหม่ <span className="req">*</span></label>
                <input
                  type="password"
                  required
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                <Icons.check size={16} /> บันทึกรหัสผ่านและเข้าใช้งาน
              </button>
            </form>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
