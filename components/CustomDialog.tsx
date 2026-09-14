'use client';

import React from 'react';
import { Icons } from './Icons';
import { DialogOptions } from '@/types';

export interface CustomDialogProps {
  isOpen: boolean;
  options?: DialogOptions;
  title?: string;
  message?: string;
  type?: 'confirm' | 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  options,
  title: propTitle,
  message: propMessage,
  type: propType,
  confirmText: propConfirmText,
  cancelText: propCancelText,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const title = options?.title || propTitle || 'แจ้งเตือน';
  const message = options?.message || propMessage || '';
  const type = options?.type || propType || 'confirm';
  const confirmText = options?.confirmText || propConfirmText || 'ยืนยัน';
  const cancelText = options?.cancelText || propCancelText || 'ยกเลิก';

  const isDanger = type === 'danger';

  let iconNode = <Icons.alertTriangle size={24} />;
  let iconBg = '#fef3c7';
  let iconColor = '#d97706';

  if (type === 'danger') {
    iconNode = <Icons.trash size={24} />;
    iconBg = '#fee2e2';
    iconColor = '#dc2626';
  } else if (type === 'success') {
    iconNode = <Icons.checkCircle size={24} />;
    iconBg = '#dcfce7';
    iconColor = '#16a34a';
  } else if (type === 'info') {
    iconNode = <Icons.info size={24} />;
    iconBg = '#e0f2fe';
    iconColor = '#0284c7';
  } else if (type === 'confirm') {
    iconNode = <Icons.shield size={24} />;
    iconBg = '#eff6ff';
    iconColor = '#1d4ed8';
  }

  return (
    <div className="custom-dialog-backdrop" onClick={onCancel}>
      <div
        className="custom-dialog-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="custom-dialog-icon-wrap"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {iconNode}
        </div>
        <h3 className="custom-dialog-title">{title}</h3>
        <p className="custom-dialog-message">{message}</p>

        <div className="custom-dialog-actions">
          <button
            type="button"
            className="custom-dialog-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`custom-dialog-btn-confirm ${isDanger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
