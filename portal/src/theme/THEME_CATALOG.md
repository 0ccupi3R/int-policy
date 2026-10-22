# Common Theme Catalog: Tactical HUD & Editorial Swiss Grid (`@0ccupi3r/tactical-ui`)

> **Version**: 2.0.0  
> **Source Directory**: `portal/src/theme/`  
> **Package**: `@0ccupi3r/tactical-ui` (`tactical-ui/`)  
> **Portable Archive**: `tactical-ui.zip` (MIT License)

This catalog serves as the central documentation and single source of truth for the portable design system. It details every design token, React primitive, input validator, syntax highlighter, and architectural guideline so this theme can be leveraged across any project.

---

## Table of Contents
1. [Design Philosophy & Core Architecture](#1-design-philosophy--core-architecture)
2. [Design Tokens Specification](#2-design-tokens-specification)
3. [Global Form & Input Discipline](#3-global-form--input-discipline)
4. [Component Catalog & Usage Examples](#4-component-catalog--usage-examples)
5. [Validation & Sanitization Engine](#5-validation--sanitization-engine)
6. [Theme Pack Portability & Migration Guide](#6-theme-pack-portability--migration-guide)
7. [Extensibility & Maintenance Playbook](#7-extensibility--maintenance-playbook)
8. [Legal & Open Source Licensing Assessment](#8-legal--open-source-licensing-assessment)

---

## 1. Design Philosophy & Core Architecture

The design system is a fusion of two powerful visual paradigms:
1. **The Technical-Editorial Swiss Grid**:
   - Structured around high-density 1px hairline borders (`var(--border-hairline)`).
   - Elegant, content-first typography using **Spectral** serif headlines paired with crisp **IBM Plex Sans** body copy.
   - Middle-dot (`·`) separated metadata rendered in **IBM Plex Mono**.
2. **HUD Tactical Telemetry (React 18 / Cyber-Physical)**:
   - Dark Petrol canvas (`#06252D`) with elevated surfaces (`#12323E`, `#16404C`).
   - Micro-accent reticles on card corners (`.au-card-arrow-tl/tr/bl/br`).
   - 22px fixed radial dot-grid texture on the viewport background.
   - High-contrast telemetry accents: Tactical Teal (`#48A9A6`), HUD Emerald (`#249D79`), Signal Mint (`#64BA6D`), Amber Alert (`#E09F3E`), and Rose Fault (`#E57373`).

---

## 2. Design Tokens Specification

### Color Tokens (`tokens.json` & `theme.css`)

| Token Variable | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `--bg-canvas` | `#06252D` | Deep Petrol root background |
| `--bg-surface` | `#12323E` | Card, container, and dialog background |
| `--bg-surface-elevated`| `#16404C` | Hover states, popups, and dropdown menus |
| `--text-primary` | `#F4F7F6` | Primary high-contrast readable copy |
| `--text-secondary` | `#8BA19B` | Muted labels, secondary descriptions |
| `--text-muted` | `#66817B` | Subtle hints, captions, placeholders |
| `--border-hairline` | `rgba(139, 161, 155, 0.22)` | Crisp 1px grid lines and dividers |
| `--border-strong` | `rgba(72, 169, 166, 0.45)` | Focused boundaries and reticle corners |
| `--accent-primary` | `#48A9A6` | Tactical Teal brand accent & focus rings |
| `--accent-secondary`| `#249D79` | HUD Emerald telemetry metric accent |
| `--accent-mint` | `#64BA6D` | Compliant status, checkmarks, success |
| `--accent-amber` | `#E09F3E` | Overridden tags, warnings, cautions |
| `--accent-rose` | `#E57373` | Syntax errors, delete buttons, critical |
| `--accent-purple` | `#A78BFA` | Resource groups, cascaded scopes |
| `--code-bg` | `#041A20` | Monospace code block terminal background |

### Typography Scale

- **Display Serif**: `'Spectral', Georgia, serif` — tight tracking (`-0.025em`), sentence case, weight `600`.
- **Primary Body**: `'IBM Plex Sans', -apple-system, sans-serif` — weights `400`, `500`, `600`.
- **Telemetry / Code**: `'IBM Plex Mono', Menlo, monospace` — letter spacing `0.04em`, used for tags, IDs, JSON tokens, metrics, and key-value specs.

---

## 3. Global Form & Input Discipline

A primary requirement of the theme is **zero stark-white visual leaks**:

```css
/* Enforced in src/theme/theme.css and portal/src/index.css */
input[type="text"],
input[type="number"],
input[type="search"],
input[type="password"],
input[type="email"],
input:not([type]),
.input-field,
.form-input {
  background-color: var(--bg-canvas) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-hairline) !important;
  border-radius: var(--radius-sm);
  outline: none;
  font-family: var(--font-sans);
  transition: border-color var(--ease-snappy), box-shadow var(--ease-snappy);
}

input:focus,
.input-field:focus,
.form-input:focus {
  border-color: var(--accent-primary) !important;
  box-shadow: 0 0 0 2px var(--accent-tint) !important;
}

/* Fallback color-scheme dark for native OS popups */
select,
select.input-field {
  color-scheme: dark;
  background-color: var(--bg-surface) !important;
  color: var(--text-primary) !important;
}

/* Universal Text Selection */
::selection {
  background-color: var(--accent-primary) !important;
  color: var(--bg-canvas) !important;
}
```

---

## 4. Component Catalog & Usage Examples

### `<AuHudCard>`
Corner-reticle container with optional kicker, title, dot-separated meta, and action button slots.

```tsx
import { AuHudCard, AuButton } from './theme';

<AuHudCard
  kicker="POLICY GOVERNANCE"
  title="Subscription Network Baseline"
  meta="Zone 01 · 12 Security Rules · Auto-Enforced"
  action={<AuButton variant="primary" size="sm">Deploy</AuButton>}
>
  <p>Card interior content...</p>
</AuHudCard>
```

---

### `<AuSelect>`
Tactical dropdown replacing OS-native `<select>`. Features auto-search (when items > 8 or `searchable={true}`), option badges, checkmarks, keyboard navigation (Arrow keys, Enter, Esc), and click-outside dismissal.

```tsx
import { AuSelect } from './theme';

// Standard Usage
<AuSelect
  label="Target Region"
  value={region}
  onChange={(val) => setRegion(val)}
  options={[
    { value: 'canadacentral', label: 'Canada Central (cc)', badge: 'Primary' },
    { value: 'canadaeast', label: 'Canada East (ce)' },
    { value: 'eastus', label: 'East US (eus)', badge: 'Secondary' }
  ]}
/>

// Compact Mode for Dense Grids / Overrides
<AuSelect
  className="au-select-compact"
  style={{ width: '100%' }}
  value={currentVal}
  onChange={handleChange}
  options={[
    { value: '', label: '(Inherit: CloudOps)', badge: 'Inherit' },
    { value: 'SecOps', label: 'SecOps' },
    { value: 'DevOps', label: 'DevOps' }
  ]}
/>
```

---

### `<AuValidatedInput>`
Real-time text input with live character counter `[len / max]`, animated syntax error/warning pills, auto-sanitization, and helper hints.

```tsx
import { AuValidatedInput, validateTagKey } from './theme';

<AuValidatedInput
  label="Resource Tag Key"
  value={tagKey}
  onChange={setTagKey}
  validator={validateTagKey}
  maxLen={512}
  hint="Max 512 chars; cannot start with 'microsoft' or 'azure'"
  placeholder="e.g. CostCenter, Owner"
/>
```

---

### `<AuCheckbox>` & `.au-selection-row`
Custom tactical HUD checkbox preventing OS styling, paired with full clickable list rows.

```tsx
import { AuCheckbox } from './theme';

<label className={`au-selection-row ${isSelected ? 'is-checked' : ''}`}>
  <AuCheckbox
    checked={isSelected}
    onChange={(checked) => handleToggle(checked)}
  />
  <span className="au-selection-label">Subscription Scope</span>
  <span className="chip chip-cyan">Root ALZ</span>
</label>
```

---

### `<AuTokenChip>`
Quick-insert token button that inserts text into an active input or copies to clipboard with animated 1.2s check feedback.

```tsx
import { AuTokenChip } from './theme';

<div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
  <AuTokenChip token="{Org}" onInsert={(val) => insertIntoPattern(val)} />
  <AuTokenChip token="{SUB}" onInsert={(val) => insertIntoPattern(val)} />
  <AuTokenChip token="{ResourceGroup}" onInsert={(val) => insertIntoPattern(val)} />
</div>
```

---

### `<AuModal>`
Dark glassmorphism modal with dirty-state change protection (prevents accidental closing on backdrop click if unsaved changes exist) and visual shake alert.

```tsx
import { AuModal, AuButton } from './theme';

<AuModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Add Subscription Scope"
  isDirty={hasUnsavedChanges}
  footer={
    <>
      <AuButton variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</AuButton>
      <AuButton variant="primary" onClick={handleSave}>Save Changes</AuButton>
    </>
  }
>
  <div>Modal form fields...</div>
</AuModal>
```

---

### `<AuCodeViewer>`
Multi-language syntax highlighter (Bicep, ARM JSON, Bash/CLI, Terraform) with line numbers and 1-click clipboard feedback.

```tsx
import { AuCodeViewer } from './theme';

<AuCodeViewer
  code={bicepCode}
  language="bicep"
  title="main.bicep"
  maxHeight="500px"
/>
```

---

### `<AuExpandCollapseButton>`
Accordion group toggle button.

```tsx
import { AuExpandCollapseButton } from './theme';

<AuExpandCollapseButton
  isAllExpanded={allExpanded}
  onToggle={() => setAllExpanded(!allExpanded)}
  expandText="Expand All Groups"
  collapseText="Collapse All Groups"
/>
```

---

## 5. Validation & Sanitization Engine

Exported from `src/theme/inputValidators.ts`:

| Function | Purpose | Rules & Constraints |
| :--- | :--- | :--- |
| `validateTagKey(key)` | Tag Key Validation | Max 512 chars; cannot contain `< > % & \ ? /`; cannot begin with `microsoft:`, `azure:`, or `windows:` |
| `validateTagAllowedValues(val)` | Tag Values | Max 256 chars; rejects trailing commas and illegal control chars |
| `validateNamingPattern(pat)` | Resource Naming | 1–80 chars; validates valid `{tokens}` (e.g., `{Org}`, `{Role}`) and warns on unmatched brackets |
| `validateAlphanumericPrefix(val)`| Prefix Tokens | 2–8 alphanumeric characters; no spaces or symbols |
| `validateAzureGuid(guid)` | Azure Subscription GUID | Standard 8-4-4-4-12 hex format (`00000000-0000-0000-0000-000000000000`) |
| `sanitizeInput(val, mode)` | Input Sanitizer | Modes: `'alphanumeric'`, `'alphanumeric-dash'`, `'tag-key'`, `'numeric'` |

---

## 6. Theme Pack Portability & Migration Guide

The entire theme system is completely self-contained in `src/theme/`. It has **0 dependencies on portal-specific code**.

### To migrate this theme to ANY new React/Next.js/Vite project:
1. Run the packager script:
   ```bash
   node build-tactical-ui.mjs
   ```
2. Copy the resulting `tactical-ui/` directory or extract `tactical-ui.zip` into your new project:
   ```bash
   cp -r tactical-ui /path/to/my-new-app/src/theme
   ```
3. In your root entry file (`main.tsx` or `app/layout.tsx`):
   ```tsx
   import './theme/theme.css';
   import { ThemeProvider } from './theme';
   ```
4. If the new project uses Tailwind CSS, reference the preset in `tailwind.config.js`:
   ```javascript
   module.exports = {
     presets: [require('./src/theme/tailwind.preset.js')],
     // ...
   };
   ```

---

## 7. Extensibility & Maintenance Playbook

Whenever new UI components, colors, or validators are built:
1. **Adding a New Color or Token**:
   - Add the key/value to `portal/src/theme/tokens.json`.
   - Map it to a CSS variable in `:root` inside `portal/src/theme/theme.css`.
   - Update `portal/src/theme/tailwind.preset.js` if Tailwind is used.
2. **Adding a New Component Primitive**:
   - Create the component in `portal/src/theme/components.tsx` or as a standalone file in `portal/src/theme/`.
   - Export its interface and component in `portal/src/theme/index.ts`.
   - Add matching `.au-*` styles in `portal/src/theme/theme.css`.
3. **Updating the Pack**:
   - Log changes in `portal/src/theme/CHANGELOG.md`.
   - Run `npm run build:theme` (or `node build-tactical-ui.mjs`) to keep `tactical-ui.zip` always up-to-date.

---

## 8. Package Distribution & Licensing

> [!NOTE]
> **Open Source / Portability**:
> - Package name: **`@0ccupi3r/tactical-ui`**
> - Release license: **MIT License**.
> - The source code, React component implementations, TypeScript types, validation logic, syntax highlighting engine, and HUD CSS rules are 100% original code. You have full legal ownership to use, distribute, or open-source this library.
