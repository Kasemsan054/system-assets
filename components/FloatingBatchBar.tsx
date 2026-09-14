'use client';

import React from 'react';
import { Icons } from './Icons';

export interface BatchAction {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'success' | 'secondary' | 'outline';
  onClick: () => void;
}

export interface FloatingBatchBarProps {
  selectedCount: number;
  itemLabel?: string;
  onClear?: () => void;
  onClearSelection?: () => void;
  actions: BatchAction[];
}

export const FloatingBatchBar: React.FC<FloatingBatchBarProps> = ({
  selectedCount,
  itemLabel = 'รายการ',
  onClear,
  onClearSelection,
  actions,
}) => {
  if (selectedCount <= 0) return null;

  const handleClear = onClearSelection || onClear || (() => {});

  return (
    <div className="floating-batch-bar-container">
      <div className="floating-batch-bar">
        <div className="floating-batch-info">
          <span className="floating-batch-count">{selectedCount}</span>
          <span>เลือกอยู่ {selectedCount} {itemLabel}</span>
        </div>

        <div className="floating-batch-divider" />

        <div className="floating-batch-actions">
          {actions.map((act, index) => {
            let variantCls = 'batch-btn-secondary';
            if (act.variant === 'danger') variantCls = 'batch-btn-danger';
            else if (act.variant === 'success') variantCls = 'batch-btn-success';
            else if (act.variant === 'primary') variantCls = 'batch-btn-primary';

            return (
              <button
                key={act.id || index}
                type="button"
                className={`batch-btn ${variantCls}`}
                onClick={act.onClick}
              >
                {act.icon}
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="batch-btn-close"
          onClick={handleClear}
          title="ยกเลิกการเลือกทั้งหมด"
          aria-label="ยกเลิกการเลือก"
        >
          <Icons.x size={15} />
        </button>
      </div>
    </div>
  );
};
