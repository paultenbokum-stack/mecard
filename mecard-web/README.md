# mecard-web

Next.js version of mecard.co.za, replacing the WordPress site, the Toolset plugins and
WooCommerce. Built on the Nextag setup (`C:\wamp64\www\nextag\_nextag-web`): Next.js,
Auth.js, Drizzle with Postgres, Cloud Run and Cloud SQL in africa-south1.

The migration plan, with the decisions behind this layout:
https://claude.ai/code/artifact/1485c114-5f1f-4976-bd38-f9724dd441d3

## Run it locally

Needs Node 20+ and Docker.

```
npm install
docker compose up -d                # Postgres on localhost:5435
cp .env.example .env.local          # then set AUTH_SECRET (any long random string)
npm run db:migrate
```

Then load your live data or demo data:

```
# Live data: import toolset-export/mecard_wp.sql into MySQL (WAMP), point
# WP_DATABASE_URL in .env.local at it, then:
npm run import:wp
# …or demo data: demo@mecard.co.za / password123
npm run db:seed
```

```
npm run dev                         # http://localhost:3000
```

Imported users log in with their existing WordPress passwords.

## What the import does

`scripts/import-wp.ts` empties the app tables and copies everything across, keeping
WordPress IDs. It is safe to re-run and takes about 10 seconds on the October 2026 dump.

| WordPress | Postgres |
| --- | --- |
| `wp_users` + usermeta | `users` |
| `company` posts + `wpcf-*` fields | `companies` (branding, custom CSS, logo path) |
| `mecard-profile` posts | `profiles` (trashed = archived) |
| `more-links`, `more-links-company` | `profile_links` |
| `t` posts (cards and tags) | `cards`; the slug is the printed `/t/<slug>/` URL |
| `request` posts | `profile_invites` |
| Toolset relationships | foreign keys: `profiles.company_id`, `cards.profile_id`, `cards.company_id`, `cards.order_id`, `profile_links.*_id`, `profile_invites.profile_id` |
| WooCommerce orders, items, notes, products, coupons | `orders`, `order_items`, `order_notes`, `products`, `coupons` |
| `wp_mecard_entitlements` | `entitlements` |
| `wp_mecard_events` | `events` |

Images are referenced by their original `/wp-content/uploads/…` path. The image route
(next phase) serves them from Cloud Storage and restores archived ones on first request.

Left behind on purpose: Riscura, the white-label plugin, the blog, AutomateWoo's own
tables (its workflows are rebuilt in code), and contact form submissions (exported to CSV
instead).

## Deploying

See `deploy/README.md`. MeCard gets its own Google Cloud project.
