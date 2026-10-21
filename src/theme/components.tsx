import React, { useState, useRef } from 'react';
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
  AuSelectProps,
  AuExpandCollapseButtonProps,
} from './types';
import { useClickOutside } from './useClickOutside';
import { highlightLine } from './syntaxHighlighter';


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
   7c. HUD SELECT BOX (.au-select)
   ========================================================================== */
export const AuSelect: React.FC<AuSelectProps> = ({
  options,
  value,
  onChange,
  label,
  className = '',
  disabled,
  ...rest
}) => (
  <div className="au-form-group">
    {label && <label className="au-label">{label}</label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`au-select ${className}`}
      {...rest}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label} {opt.badge ? `(${opt.badge})` : ''}
        </option>
      ))}
    </select>
  </div>
);

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
  brandPrefix = 'apisec',
  brandSuffix = 'con',
  year = '2026',
  subBrand = 'An apisec University event',
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
