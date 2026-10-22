import React, { useState, useRef, useId } from 'react';
import {
  KeyValueSpecItem,
  ShiftCardItem,
  AgendaItem,
  StatMetricItem,
  TierCardItem,
  SectionWrapperProps,
  AuHudCardProps,
  AuTabsProps,
  AuButtonProps,
  AuBadgeProps,
  AuModalProps,
  AuCodeViewerProps,
  AuTelemetryStripProps,
  AuValidationBoxProps,
  AuDropdownProps,
  AuSelectOption,
  AuSelectProps,
  AuValidatedInputProps,
  AuCheckboxProps,
  AuTokenChipProps,
  AuIconButtonProps,
  AuExpandCollapseButtonProps,
  AuWarningBannerProps,
} from './types';
import { useClickOutside } from './useClickOutside';
import { highlightLine } from './syntaxHighlighter';
import { sanitizeInput } from './inputValidators';


/* ==========================================================================
   1. HUD CORNER RETICLE CARD (.au-hud-card)
   ========================================================================== */
export const AuHudCard: React.FC<AuHudCardProps> = ({
  children,
  title,
  kicker,
  meta,
  action,
  className = '',
  style,
  onClick,
}) => (
  <div
    className={`au-hud-card ${className}`}
    style={style}
    onClick={onClick}
  >
    {/* 4-Corner Reticle Brackets */}
    <div className="au-card-arrow" aria-hidden="true">
      <div className="au-card-arrow-tl" />
      <div className="au-card-arrow-tr" />
      <div className="au-card-arrow-bl" />
      <div className="au-card-arrow-br" />
    </div>

    {/* Optional Header */}
    {(title || kicker || meta || action) && (
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          {kicker && <div className="au-kicker" style={{ marginBottom: '0.2rem' }}>{kicker}</div>}
          {title && <h3 className="au-card-title">{title}</h3>}
          {meta && <div className="au-mono-meta" style={{ marginTop: '0.2rem' }}>{meta}</div>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}

    {/* Body */}
    <div style={{ padding: '1.25rem' }}>
      {children}
    </div>
  </div>
);

/* ==========================================================================
   2. NUMBERED TABS (.au-tab-strip)
   ========================================================================== */
export const AuTabs: React.FC<AuTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => (
  <div className={`au-tab-strip ${className}`} role="tablist">
    {tabs.map((tab, idx) => {
      const isActive = activeTab === tab.id;
      const displayNum = tab.num || `0${idx + 1}`;
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          className={`au-tab-button ${isActive ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="au-tab-num">{displayNum} //</span>
          <span>{tab.label}</span>
          {tab.badge !== undefined && (
            <span
              className={`au-badge ${isActive ? 'au-badge-mint' : ''}`}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
            >
              {tab.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/* ==========================================================================
   3. TACTICAL BUTTON (.au-btn)
   ========================================================================== */
export const AuButton: React.FC<AuButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}) => {
  const variantClass = `au-btn-${variant}`;
  const sizeClass = size === 'sm' ? 'au-btn-sm' : '';
  return (
    <button
      className={`au-btn ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
};

/* ==========================================================================
   4. METADATA BADGE (.au-badge)
   ========================================================================== */
export const AuBadge: React.FC<AuBadgeProps> = ({
  variant = 'teal',
  icon,
  children,
  className = '',
}) => {
  const variantClass = variant !== 'teal' ? `au-badge-${variant}` : '';
  return (
    <span className={`au-badge ${variantClass} ${className}`}>
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

/* ==========================================================================
   5. ACCESSIBLE MODAL DIALOG WITH SAFE-DISMISS PROTECTION (.au-modal)
   ========================================================================== */
export const AuModal: React.FC<AuModalProps> = ({
  isOpen,
  onClose,
  title,
  kicker,
  children,
  footer,
  maxWidth = '680px',
  isDirty = false,
}) => {
  const [isShaking, setIsShaking] = useState(false);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;

    if (isDirty) {
      // Field inputs modified: protect against accidental backdrop dismissal!
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 350);
      return;
    }

    onClose();
  };

  return (
    <div
      className="au-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`au-modal-dialog ${isShaking ? 'au-modal-shake' : ''}`}
        style={{ maxWidth }}
      >
        {/* Corner Reticles on Modal */}
        <div className="au-card-arrow" aria-hidden="true">
          <div className="au-card-arrow-tl" />
          <div className="au-card-arrow-tr" />
          <div className="au-card-arrow-bl" />
          <div className="au-card-arrow-br" />
        </div>

        {/* Modal Header */}
        <div className="au-modal-header">
          <div>
            {kicker && <div className="au-kicker" style={{ marginBottom: '0.2rem' }}>{kicker}</div>}
            <h2 className="au-card-title" style={{ fontSize: '1.2rem' }}>{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="au-btn au-btn-ghost au-btn-sm"
            aria-label="Close dialog"
            style={{ fontSize: '1.25rem', padding: '0.2rem 0.5rem' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="au-modal-body">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="au-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   6. TELEMETRY STRIP (.au-stat-strip)
   ========================================================================== */
export const AuTelemetryStrip: React.FC<AuTelemetryStripProps> = ({ stats, className = '' }) => (
  <div className={`au-stat-strip ${className}`}>
    {stats.map((stat, idx) => (
      <div key={idx} className="au-stat-item">
        <div className="au-stat-lbl">{stat.label}</div>
        <div className="au-stat-val" style={stat.accentValue ? { color: 'var(--accent-primary)' } : undefined}>
          {stat.value}
        </div>
        {stat.meta && <div className="au-mono-meta">{stat.meta}</div>}
      </div>
    ))}
  </div>
);

/* ==========================================================================
   7. CODE VIEWER WITH SYNTAX HIGHLIGHTING & GUTTER (.au-code-viewer)
   ========================================================================== */
export const AuCodeViewer: React.FC<AuCodeViewerProps> = ({
  code,
  language,
  filename,
  lineCount,
  byteSize,
  showLineNumbers = true,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  const rawLines = (code || '').split('\n');
  const totalLines = lineCount || rawLines.length;

  return (
    <div className="au-code-viewer">
      <div className="au-code-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="au-badge au-badge-mint">{language.toUpperCase()}</span>
          {filename && <span className="au-mono-meta" style={{ color: 'var(--text-primary)' }}>{filename}</span>}
          <span className="au-mono-meta">· {totalLines} lines</span>
          {byteSize && <span className="au-mono-meta">· {byteSize}</span>}
        </div>
        <AuButton
          variant="secondary"
          size="sm"
          onClick={handleCopy}
        >
          {copied ? '✓ COPIED' : 'COPY CODE'}
        </AuButton>
      </div>
      <div className="au-code-body" style={{ padding: 0 }}>
        <table className="au-code-table">
          <tbody>
            {rawLines.map((line, idx) => (
              <tr key={idx} className="au-code-row">
                {showLineNumbers && (
                  <td className="au-code-line-num">{idx + 1}</td>
                )}
                <td className="au-code-line-content">
                  {highlightLine(line, language)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ==========================================================================
   7b. INTERACTIVE FLOATING DROPDOWN WITH AUTO-CLOSE (.au-dropdown)
   ========================================================================== */
export const AuDropdown: React.FC<AuDropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => {
    if (isOpen) setIsOpen(false);
  }, isOpen);

  return (
    <div ref={containerRef} className={`au-dropdown-container ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer', display: 'inline-block' }}>
        {trigger}
      </div>
      {isOpen && (
        <div
          className="au-dropdown-menu"
          style={{ [align === 'left' ? 'left' : 'right']: 0 }}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              disabled={item.disabled}
              className="au-dropdown-item"
              style={{
                color: item.danger ? 'var(--accent-rose)' : undefined,
                opacity: item.disabled ? 0.4 : 1,
              }}
              onClick={() => {
                if (item.disabled) return;
                setIsOpen(false);
                if (item.onClick) item.onClick();
              }}
            >
              {item.icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && <span>{item.badge}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   7c. TACTICAL CUSTOM SELECT DROPDOWN (.au-select-*)
   ========================================================================== */
export const AuSelect: React.FC<AuSelectProps> = ({
  options,
  value,
  onChange,
  id,
  name,
  label,
  placeholder = 'Select option...',
  className = '',
  style,
  disabled = false,
  searchable = false,
  'aria-label': ariaLabelKebab,
  ariaLabel: ariaLabelCamel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useClickOutside(containerRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setSearch('');
    }
  });

  // Normalize options to { value, label, badge, icon, disabled }
  const normalizedOptions: AuSelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      opt.value.toLowerCase().includes(term) ||
      (opt.badge && opt.badge.toLowerCase().includes(term))
    );
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  const effectiveAriaLabel =
    ariaLabelCamel ||
    ariaLabelKebab ||
    (label
      ? `${label}${selectedOption ? `: ${selectedOption.label}` : ''}`
      : selectedOption?.label || placeholder);

  // Auto-enable search if option count > 8
  const isSearchEnabled = searchable || normalizedOptions.length > 8;

  const handleToggle = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setSearch('');
      const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      if (isSearchEnabled) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  };

  const handleSelect = (val: string, isDisabled?: boolean) => {
    if (isDisabled) return;
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleToggle();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearch('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const target = filteredOptions[highlightedIndex];
        handleSelect(target.value, target.disabled);
      }
    }
  };

  const reactGeneratedId = useId();
  const selectId = id || `au-select-${reactGeneratedId.replace(/[:]/g, '')}`;

  return (
    <div className={`au-form-group ${className}`} style={style} ref={containerRef}>
      {label && <label className="au-label" htmlFor={selectId}>{label}</label>}
      <div className="au-select-wrapper">
        <button
          type="button"
          id={selectId}
          name={name || selectId}
          aria-label={effectiveAriaLabel}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={`au-select-trigger ${isOpen ? 'is-open' : ''}`}
        >
          <span className="au-select-trigger-text">
            {selectedOption ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {selectedOption.icon}
                <span>{selectedOption.label}</span>
                {selectedOption.badge && <span className="au-select-option-badge">{selectedOption.badge}</span>}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
            )}
          </span>
          <span className="au-select-trigger-chevron">▼</span>
        </button>

        {isOpen && (
          <div className="au-select-dropdown" role="listbox">
            {isSearchEnabled && (
              <div className="au-select-search-box">
                <input
                  ref={searchInputRef}
                  id={`${selectId}-search`}
                  name={`${selectId}_search`}
                  aria-label={`Filter ${label || 'options'}`}
                  type="text"
                  className="au-select-search-input"
                  placeholder="Filter options..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                />
              </div>
            )}
            <ul className="au-select-options-list">
              {filteredOptions.length === 0 ? (
                <li style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No matching options found
                </li>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isFocused = idx === highlightedIndex;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      className={`au-select-option ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-focused' : ''} ${opt.disabled ? 'is-disabled' : ''}`}
                      onClick={() => handleSelect(opt.value, opt.disabled)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        {isSelected && <span style={{ color: 'var(--accent-mint)', fontSize: '0.75rem' }}>✓</span>}
                        {opt.icon}
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                      </span>
                      {opt.badge && <span className="au-select-option-badge">{opt.badge}</span>}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   7d. VALIDATED INPUT WITH CHAR COUNT & SYNTAX PILLS (.au-validated-input-*)
   ========================================================================== */
export const AuValidatedInput: React.FC<AuValidatedInputProps> = ({
  value,
  onChange,
  label,
  validator,
  maxLen,
  showCharCount = true,
  autoSanitize,
  error: customError,
  warning: customWarning,
  hint,
  id,
  className = '',
  disabled,
  placeholder,
  ...rest
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [internalWarning, setInternalWarning] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (autoSanitize) {
      raw = sanitizeInput(raw, autoSanitize);
    }
    onChange(raw);

    if (validator) {
      const result = validator(raw);
      setInternalError(result.errors?.[0] || '');
      setInternalWarning(result.warnings?.[0] || '');
    }
  };

  const activeError = customError || internalError || (maxLen && value.length > maxLen ? `Exceeds max length (${value.length}/${maxLen})` : '');
  const activeWarning = customWarning || internalWarning;
  const isInvalid = Boolean(activeError);

  const charCountFraction = maxLen ? `${value.length} / ${maxLen}` : `${value.length}`;
  const isCharWarning = maxLen && value.length > maxLen * 0.85 && value.length <= maxLen;
  const isCharError = maxLen && value.length > maxLen;

  const reactGeneratedId = useId();
  const inputId = id || `au-input-${reactGeneratedId.replace(/[:]/g, '')}`;

  return (
    <div className={`au-validated-input-container ${className}`}>
      {(label || (showCharCount && maxLen)) && (
        <div className="au-input-header">
          {label && <label className="au-label" htmlFor={inputId}>{label}</label>}
          {showCharCount && maxLen && (
            <span
              className={`au-input-char-count ${isCharError ? 'is-error' : isCharWarning ? 'is-warning' : ''}`}
            >
              [{charCountFraction}]
            </span>
          )}
        </div>
      )}
      <input
        id={inputId}
        name={rest.name || inputId}
        aria-label={rest['aria-label'] || label || placeholder}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`au-input ${isInvalid ? 'au-input-invalid' : value ? 'au-input-valid' : ''}`}
        {...rest}
      />
      {hint && !activeError && !activeWarning && (
        <span className="au-mono-meta" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</span>
      )}
      {activeError && (
        <div className="au-input-pill au-input-pill-error">
          <span>✕</span>
          <span>{activeError}</span>
        </div>
      )}
      {!activeError && activeWarning && (
        <div className="au-input-pill au-input-pill-warning">
          <span>⚠</span>
          <span>{activeWarning}</span>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   7e. TACTICAL HUD CHECKBOX (.au-checkbox)
   ========================================================================== */
export const AuCheckbox: React.FC<AuCheckboxProps> = ({
  id,
  name,
  checked,
  onChange,
  label,
  description,
  badge,
  disabled = false,
  className = '',
  style,
}) => {
  const reactGeneratedId = useId();
  const checkId = id || `au-chk-${reactGeneratedId.replace(/[:]/g, '')}`;

  return (
    <label
      htmlFor={checkId}
      className={`au-checkbox ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        type="checkbox"
        id={checkId}
        name={name || checkId}
        aria-label={label || description || 'Option checkbox'}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="au-checkbox-input"
      />
      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {label && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>}
            {badge && <span className="au-badge" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>{badge}</span>}
          </div>
          {description && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{description}</span>
          )}
        </div>
      )}
    </label>
  );
};

/* ==========================================================================
   7f. QUICK-INSERT TOKEN CHIP (.au-token-chip)
   ========================================================================== */
export const AuTokenChip: React.FC<AuTokenChipProps> = ({
  token,
  example,
  description,
  onInsert,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    if (onInsert) {
      onInsert(token);
    } else {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <button
      type="button"
      className={`au-token-chip token-chip-btn ${className}`}
      title={description ? `${description}${example ? ` -> Example: ${example}` : ''}` : `Insert token ${token}`}
      onClick={handleClick}
    >
      <span className="token-chip-badge">{token}</span>
      {example && <span className="token-chip-example">({example})</span>}
      <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '2px' }}>
        {copied ? '✓' : '⧉'}
      </span>
    </button>
  );
};

/* ==========================================================================
   7g. STANDARDIZED ACTION BUTTON (.au-icon-btn)
   ========================================================================== */
export const AuIconButton: React.FC<AuIconButtonProps> = ({
  icon,
  variant = 'default',
  title,
  className = '',
  disabled,
  ...rest
}) => {
  const variantClass = variant === 'danger' ? 'btn-danger' : variant === 'primary' ? 'au-btn-primary' : '';
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`btn-icon ${variantClass} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
};


/* ==========================================================================
   7d. EXPAND / COLLAPSE ALL TOGGLE BUTTON (.au-expand-collapse-btn)
   ========================================================================== */
export const AuExpandCollapseButton: React.FC<AuExpandCollapseButtonProps> = ({
  allExpanded,
  onToggle,
  expandText = 'EXPAND ALL',
  collapseText = 'COLLAPSE ALL',
  className = '',
}) => (
  <AuButton
    variant="secondary"
    size="sm"
    onClick={onToggle}
    className={className}
    icon={<span style={{ fontSize: '0.75rem', lineHeight: 1 }}>{allExpanded ? '▲' : '▼'}</span>}
  >
    {allExpanded ? collapseText : expandText}
  </AuButton>
);


/* ==========================================================================
   8. LIVE VALIDATION CALLOUT BOX (.au-validation-box)
   ========================================================================== */
export const AuValidationBox: React.FC<AuValidationBoxProps> = ({
  isValid,
  title,
  message,
  children,
}) => (
  <div className={`au-validation-box ${isValid ? 'au-validation-valid' : 'au-validation-invalid'}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: children || message ? '0.4rem' : 0 }}>
      <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>
        {isValid ? '✓' : '⚠'}
      </span>
      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
        {title}
      </span>
    </div>
    {message && (
      <div className="au-mono-meta" style={{ color: isValid ? 'var(--accent-mint)' : 'var(--accent-rose)' }}>
        {message}
      </div>
    )}
    {children}
  </div>
);

/* ==========================================================================
   9. LEGACY / CONFERENCE COMPATIBILITY EXPORTS
   ========================================================================== */
export const AuNavbar: React.FC<{
  brandPrefix?: string;
  brandSuffix?: string;
  year?: string;
  subBrand?: string;
  secondaryLinkText?: string;
  secondaryLinkHref?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  children?: React.ReactNode;
}> = ({
  brandPrefix = 'tactical',
  brandSuffix = 'ui',
  year = '2026',
  subBrand = 'Telemetry Design System',
  secondaryLinkText = 'See the agenda →',
  secondaryLinkHref = '#agenda',
  primaryCtaText = 'Register free',
  primaryCtaHref = '#register',
  children,
}) => (
  <header
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      background: 'var(--bg-glass)',
      borderBottom: '1px solid var(--border-hairline)',
    }}
  >
    <div
      className="au-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.05rem' }}>
          {brandPrefix}
          <span style={{ color: 'var(--accent-primary)', fontWeight: 400, margin: '0 2px' }}>|</span>
          {brandSuffix} <span className="au-mono-meta">{year}</span>
        </span>
        {subBrand && <span className="au-mono-meta">· {subBrand}</span>}
      </div>
      {children || (
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {secondaryLinkText && (
            <a
              href={secondaryLinkHref}
              className="au-mono-meta"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              {secondaryLinkText}
            </a>
          )}
          <a
            href={primaryCtaHref}
            className="au-btn au-btn-primary"
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.8125rem' }}
          >
            {primaryCtaText}
          </a>
        </nav>
      )}
    </div>
  </header>
);

export const AuSection: React.FC<SectionWrapperProps> = ({
  id,
  kicker,
  title,
  lead,
  noTopBorder,
  children,
  className = '',
}) => (
  <section
    id={id}
    className={`au-section ${className}`}
    style={noTopBorder ? { borderTop: 'none', paddingTop: '3rem' } : undefined}
  >
    <div className="au-container">
      {kicker && <div className="au-kicker">{kicker}</div>}
      {title && <h2 className="au-section-title">{title}</h2>}
      {lead && <p className="au-lead">{lead}</p>}
      {children}
    </div>
  </section>
);

export const AuKeyValueGrid: React.FC<{
  items: KeyValueSpecItem[];
  minColWidth?: string;
}> = ({ items, minColWidth = '180px' }) => (
  <div
    className="au-hairline-grid"
    style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}, 1fr))` }}
  >
    {items.map((item, idx) => (
      <div key={idx} className="au-hairline-cell">
        <div
          className="au-mono-meta"
          style={item.highlightLabel ? { color: 'var(--accent-primary)' } : undefined}
        >
          {item.label}
        </div>
        <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>
          {item.value}{' '}
          {item.meta && <span className="au-mono-meta">· {item.meta}</span>}
          {item.badge && (
            <span
              className="au-badge"
              style={{ marginLeft: '0.35rem', padding: '0.1rem 0.45rem' }}
            >
              {item.badge}
            </span>
          )}
        </div>
      </div>
    ))}
  </div>
);

export const AuShiftCardGrid: React.FC<{ items: ShiftCardItem[] }> = ({ items }) => (
  <div
    className="au-hairline-grid"
    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
  >
    {items.map((card, idx) => (
      <article key={idx} className="au-hairline-cell" style={{ padding: '2rem' }}>
        <div
          className="au-mono-meta"
          style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem' }}
        >
          {card.indexLabel}
        </div>
        <h3 className="au-card-title">{card.title}</h3>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
          {card.description}
        </p>
      </article>
    ))}
  </div>
);

export const AuTierMatrix: React.FC<{ items: TierCardItem[] }> = ({ items }) => (
  <div
    className="au-hairline-grid"
    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
  >
    {items.map((tier, idx) => (
      <div key={idx} className="au-hairline-cell" style={{ padding: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <span
            className="au-mono-meta"
            style={{
              color: tier.isNew ? 'var(--accent-emerald)' : 'var(--text-primary)',
            }}
          >
            {tier.metaLeft}
          </span>
          <span className={`au-badge ${tier.isNew ? 'au-badge-mint' : ''}`}>
            {tier.badgeRight}
          </span>
        </div>
        <h3 className="au-card-title">{tier.title}</h3>
        <p className="au-mono-meta" style={{ margin: 0 }}>
          {tier.description}
        </p>
      </div>
    ))}
  </div>
);

export const AuAgendaTrack: React.FC<{ sessions: AgendaItem[] }> = ({ sessions }) => (
  <div style={{ borderBottom: '1px solid var(--border-hairline)' }}>
    {sessions.map((session, idx) => (
      <div key={idx} className="au-agenda-row">
        <div>
          <div
            className="au-mono-meta"
            style={{
              color: session.isHighlight ? 'var(--accent-primary)' : 'var(--text-primary)',
            }}
          >
            {session.time}
          </div>
          <div className="au-mono-meta">{session.duration}</div>
        </div>
        <div>
          <h3 className="au-card-title">{session.title}</h3>
          <div className="au-mono-meta" style={{ color: 'var(--text-secondary)' }}>
            {session.speakers.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const AuStatStrip: React.FC<{ stats: StatMetricItem[] }> = ({ stats }) => (
  <div
    className="au-hairline-grid"
    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
  >
    {stats.map((stat, idx) => (
      <div key={idx} className="au-hairline-cell">
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: stat.accentValue ? 'var(--accent-primary)' : 'var(--text-primary)',
          }}
        >
          {stat.value}
        </div>
        <div className="au-mono-meta" style={{ marginTop: '0.4rem' }}>
          {stat.label}
        </div>
      </div>
    ))}
  </div>
);

/* ==========================================================================
   26. STANDARDIZED WARNING BANNER (.au-warning-banner)
   ========================================================================== */
const DefaultWarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export const AuWarningBanner: React.FC<AuWarningBannerProps> = ({
  id,
  icon,
  title,
  description,
  actions,
  className = '',
  style
}) => (
  <div id={id} className={`au-warning-banner ${className}`} style={style}>
    <div className="au-warning-banner-left">
      <div className="au-warning-banner-icon">
        {icon || <DefaultWarningIcon />}
      </div>
      <div>
        <div className="au-warning-banner-title">{title}</div>
        {description && <div className="au-warning-banner-desc">{description}</div>}
      </div>
    </div>
    {actions && <div className="au-warning-banner-actions">{actions}</div>}
  </div>
);
