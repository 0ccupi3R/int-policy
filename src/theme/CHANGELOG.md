# Theme Pack Evolution Changelog

All notable updates to this portable design system are documented here so AI agents and future projects stay in sync.

## [2.1.0] - 2026-10-21
### Added & Fixed
- **Universal Dark Input Enforcement**: Added global rules for `.input-field`, `.form-input`, `input[type="text"]`, `input[type="number"]`, and `input[type="search"]` enforcing dark canvas (`var(--bg-canvas)`) with zero white backgrounds.
- **Topology Studio AuSelect Upgrade**: Replaced all native `<select>` dropdowns in `TopologyGenerator.jsx` (Resource Type, VM OS, 11 Resource Tag Overrides, RG inline purpose & region, RG tag overrides, and Add RG modal) with custom `<AuSelect>`.
- **Compact Select Modifier (`.au-select-compact`)**: Added tight padding, font size, and badge scaling for dense grid rows and card headers.
- **Theme Catalog (`THEME_CATALOG.md`)**: Complete technical catalog tracking all tokens, components, validators, migration instructions, and open-source branding assessment.

## [2.0.0] - 2026-10-21
### Added
- Tactical HUD Cyber-Physical fusion (corner reticles, 22px radial dot matrix, Spectral serif + IBM Plex fonts).
- `<AuHudCard>`, `<AuSelect>`, `<AuValidatedInput>`, `<AuCheckbox>`, `<AuTokenChip>`, `<AuModal>`, `<AuCodeViewer>`, and `<AuExpandCollapseButton>`.
- Centralized input validation engine (`inputValidators.ts`).
- Standalone packaging script `build-theme-pack.mjs` generating `apisec-theme-pack.zip`.

## [1.0.0] - 2026-10-21
### Added
- Initial extraction from `conf.apisecuniversity.com` (apisec|con 2026 Technical-Editorial Design System).
- `tokens.json` with full Dark and Light mode palettes, Inter + JetBrains Mono typography, and 1px hairline border tokens.
- `theme.css` with universal custom properties and architectural classes (`.au-hairline-grid`, `.au-mono-meta`, `.au-details`, `.au-badge`).
- `components.tsx` with 7 core React + TypeScript primitives (`AuNavbar`, `AuSection`, `AuKeyValueGrid`, `AuShiftCardGrid`, `AuTierMatrix`, `AuAgendaTrack`, `AuStatStrip`).
