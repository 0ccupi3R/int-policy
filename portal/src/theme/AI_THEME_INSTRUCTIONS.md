# AI Design System Mandate: Technical-Editorial Architecture

You are working inside a project powered by the **@0ccupi3r/tactical-ui** theme system (`portal/src/theme/` or `tactical-ui/`).
Whenever you create, refactor, or style ANY page, view, dashboard, form, modal, or component, you MUST strictly use this folder's tokens, CSS variables, and React primitives.

## 1. Single Source of Truth
- **Tokens:** `tokens.json`
- **Styles & Variables:** `theme.css`
- **React Primitives:** `components.tsx` (`AuHudCard`, `AuTabs`, `AuButton`, `AuBadge`, `AuModal`, `AuSelect`, `AuValidatedInput`, `AuTokenChip`, `AuCodeViewer`, etc.)

## 2. Core Aesthetic & Architectural Rules
1. **1px Hairline Grids Over Floating Shadows:**
   - Never use heavy drop-shadows, blurry glowing blobs, or generic Bootstrap/MUI cards.
   - Group related cards, metrics, and key-value specs inside `.au-hairline-grid` with `.au-hairline-cell` children so items are separated by crisp `1px solid var(--border-hairline)` borders.
2. **Typography & Dot-Separated Monospace Metadata:**
   - Main headlines use `.au-hero-title` or `.au-section-title` (tight negative tracking `-0.025em` to `-0.035em`, sentence case, weight `600`).
   - All metadata, index numbers, timestamps, categories, and pricing tiers MUST use `.au-mono-meta` (`var(--font-mono)`) with middle-dot separators (`·`), e.g., `Shift 01 · Authorship` or `v2.4 · Production Ready`.
3. **Color & Surface Discipline:**
   - Never hardcode hex values in components. Always reference CSS variables (`var(--bg-canvas)`, `var(--bg-surface)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--accent-primary)`, `var(--border-hairline)`) or the `au-*` Tailwind classes.
4. **Updating & Evolving the Theme:**
   - When the user asks to update a color, font, spacing token, or add a new component pattern, update `src/theme/tokens.json` and `src/theme/theme.css` first, export any new React primitive from `src/theme/components.tsx`, and log the change in `src/theme/CHANGELOG.md`.
