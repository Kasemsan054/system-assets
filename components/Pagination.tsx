'use client';

import React, { useState, useEffect } from 'react';
import { CustomSelect } from './CustomSelect';
import { Icons } from './Icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}) => {
  const [jumpInput, setJumpInput] = useState<string>('');

  useEffect(() => {
    setJumpInput('');
  }, [currentPage]);

  if (totalItems <= 0) return null;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const selectOptions = pageSizeOptions.map((opt) => ({
    value: String(opt),
    label: `${opt} รายการ / หน้า`,
  }));

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput('');
    }
  };

  return (
    <div className="pagination-bar">
      <div className="page-info">
        <span>
          แสดง <b>{startIndex + 1}–{endIndex}</b> จากทั้งหมด <b>{totalItems}</b> รายการ
        </span>
        <span className="page-badge">
          หน้า {currentPage} / {Math.max(1, totalPages)}
        </span>
      </div>

      <div className="pagination-actions">
        {/* Page Size Selector */}
        <div style={{ minWidth: 155 }}>
          <CustomSelect
            options={selectOptions}
            value={String(pageSize)}
            onChange={(val) => {
              onPageSizeChange(Number(val));
              onPageChange(1);
            }}
          />
        </div>

        {/* Page Controls */}
        <div className="page-controls">
          <button
            type="button"
            className="page-btn nav-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
            title="หน้าแรก"
            aria-label="หน้าแรก"
          >
            <Icons.chevronsLeft size={16} />
          </button>
          <button
            type="button"
            className="page-btn nav-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            title="หน้าก่อนหน้า"
            aria-label="หน้าก่อนหน้า"
          >
            <Icons.chevronLeft size={16} />
          </button>

          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="page-dots">
                  …
                </span>
              );
            }
            return (
              <button
                type="button"
                key={`page-${p}`}
                className={`page-btn ${currentPage === p ? 'active' : ''}`}
                onClick={() => onPageChange(Number(p))}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            className="page-btn nav-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            title="หน้าถัดไป"
            aria-label="หน้าถัดไป"
          >
            <Icons.chevronRight size={16} />
          </button>
          <button
            type="button"
            className="page-btn nav-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="หน้าสุดท้าย"
            aria-label="หน้าสุดท้าย"
          >
            <Icons.chevronsRight size={16} />
          </button>
        </div>

        {/* Quick jump if more than 5 pages */}
        {totalPages > 5 && (
          <form onSubmit={handleJumpSubmit} className="page-jump">
            <span>ไปหน้า</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              placeholder={String(currentPage)}
              onChange={(e) => setJumpInput(e.target.value)}
              className="page-jump-input"
            />
            <button
              type="submit"
              className="page-btn page-jump-btn"
              title="ไปยังหน้าที่ระบุ"
            >
              ไป
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
