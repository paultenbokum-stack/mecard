# CLAUDE.md (mecard-web)

Guidance for Claude Code when working in `mecard-web/`, the Next.js replacement for the
WordPress site. Paths below are relative to this folder. See `README.md` for setup.

## Design system

All UI follows the MeCard design system.
- Tokens: `src/app/design-tokens.css` (colours, spacing, radius, shadows, fonts). Never hard-code hex values, pixel radii or shadows. Use the tokens (`var(--brand)`, `var(--ink-muted)`, `var(--radius-md)`...).
- Brand book and component rules: `docs/design-system.md`. Read it before any UI work.
- Colours: `brand` (#0066ff) for the one main button per view; `ink` for headings; `ink-muted` for body and small print (never `ink-subtle` for text under 19px bold). Green (`connect` / `connect-strong`) only means saved, connected or live.
- Type: headings in `var(--font-display)` (Montserrat), body in `var(--font-text)` (Source Sans 3), profile URLs and IDs in `var(--font-mono)`.
- Shape: buttons and small cards use `--radius-md`, larger cards `--radius-lg`, badges `--radius-pill`. Cards rest on a 1px `--surface-muted` border and lift on hover with `--shadow-sm` or `--shadow-md`.
- Focus: every interactive element shows a 2px `--focus-ring` outline.
- Copy: sentence case, no exclamation marks, no emoji. Write prices as `R199`.
- Card pages (`/t/...`) keep each company's own branding. Only the MeCard header and footer use the tokens there.
- The dark theme exists (`[data-theme="dark"]`) but isn't switched on. Test both themes when adding colours.
- When a token changes, update it in the Design System artifact first, then here.

## Conversion plan (after cutover)

Measurement, experiments and the weekly UX review are planned in `docs/conversion-plan.md`, with the
Insights dashboard mockup in `docs/insights-mockup.html`. Build sessions follow its sections 3 and 4.
Cutover with feature parity comes first; don't start the plan until Paul says so.
