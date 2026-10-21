# UI Design System Rules: Technical-Editorial Architecture (apisec|con Theme)

Whenever generating or styling UI components in this project, strictly adhere to the following aesthetic and structural rules:

1. **Aesthetic Direction:** High-craft Technical-Editorial UI. Think Swiss architectural grids meets modern developer security documentation. Zero bloat, zero stock photography, zero decorative blobs or heavy drop-shadows.
2. **Surface & Border Architecture:**
   - Separate sections and card groups using **1px solid hairline borders** (`var(--border-hairline)`) rather than box-shadows or floating cards.
   - Use `.au-hairline-grid` (1px gap over a hairline background) for key-value metadata bars, feature matrices, and stat counters.
3. **Typography & Metadata Formatting:**
   - **Headings (`--font-display`):** Tight negative letter-spacing (`-0.025em` to `-0.035em`), semi-bold weight (`600`), sentence case (never all-caps for main headlines).
   - **Technical Metadata (`--font-mono`):** Always use monospace with middle-dot separators (`·`) for structured metadata strings (e.g., `Shift 01 · Authorship`, `Oct 21 · 12:00–4:45 PM ET`, `Speaker Name · Role, Company`).
   - **Directional Links:** Use inline unicode arrows (`→`) on secondary action links (`See the agenda →`).
4. **Copy & Hierarchy:**
   - Every major card or thesis block must open with a monospace index label (`01 · Category`), followed by a punchy declarative sub-headline (`Machines write the code now.`), followed by muted secondary prose (`--text-secondary`).