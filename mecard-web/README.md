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
| `/t/<slug>/` | The printed card URL. Linked card → its profile (tracked as an NFC tap, and saving the contact on the first tap when the card has auto-download on); unlinked card → "this card isn't set up yet" with a link to activate it at `/manage/`; trashed card, or one linked to an archived profile → 404. `/t/ABC/` and `/T/abc/` redirect to `/t/abc/`. |
| `/mecard-profile/<slug>/` | A profile's own page. Archived profiles → 404. |
| `/vcard/?profile_id=…` | The contact file, same URL as WordPress. |
| `/wp-content/uploads/…` | Every image, old links included. `?w=` picks a width, `?fmt=jpeg` a JPEG. |
| `/api/track/` | Browser events into `events` (old `/wp-json/mecard/v1/track` is rewritten here). |
| `/api/manifest/?pid=…` | "Add to Home Screen" manifest (old `/wp-json/mecard/v1/manifest` too). |

The pages are ports of the plugin's `templates/profile-pro.php` and `profile-standard.php`
with the same markup and class names; `src/app/(card)/card.css` holds only the rules from
the ~35 WordPress stylesheets that matched them. Pro profiles get the company branding and
custom CSS, scoped to the profile (`src/lib/branding.ts`); CSS written for the whole page or
the profile container is mapped onto the profile, and one-off fixes for companies whose
branding was broken on WordPress live in `src/lib/company-css-fixes.ts`. The pages are the same for every
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

## Accounts and the logged-in screens

| URL | What it does |
| --- | --- |
| `/my-account/` | Login with email or WordPress username and the existing password (rehashed to bcrypt on first login), or Google when `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set. Logged-in people go to `/manage/` (or `?next=`). |
| `/my-account/lost-password/`, `/my-account/reset-password/?token=` | Password reset by email: a one-hour, single-use link (only its hash is stored). Without `RESEND_API_KEY` the email is printed in the dev server terminal. |
| `/my-account/customer-logout/` | Log out (asks first, like WooCommerce). |
| `/manage/` | The logged-in home: your profiles (search, archive/restore, add), invites waiting for you, Pro upgrade status, and `?activate=<card>` — the "Activate this card" flow from an unlinked card. |
| `/manage/cards/` | Live cards and cards not linked yet: link, change profile, unlink, label, auto-save-contact. |
| `/manage/companies/`, `/manage/company/<id>/` | Companies you own: details, logo, fonts, colours, custom CSS, company buttons (live preview on one of its profiles), and the Team tab (people, invites). |
| `/manage/profile/<id>/` | Profile editor with a live preview. Standard profiles: details, photo, socials. Pro adds the direct line and "My Links". A paid, unused Pro upgrade can be applied here (saving also applies it, as on WordPress). |
| `/invite/<id>/<token>/` | The link in an invite email; accepting makes you the profile's owner. |
| `/api/upload/` | Photo and logo uploads: stored as a WebP master under `/wp-content/uploads/mecard/…`, served by the image route. |

Who may edit what (`src/lib/access.ts`): a profile by its owner, its manager (the WordPress
post author), the owner of its company, or an admin; a company by its owner or an admin; a
card by its owner, its company's owner, or whoever may edit the profile it opens.

Old URLs keep working: `/wp-login.php` (with `action=lostpassword|rp|logout` and
`redirect_to`), `/login/`, `/password-recovery/`, the `/manage-mecard-profiles/…` console
tabs, `/invite-user/` and old `/request/<slug>/` invite links.

On card pages, signed-in owners get the "Edit Profile" bar and, on free profiles, the Pro
upsell in the share panel; their own visits aren't counted as views (`/api/me/card/`, and
`/api/track/` drops `profile_viewed` from owners).

**Signing in as a real customer locally** — give imported accounts a local-only password
(refuses to run unless `DATABASE_URL` is on localhost; `npm run import:wp` restores the
real hashes):

```
npm run dev:password -- jacques@nxtlevelcoach.co.za tvanzyl@entersekt.com chantel@brandhouseco.co.za
```

The default password is in `scripts/dev-password.ts`.

## Public site pages

`/`, `/how-it-works/`, `/for-teams/`, `/cards/`, `/free/`, `/gallery/`, `/contact-us/` and
`/tsc/privacy-policy/` are the WordPress pages, exported from `wp_posts` into
`src/content/pages/*.json` by `npm run export:pages` (WP_DATABASE_URL) and rendered inside
Astra's page markup (`src/components/site/WpPage.tsx`). The converter (`src/lib/wp-content.ts`)
adds what WordPress added at render time: layout classes, group inner containers, closed
accordion panels, Toolset "logged in / logged out" blocks (switched in the browser, since
the pages are static) and slots for the contact form and gallery.

`src/app/(site)/site.css` holds every rule from live's stylesheets that matched these pages,
in cascade order, scoped to the page wrapper. The gallery is a snapshot of the Instagram feed
(`src/content/gallery.json`). The contact form emails CONTACT_TO (printed in the terminal in
dev) with a honeypot instead of reCAPTCHA. Dropped pages and dead links redirect
(`next.config.ts`); footer legal links stay on taggable.co.za as on live.

## Deploying

See `deploy/README.md`. MeCard gets its own Google Cloud project.
