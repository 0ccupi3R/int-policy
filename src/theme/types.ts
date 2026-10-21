import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface KeyValueSpecItem {
  label: string;
  value: string;
  meta?: string;
  badge?: string;
  highlightLabel?: boolean;
}

export interface ShiftCardItem {
  indexLabel: string;
  title: string;
  description: string;
}

export interface AgendaItem {
  time: string;
  duration: string;
  title: string;
  speakers: string[];
  audience?: string;
  summary?: string;
  takeaways?: string[];
  isHighlight?: boolean;
}

export interface StatMetricItem {
  value: string;
  label: string;
  meta?: string;
  accentValue?: boolean;
}

export interface TierCardItem {
  metaLeft: string;
  badgeRight: string;
  isNew?: boolean;
  title: string;
  description: string;
}

export interface SectionWrapperProps {
  id?: string;
  kicker?: string;
  title?: string;
  lead?: string;
  noTopBorder?: boolean;
  children: ReactNode;
  className?: string;
}

/* ==========================================================================
   HUD & INTERACTIVE PRIMITIVES
   ========================================================================== */
export interface AuHudCardProps {
  children: ReactNode;
  title?: ReactNode;
  kicker?: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hoverGlow?: boolean;
}

export interface AuTabItem {
  id: string;
  num?: string;
  label: string;
  badge?: string | number;
}

export interface AuTabsProps {
  tabs: AuTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export interface AuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  children?: ReactNode;
}

export interface AuBadgeProps {
  variant?: 'teal' | 'mint' | 'amber' | 'rose' | 'neutral';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export interface AuModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  isDirty?: boolean;
}

export interface AuCodeViewerProps {
  code: string;
  language: string;
  filename?: string;
  lineCount?: number;
  byteSize?: string;
  showLineNumbers?: boolean;
  onCopy?: () => void;
}

export interface AuTelemetryStripProps {
  stats: StatMetricItem[];
  className?: string;
}

export interface AuValidationBoxProps {
  isValid: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
}

export interface AuDropdownItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export interface AuDropdownProps {
  trigger: ReactNode;
  items: AuDropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export interface AuSelectOption {
  value: string;
  label: string;
  badge?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface AuSelectProps {
  options: (AuSelectOption | string)[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  searchable?: boolean;
  'aria-label'?: string;
}

export interface AuValidatedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  validator?: (val: string) => { valid: boolean; errors: string[]; warnings: string[] };
  maxLen?: number;
  showCharCount?: boolean;
  autoSanitize?: 'alphanumeric' | 'tag-key' | 'tag-value' | 'pattern';
  error?: string;
  warning?: string;
  hint?: string;
}

export interface AuCheckboxProps {
  id?: string;
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  badge?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export interface AuTokenChipProps {
  token: string;
  example?: string;
  description?: string;
  onInsert?: (token: string) => void;
  className?: string;
}

export interface AuIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  title?: string;
  className?: string;
}

export interface AuExpandCollapseButtonProps {
  allExpanded: boolean;
  onToggle: () => void;
  expandText?: string;
  collapseText?: string;
  className?: string;
}


