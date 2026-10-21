# System Directive: Apply & Maintain the Portable Theme Pack (`src/theme/`)

This project uses the portable **apisec-theme-pack** located in `src/theme/` (Technical-Editorial Swiss Grid design system originally extracted from `conf.apisecuniversity.com`).

Before writing or modifying any UI code, strictly enforce the following protocol:

## 1. Single Source of Truth
- **Design Tokens:** `src/theme/tokens.json` (Colors for Dark & Light modes, typography, spacing, border radiuses, snappy bezier transitions).
- **Global Styles & CSS Custom Properties:** `src/theme/theme.css` (`--bg-canvas`, `--bg-surface`, `--text-primary`, `--accent-primary`, `--border-hairline`, etc.).
- **Reusable React + TypeScript Primitives:** `src/theme/components.tsx` (`AuNavbar`, `AuSection`, `AuKeyValueGrid`, `AuShiftCardGrid`, `AuTierMatrix`, `AuAgendaTrack`, `AuStatStrip`).
- **Context & Types:** `src/theme/ThemeProvider.tsx` and `src/theme/types.ts`.
- **Root Entry Point:** Ensure `theme.css` is imported at the application entry root, and `tailwind.preset.js` is linked if Tailwind is configured.

## 2. Core Aesthetic Mandate (Technical-Editorial Swiss Grid)
1. **1px Hairline Grids Over Drop Shadows:**
   - Never use heavy drop-shadows, blurry glow blobs, or generic floating cards.
   - Group related cards, metrics, and key-value specs inside `.au-hairline-grid` with `.au-hairline-cell` children so items are separated by crisp `1px solid var(--border-hairline)` borders.
2. **Typography & Dot-Separated Monospace Metadata:**
   - Headlines use `--font-display` / `.au-hero-title` or `.au-section-title` (tight negative tracking `-0.025em` to `-0.035em`, sentence case, weight `600`).
   - All metadata, index numbers, timestamps, categories, and tags MUST use `.au-mono-meta` (`var(--font-mono)`) with middle-dot separators (`·`), e.g., `01 · Overview` or `Status · Active`.
3. **Strict Color & Surface Discipline:**
   - Never hardcode hex values in UI views. Always use CSS custom properties (`var(--bg-canvas)`, `var(--bg-surface)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--accent-primary)`, `var(--border-hairline)`) so Dark and Light modes function automatically.

## 3. Evolving & Updating the Theme Pack Over Time
- Whenever tweaking a color, adjusting spacing, or introducing a new reusable UI pattern (modal, data table, form input, sidebar, tabs bar, breadcrumbs):
  1. **Do not create one-off local styles inside a page.**
  2. Add any new tokens to `src/theme/tokens.json` & `src/theme/theme.css`.
  3. Export the typed React component from `src/theme/components.tsx` (and `src/theme/types.ts`).
  4. Document the addition in `src/theme/CHANGELOG.md` to ensure `src/theme/` remains 100% portable across future projects.
