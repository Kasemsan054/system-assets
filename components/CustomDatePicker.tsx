'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  minWidth?: number | string;
  className?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'เลือกวันที่...',
  disabled = false,
  required = false,
  fullWidth = false,
  minWidth,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropDirection, setDropDirection] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 320 && rect.top > spaceBelow) {
        setDropDirection('up');
      } else {
        setDropDirection('down');
      }
    }
  }, [isOpen]);

  // Parse initial value or use current date for calendar view
  const initialDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState<Date>(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const displayValueFormatted = value
    ? `${value.substring(8, 10)}/${value.substring(5, 7)}/${value.substring(0, 4)}`
    : '';

  // Calendar logic
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday

  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Generate grid cells
  const gridCells = [];

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    gridCells.push({
      day: daysInPrevMonth - i,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    gridCells.push({
      day: i,
      month: month,
      year: year,
      isCurrentMonth: true,
    });
  }

  // Next month days to fill up to 42 cells (6 rows)
  const remainingCells = 42 - gridCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    gridCells.push({
      day: i,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false,
    });
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (d: number, m: number, y: number) => {
    // Handle year overflow correctly
    let actualYear = y;
    let actualMonth = m;
    
    if (m < 0) {
      actualMonth = 11;
      actualYear = y; // already decremented in loop
    } else if (m > 11) {
      actualMonth = 0;
      actualYear = y; // already incremented in loop
    }

    const formattedDate = `${actualYear}-${String(actualMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const isToday = (d: number, m: number, y: number) => {
    const today = new Date();
    // Correct for month overflow in check
    let actualYear = y;
    let actualMonth = m;
    if (m < 0) { actualMonth = 11; }
    else if (m > 11) { actualMonth = 0; }

    return today.getDate() === d && today.getMonth() === actualMonth && today.getFullYear() === actualYear;
  };

  const isSelected = (d: number, m: number, y: number) => {
    if (!value) return false;
    let actualYear = y;
    let actualMonth = m;
    if (m < 0) { actualMonth = 11; }
    else if (m > 11) { actualMonth = 0; }

    const [vy, vm, vd] = value.split('-').map(Number);
    return vy === actualYear && vm === actualMonth + 1 && vd === d;
  };

  return (
    <div
      className={`custom-select-wrapper date-picker-wrapper ${isOpen ? 'is-open' : ''} ${className}`}
      ref={containerRef}
      style={{
        width: fullWidth ? '100%' : 'auto',
        minWidth: minWidth,
        position: 'relative',
        zIndex: isOpen ? 9999 : undefined,
      }}
    >
      <button
        type="button"
        className={`custom-select-trigger ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) {
            // Reset view date to selected date or today on open
            const resetDate = value ? new Date(value) : new Date();
            setViewDate(new Date(resetDate.getFullYear(), resetDate.getMonth(), 1));
            setIsOpen(!isOpen);
          }
        }}
        disabled={disabled}
      >
        <div className="custom-select-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: value ? 'inherit' : 'var(--ink-400)' }}>
          <Icons.calendar size={15} className="date-icon" />
          {value ? displayValueFormatted : placeholder}
        </div>
      </button>

      {/* Hidden input for native form validation if required */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: 0,
            width: 0,
            bottom: 0,
            left: '50%',
          }}
        />
      )}

      {isOpen && (
        <div className={`date-picker-dropdown ${dropDirection === 'up' ? 'open-up' : ''}`}>
          <div className="dp-header">
            <button type="button" className="dp-nav-btn" onClick={handlePrevMonth}>
              <Icons.chevronLeft size={16} />
            </button>
            <div className="dp-month-year">
              {monthNames[month]} {year + 543}
            </div>
            <button type="button" className="dp-nav-btn" onClick={handleNextMonth}>
              <Icons.chevronRight size={16} />
            </button>
          </div>

          <div className="dp-grid dp-days-header">
            {dayNames.map((d, i) => (
              <div key={i} className="dp-cell dp-day-name">{d}</div>
            ))}
          </div>

          <div className="dp-grid">
            {gridCells.map((cell, idx) => {
              const today = isToday(cell.day, cell.month, cell.year);
              const selected = isSelected(cell.day, cell.month, cell.year);
              
              let classes = 'dp-cell dp-date';
              if (!cell.isCurrentMonth) classes += ' dp-other-month';
              if (today) classes += ' dp-today';
              if (selected) classes += ' dp-selected';

              return (
                <div
                  key={idx}
                  className={classes}
                  onClick={() => handleDateSelect(cell.day, cell.month, cell.year)}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>
          
          <div className="dp-footer">
            <button 
              type="button" 
              className="dp-today-btn"
              onClick={(e) => {
                e.stopPropagation();
                const now = new Date();
                handleDateSelect(now.getDate(), now.getMonth(), now.getFullYear());
              }}
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
