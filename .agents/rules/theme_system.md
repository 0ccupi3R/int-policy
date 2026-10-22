# System Directive: Enforce & Maintain the Tactical UI Design System (@0ccupi3r/tactical-ui)

This project strictly uses the **Tactical UI** design system (**`@0ccupi3r/tactical-ui`** v2.0.0), a high-craft fusion of the **Editorial Swiss Grid** and **HUD React Tactical Telemetry** architecture.

---

## 0. Prerequisite Check & Dependency Verification
Before generating or modifying any UI code, the agent MUST verify that the theme package is installed and present:
1. **Primary Workspace Location**: `portal/src/theme/`
2. **Standalone Package Directory**: `tactical-ui/`
3. **Portable Archive File**: `tactical-ui.zip` (at repository root)
4. **npm Package**: `@0ccupi3r/tactical-ui` (tarball: `0ccupi3r-tactical-ui-2.0.0.tgz`)

> [!IMPORTANT]
> **Action Required if Theme is Missing**:
> If working in a new workspace, fresh laptop checkout, or external project where `portal/src/theme/` does not exist:
> - **Prompt the user or run**: `unzip tactical-ui.zip -d ./portal/src/theme` (or `npm install ./tactical-ui` / `npm install ./0ccupi3r-tactical-ui-2.0.0.tgz`).
> - Ensure peer dependency is installed: `npm install lucide-react`.
> - Do NOT generate ad-hoc UI, Tailwind utilities, or Bootstrap/MUI styles from scratch.

---

## 1. Single Source of Truth
- **Design Tokens**: `portal/src/theme/tokens.json` (Deep Petrol Dark & Clean Light palettes, typography, border radius, animations).
- **Global Styles & CSS Custom Properties**: `portal/src/theme/theme.css` (`--bg-canvas`, `--bg-surface`, `--text-primary`, `--accent-primary`, `--accent-mint`, `--accent-rose`, `--border-hairline`, etc.).
- **Theme Provider**: `portal/src/theme/ThemeProvider.tsx` (React theme context with automatic dark/light persistence).
- **Reusable React Primitives (`portal/src/theme/components.tsx`)**:
  - `<AuHudCard>`: 4-corner hairline reticle HUD card with kicker, meta, and action slots.
  - `<AuTabs>`: Tactical tab navigation strip.
  - `<AuButton>`: Primary (`teal`), secondary, and danger button variants.
  - `<AuBadge>`: Tactical status pills (`mint`, `rose`, `amber`, `azure`, `purple`).
  - `<AuModal>`: Backdrop-blurred modal dialog.
  - `<AuSelect>`: Custom dark dropdown selector with searchable filter and compact mode (`.au-select-compact`).
  - `<AuValidatedInput>`: Real-time validated form input.
  - `<AuCheckbox>`: Styled checkbox component.
  - `<AuTokenChip>`: Quick-insert token chip with click-to-copy.
  - `<AuCodeViewer>`: Zero-dependency syntax highlighter (Bicep, ARM, PowerShell, Bash, JSON).
  - `<AuExpandCollapseButton>`: Accordion batch expand/collapse control.
- **Validation Engine**: `portal/src/theme/inputValidators.ts` (`validateTagKey`, `validateTagAllowedValues`, `validateNamingPattern`, `validateCandidateName`).
- **Tailwind Integration**: `portal/src/theme/tailwind.preset.js`.

---

## 2. Core Aesthetic Mandate
1. **1px Hairline Grids & Reticles Over Drop Shadows**:
   - Never use generic drop-shadows, blurry glow blobs, or floating Bootstrap/MUI cards.
   - Use `.au-hud-card` or `.au-hairline-grid` with hairline borders (`1px solid var(--border-hairline)`).
2. **Universal Dark Input Discipline**:
   - Form inputs, search fields, textareas, and selects must use dark canvas backgrounds (`var(--bg-canvas)`) with crisp hairline borders (`var(--border-hairline)`). Zero white backgrounds.
3. **Typography & Monospace Metadata**:
   - Headlines use Spectral serif (`--font-display` / `.au-hero-title` or `.au-section-title`).
   - Technical metadata, counts, and tags use IBM Plex Mono (`--font-mono` / `.au-mono-meta`) with middle-dot separators (`·`), e.g., `36 Types · 1 Failed` or `v2.0.0 · Active`.
4. **Color Discipline**:
   - Never hardcode hex values in component JSX. Always use CSS custom properties (`var(--bg-canvas)`, `--bg-surface`, `--text-primary`, `--accent-primary`, `--accent-mint`, `--accent-rose`, etc.).

---

## 3. Evolving & Rebuilding the Theme Pack
- Whenever modifying design tokens, adjusting CSS rules, or building new primitives:
  1. Update `portal/src/theme/tokens.json`, `portal/src/theme/theme.css`, and `portal/src/theme/components.tsx`.
  2. Document changes in `portal/src/theme/CHANGELOG.md`.
  3. Rebuild the portable archive with:
     ```bash
     npm run build:theme
     ```
     This automatically regenerates `tactical-ui/`, `tactical-ui.zip`, and `0ccupi3r-tactical-ui-2.0.0.tgz`.
