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

## Team flow

Teams are the main path. `/for-teams/` shows the price before signup (`TeamPriceBox`, kept in the browser), then `/sign-up/?for=teams`, `/team/setup/` (reads the company's website, `src/lib/team.ts` and `src/lib/site-read.ts`), `/team/order/` (a headcount and a package, `src/lib/team-packages.ts`) and the normal checkout. Names come after paying at `/team/people/`: a list, or the join link `/join/<company>/<token>/`, limited to the places the team has bought. `/team/left/<id>/` moves a card to a replacement. Website reads refuse private addresses at every redirect (`safeFetch`). Events are counts and choices only, and `insights.team_funnel` reads them.

## Staff view-as

Staff can open the site as a customer from `/admin/users/<id>/`. `currentUserId()` then returns the customer, and `src/proxy.ts` refuses every write, so new actions and API routes are covered without extra code. A page that writes while it renders must skip that write when `isViewingAs()` is true.

## Products

Staff edit a product's name, description, prices and visibility at `/admin/products/`. The product IDs are fixed in `src/lib/catalog.ts`, so there is no adding or deleting there. The home page and profile screens read prices through `src/lib/product-prices.ts`. The WordPress-exported pages in `src/content/pages` still have prices in their own text.

## Salespeople and commission

Staff tick Salesperson and set a rate on `/admin/users/<id>/`. A salesperson signs in to `/admin/` but can open only the paths in `src/lib/admin-paths.ts` (quotes and commissions). `src/proxy.ts` enforces that, because the admin layout doesn't run between admin pages; a new page that should be theirs must also filter to their own records with `requireQuoteStaff()`. The link is `/r/<code>/`. A new account within 7 days of a click stores `users.referred_by`. If their first sale comes within 1 month of sign-up, their orders credit that salesperson for 12 months from sign-up. An order through a quote credits the quote's salesperson instead, and staff can override either on the order page. Commission is written when an order is paid (`setOrderStatus`), on sales excluding shipping, including the Additional Shipping quote line, and it never blocks a payment. It goes out on the 25th for orders paid up to the 20th (`commissions.payout_date`). A salesperson can't change prices on a quote. They can give a basket discount of up to their commission rate on the products (`quotes.sales_discount_cents`), and it comes off their commission: they earn on the sale before it, less all of it. The rules and their tests are in `src/lib/sales-rules.ts`, the database side in `src/lib/sales.ts`, and the report is `/admin/commissions/`. Sign-ups and quotes from before this was built have no salesperson.
