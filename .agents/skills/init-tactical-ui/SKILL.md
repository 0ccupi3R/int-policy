---
name: init-tactical-ui
description: Initialize and verify the @0ccupi3r/tactical-ui design system and component library in any project. Performs a token-efficient pre-flight check to exit early if already configured.
---

# Tactical UI Theme Initializer Skill (`init-tactical-ui`)

Use this skill when setting up, onboarding, or verifying the **Tactical UI** design system (`@0ccupi3r/tactical-ui` v2.0.0) in any new or existing React/web workspace.

---

## ⚡ Step 0: Fast Pre-Flight Check (Early Exit / Token Preservation)

> [!IMPORTANT]
> **Token Optimization Mandate**:
> Before reading large catalog files, running shell installations, or regenerating files, check if the workspace is **already configured**:
>
> 1. **Check Theme Library Presence**:
>    - Does `src/theme/components.tsx`, `portal/src/theme/components.tsx`, or `node_modules/@0ccupi3r/tactical-ui/components.tsx` exist?
> 2. **Check Agent Theme Rule**:
>    - Does `.agents/rules/theme_system.md` exist?
> 3. **Check Stylesheet Wiring**:
>    - Is `theme.css` or `@0ccupi3r/tactical-ui/theme.css` imported in the active CSS file (e.g. `index.css` or `App.css`)?

### 🛑 Early Exit Condition
If **ALL 3 checks pass**, the project is ALREADY initialized. **STOP IMMEDIATELY**.
Do not install dependencies, do not re-read files, do not emit large JSON/JSX snippets.
Output this concise response:

```markdown
✓ Tactical UI (@0ccupi3r/tactical-ui v2.0.0) is already fully initialized in this workspace.
  - Theme Components: Verified
  - Agent System Directives (.agents/rules/theme_system.md): Active
  - Stylesheets: Linked
Ready for feature development. Setup skipped to conserve tokens.
```

---

## 🛠️ Step 1: Incremental Setup (Only for Missing Items)

If any check in Step 0 failed, execute **ONLY** the missing items:

### A. If Theme Files Are Missing
1. Look for `tactical-ui.zip` or the `tactical-ui/` directory in the repository:
   - If `tactical-ui.zip` is present:
     ```bash
     unzip -o tactical-ui.zip -d src/theme/
     ```
   - If `tactical-ui/` directory is present:
     Copy or link into `src/theme/` (or install via `npm install ./tactical-ui`).
2. Verify peer dependencies in `package.json`:
   - Required: `lucide-react`
   - Optional / utility: `clsx`, `tailwind-merge`
   - If missing: `npm install lucide-react clsx`

### B. If Agent Rules Are Missing
If `.agents/rules/theme_system.md` does not exist:
Create `.agents/rules/theme_system.md` with:
- System Directive requiring `@0ccupi3r/tactical-ui` v2.0.0 primitives (`<AuHudCard>`, `<AuButton>`, `<AuBadge>`, `<AuTabs>`, `<AuModal>`, `<AuSelect>`, `<AuValidatedInput>`).
- 1px hairline border constraint (`var(--border-hairline)`).
- Prohibition against unstyled raw HTML buttons, floating cards with drop shadows, or generic colors.

### C. If Stylesheet Wiring Is Missing
1. Ensure the root CSS file imports the tactical theme:
   ```css
   @import './theme/theme.css';
   ```
2. Verify Google Fonts in `index.html` or CSS:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Spectral:wght@500;600;700&display=swap" rel="stylesheet">
   ```

---

## 🔍 Step 2: Quick Smoke Test
Once missing items are wired, run a fast build or render check to confirm zero styling regressions, then print a concise summary.
