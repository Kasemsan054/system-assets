'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Icons } from './Icons';
import { ROLE_LABELS } from '@/types';
import { Modal } from './Modal';
import { verifyPassword } from '@/lib/crypto';

interface ProfileDropdownProps {
  onOpenLogin: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ onOpenLogin }) => {
  const { currentUser, logout, changeUserPassword, getDepartment, showToast } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!currentUser) {
    return (
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={onOpenLogin}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Icons.lock size={14} /> เข้าสู่ระบบ
      </button>
    );
  }

  const initials = currentUser.name.trim().slice(0, 2) || 'ผช';
  const roleInfo = ROLE_LABELS[currentUser.role] || ROLE_LABELS.user;
  const dept = getDepartment(currentUser.department);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');

    if (currentUser.password) {
      const isMatch = await verifyPassword(currentPass, currentUser.password);
      if (!isMatch) {
        setPassError('รหัสผ่านเดิมไม่ถูกต้อง');
        return;
      }
    }
    if (newPass.length < 4) {
      setPassError('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }

    await changeUserPassword(currentUser.id, newPass);
    showToast('เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว');
    setIsChangePassOpen(false);
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
  };

  return (
    <div className="profile-container" ref={dropdownRef}>
      <button
        type="button"
        className="user-chip-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="user-avatar">{initials}</div>
        <div className="user-info-text">
          <div className="user-name-title">{currentUser.name}</div>
          <div className="user-role-label">{currentUser.position || roleInfo.label}</div>
        </div>
        <Icons.chevronDown size={14} className={`profile-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-header">
            <div className="profile-avatar-large">{initials}</div>
            <div className="profile-details">
              <div className="profile-full-name">{currentUser.name}</div>
              <div className="profile-sub-info">@{currentUser.username}</div>
              <div style={{ marginTop: 4 }}>
                <span className={`role-badge ${roleInfo.badgeCls}`}>
                  {roleInfo.label}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-meta-rows">
            {currentUser.position && (
              <div className="profile-meta-item">
                <span className="meta-label">ตำแหน่ง:</span>
                <span className="meta-val">{currentUser.position}</span>
              </div>
            )}
            {dept?.name && (
              <div className="profile-meta-item">
                <span className="meta-label">แผนก/ฝ่าย:</span>
                <span className="meta-val">{dept.name}</span>
              </div>
            )}
            {currentUser.location && (
              <div className="profile-meta-item">
                <span className="meta-label">สถานที่:</span>
                <span className="meta-val">{currentUser.location}</span>
              </div>
            )}
          </div>

          <div className="profile-menu-divider" />

          <button
            type="button"
            className="profile-menu-action"
            onClick={() => {
              setIsOpen(false);
              setIsChangePassOpen(true);
            }}
          >
            <Icons.key size={16} />
            <span>เปลี่ยนรหัสผ่าน</span>
          </button>

          <button
            type="button"
            className="profile-menu-action text-danger"
            onClick={() => {
              setIsOpen(false);
              logout();
              showToast('ออกจากระบบเรียบร้อยแล้ว');
            }}
          >
            <Icons.logOut size={16} />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      )}

      {/* Change Password Modal */}
      <Modal
        isOpen={isChangePassOpen}
        onClose={() => setIsChangePassOpen(false)}
        title="เปลี่ยนรหัสผ่านส่วนตัว"
      >
        <form onSubmit={handleChangePassword}>
          <div className="modal-body">
            {passError && <div className="login-error-alert">{passError}</div>}

            <div className="field" style={{ marginBottom: 14 }}>
              <label>รหัสผ่านปัจจุบัน <span className="req">*</span></label>
              <input
                type="password"
                required
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>รหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร) <span className="req">*</span></label>
              <input
                type="password"
                required
                minLength={4}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
            </div>

            <div className="field">
              <label>ยืนยันรหัสผ่านใหม่ <span className="req">*</span></label>
              <input
                type="password"
                required
                minLength={4}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsChangePassOpen(false)}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary">
              <Icons.check size={15} /> ยืนยันเปลี่ยนรหัสผ่าน
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
