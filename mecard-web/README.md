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

Images are referenced by their original `/wp-content/uploads/…` path and served by the
image route below.

Left behind on purpose: Riscura, the white-label plugin, the blog, AutomateWoo's own
tables (its workflows are rebuilt in code), and contact form submissions (exported to CSV
instead).

## Public card pages

| URL | What it does |
| --- | --- |
| `/t/<slug>/` | The printed card URL. Linked card → its profile (tracked as an NFC tap); unlinked card → the empty site page, as WordPress showed; trashed card, or one linked to an archived profile → 404. `/t/ABC/` and `/T/abc/` redirect to `/t/abc/`. |
| `/mecard-profile/<slug>/` | A profile's own page. Archived profiles → 404. |
| `/vcard/?profile_id=…` | The contact file, same URL as WordPress. |
| `/wp-content/uploads/…` | Every image, old links included. `?w=` picks a width, `?fmt=jpeg` a JPEG. |
| `/api/track/` | Browser events into `events` (old `/wp-json/mecard/v1/track` is rewritten here). |
| `/api/manifest/?pid=…` | "Add to Home Screen" manifest (old `/wp-json/mecard/v1/manifest` too). |

The pages are ports of the plugin's `templates/profile-pro.php` and `profile-standard.php`
with the same markup and class names; `src/app/(card)/card.css` holds only the rules from
the ~35 WordPress stylesheets that matched them. Pro profiles get the company branding and
custom CSS, scoped to the profile (`src/lib/branding.ts`). The pages are the same for every
visitor and cached (ISR, 5 minutes); everything per-visitor runs in the browser
(`CardBehaviour.tsx`).

**Images** go through one route (`src/lib/images/`): the `media` table says where an
image's 1,200 px WebP master lives in the media bucket; if there is none, the original is
read from the archive bucket, resized once, saved and recorded, then served. Old resized
URLs (`photo-300x300.jpg`) fall back to the original. Images found nowhere get a grey
placeholder and an `image_miss` log line. Locally the originals come from
`wp-content/uploads` (set `LOCAL_UPLOADS_DIR` when the app runs from a worktree) and masters
are cached in `.media-cache/`.

**URL check** — every card and profile URL against a running copy:

```
npm run build && npx next start -p 3001
BASE_URL=http://localhost:3001 npm run check:urls
```

## Deploying

See `deploy/README.md`. MeCard gets its own Google Cloud project.
