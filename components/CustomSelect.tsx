'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  minWidth?: number | string;
  fullWidth?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'เลือก...',
  searchable,
  disabled = false,
  className = '',
  minWidth,
  fullWidth = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropDirection, setDropDirection] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Auto-enable search if more than 7 options unless explicitly specified false
  const isSearchable = searchable !== undefined ? searchable : options.length > 7;

  // Filter options by search
  const filteredOptions = isSearchable && searchTerm.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : options;

  // Check placement when opening: default down; flip up if space below is too tight and more space above
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 230 && rect.top > spaceBelow) {
        setDropDirection('up');
      } else {
        setDropDirection('down');
      }
    }
  }, [isOpen]);

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

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, isSearchable]);

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrap ${fullWidth ? 'full-width' : ''} ${isOpen ? 'is-open' : ''} ${className}`}
      style={{
        minWidth: minWidth || (fullWidth ? '100%' : 160),
        zIndex: isOpen ? 9999 : undefined,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={`custom-select-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
      >
        <div className="custom-select-value">
          {selectedOption ? (
            <span className="selected-text">
              {selectedOption.icon && <span className="opt-icon">{selectedOption.icon}</span>}
              <span>{selectedOption.label}</span>
              {selectedOption.badge && <span className="opt-badge">{selectedOption.badge}</span>}
            </span>
          ) : (
            <span className="placeholder-text">{placeholder}</span>
          )}
        </div>
        <div className={`chevron-icon ${isOpen ? 'rotated' : ''}`}>
          <Icons.chevronDown size={15} />
        </div>
      </button>

      {isOpen && (
        <div className={`custom-select-dropdown ${dropDirection === 'up' ? 'open-up' : ''}`}>
          {isSearchable && (
            <div className="dropdown-search-box">
              <Icons.search size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ค้นหา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="dropdown-options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    <div className="option-label-wrap">
                      {opt.icon && <span className="opt-icon">{opt.icon}</span>}
                      <span className="opt-label">{opt.label}</span>
                      {opt.sublabel && <span className="opt-sub">{opt.sublabel}</span>}
                    </div>
                    {opt.badge && <span className="opt-badge">{opt.badge}</span>}
                    {isSelected && (
                      <span className="check-icon">
                        <Icons.check size={14} />
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="no-options">ไม่พบตัวเลือก</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
