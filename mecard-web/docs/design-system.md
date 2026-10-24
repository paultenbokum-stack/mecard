# MeCard design system

The brand book and component rules for mecard-web. The source of truth is the MeCard Design
System artifact (https://claude.ai/artifact/EtvQAARQQH4qgS8SWNFSnZ). Its tokens are mirrored in
`src/app/design-tokens.css`. When a token or rule changes, update the artifact first, then
`design-tokens.css` and this file.

MeCard is the smart business card that puts you in someone's contacts the moment they tap. Paper
cards get filed, forgotten or binned. A MeCard turns a handshake into a saved contact (name,
number, email, socials, company) ready to engage. Everything in this system serves that one
moment: **tap → saved → connected.**

Every surface should feel:

- **Tech-forward.** Precise type, Signal Blue, mono details, signal-wave motifs. Never gimmicky, never "futuristic" chrome.
- **Like a professional first impression.** Generous whitespace, one clear action per view, the person's own card design front and centre.
- **About connection.** Copy and visuals always end on the human result (a saved contact, a conversation), not on the chip.

## Content

**Voice:** confident, concise, friendly. Short benefit-led sentences. Speak to the reader as *you*. MeCard speaks as *we* only in support or FAQ.

Lines to model from:

> The only business card you'll ever need.
> Create a professional profile in 60 seconds. Share it via NFC, QR code, or WhatsApp. No app to install.
> Start free. Upgrade when you're ready.
> No credit card, no commitment.

- **Do** lead with the outcome: "They tap. You're saved." / "Be in their contacts before the handshake ends."
- **Do** name the three ways to share in this order: NFC, QR code, WhatsApp.
- **Do** write prices as `R199` (no space, no decimals) and periods as "billed annually".
- **Don't** use exclamation marks, emoji, "revolutionary", "game-changing" or "Web3". Tech is shown, not shouted.
- **Don't** call the product "the app". There is no app to install. It's "your MeCard", "your profile", "your card".
- **Casing:** sentence case everywhere, buttons included ("Create my free profile"). Eyebrows are the only uppercase. The brand is written **MeCard** in copy; the logo itself is lowercase *me*card.

## Colour

Signal Blue (`--brand`, #0066ff) is the brand. Midnight (`--ink`, #0f1729) is its partner. Connected green (`--connect`) is the reward colour: it appears when something is saved, ticked or live.

| Token | Light | Midnight | Use |
| --- | --- | --- | --- |
| `--surface` | #ffffff | #0f1729 | Page background |
| `--surface-subtle` | #f7f8fa | #1e2536 | Alternate section bands, raised cards in Midnight |
| `--surface-muted` | #eef0f4 | #2b3448 | Hairline card borders and dividers. Decorative only |
| `--brand-tint` | #e8f0ff | #172a4d | Soft brand fills: step-number chips, NFC share tile, hero gradient end |
| `--ink` | #0f1729 | #f7f8fa | Headings, prices, primary text |
| `--ink-strong` | #1e2536 | #eef0f4 | Outline-button labels, body copy in the CTA banner |
| `--ink-muted` | #4a5163 | #a3aab8 | Body copy, sub-headings, labels, footnotes |
| `--ink-subtle` | #8a919e | #8a919e | Control borders, disabled states, icons. Text only at 19px bold or larger (3.2:1 on white) |
| `--brand` | #0066ff | #0066ff | Primary button, featured borders, badges. One per view |
| `--brand-strong` | #0050cc | #0050cc | Hover/pressed for brand fills; blue text on `--brand-tint` |
| `--on-brand` | #ffffff | #ffffff | Text and icons on brand fills |
| `--link` | #0066ff | #5c9dff | Inline links, accent words in headings |
| `--focus-ring` | #0066ff | #5c9dff | 2px keyboard focus outline |
| `--connect` | #10b981 | #34d399 | Decoration only in Light (2.5:1 on white) |
| `--connect-strong` | #047857 | #34d399 | Success text and meaningful check icons |
| `--on-connect` | #0f1729 | #0f1729 | Text on connect fills |
| `--danger` | #c42f3a | #ff8a8a | Form errors and destructive actions, always with a message |
| `--share-whatsapp` / `-tint` | #16a34a / #f0fdf4 | same | WhatsApp share tile only |
| `--share-qr` / `-tint` | #d97706 / #fef3c7 | same | QR share tile only |
| `--share-link` / `-tint` | #db2777 / #fce7f3 | same | Copy-link share tile only |
| `--device` | #1a1a1a | same | Phone-frame bezel. Never a UI surface |

- Pages sit on `--surface`; alternate bands use `--surface-subtle`; soft brand moments use `--brand-tint`.
- Text: headings and prices in `--ink`, body and footnotes in `--ink-muted`. `--ink-subtle` fails 4.5:1 on white and is for borders, disabled states and 19px-bold+ only.
- Text on `--brand` is `--on-brand`. Blue text on `--brand-tint` uses `--brand-strong` (Signal Blue is 4.2:1 there).
- Use `--link` for inline links and accent words.
- Green that carries meaning (a tick next to a feature, "Saved") uses `--connect-strong`. Plain `--connect` is decoration in Light.
- The share colours appear only on share-method tiles, never as UI accents.
- **Midnight** (`[data-theme="dark"]`) is a full theme, not just dark mode: for campaign heroes, the "tap" demo band and the tapper view after dark. It isn't switched on anywhere yet. Check both themes when adding colours.
- Gradients: only `--surface` → `--brand-tint` at 160° (hero) and 180° (demo band). Never blue-to-purple.

## Typography

Fonts load through `next/font` in `src/app/(card)/fonts.ts` and are exposed as `--font-display`, `--font-text` and `--font-mono` by `design-tokens.css`.

- Headings in **Montserrat** (`var(--font-display)`): weight 600 for `h2`/`h3`, 700 for hero, card headings and prices.
- Copy in **Source Sans 3** (`var(--font-text)`): body at 16px / 1.65, lead for intros.
- **IBM Plex Mono** (`var(--font-mono)`, weight 500) for profile URLs, card IDs and NFC details only. A small, deliberate tech signal. Never for sentences.
- One hero per page. Above each section heading, an eyebrow in `--link` ("HOW IT WORKS"), `--space-3` below it.

| Style | Family | Size / line height | Weight | Use |
| --- | --- | --- | --- | --- |
| hero | display | 51px / 1.1, -0.02em | 700 | One per page. `clamp(2rem, 5vw, 3.2rem)` on the live hero |
| h2 | display | 38px / 1.3 | 600 | Section headings |
| h3 | display | 30px / 1.3 | 600 | Sub-section headings |
| heading-md | display | 24px / 1.25 | 700 | Card and banner headings |
| price | display | 38px / 1.1 | 700 | Prices on pricing cards, in `--ink` |
| title | display | 17px / 1.4 | 600 | Step titles, tier names, card names |
| eyebrow | display | 12px / 1.4, 1.5px | 700 | Uppercase label above a section heading |
| lead | text | 19px / 1.6 | 400 | Hero and section intros, `--ink-muted` |
| body | text | 16px / 1.65 | 400 | Default copy |
| body-sm | text | 15px / 1.5 | 400 | Feature lists, sub-headings, step descriptions |
| button | text | 16px / 1.25 | 600 | Button labels, sentence case |
| caption | text | 13px / 1.45 | 400 | Footnotes and trust lines |
| data | mono | 13px / 1.5, 0.02em | 500 | Profile URLs, card IDs, NFC/vCard details |

## Layout, shape and depth

- Content width 1200px, 20px gutters. Sections pad `--space-18` (72px), `--space-12` on mobile.
- Spacing steps: `--space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24, `-7` 28, `-10` 40, `-12` 48, `-14` 56, `-18` 72, `-20` 80 (px).
- Corners: `--radius-xs` (4px) form inputs, `--radius-md` (12px) buttons and small cards, `--radius-tile` (14px) share tiles, `--radius-lg` (20px) step, pricing and banner cards, `--radius-device` (40px) phone frame, `--radius-pill` badges. Nothing is square; nothing is fully round except pills and the signal dot.
- Borders before shadows: cards rest on a 1px `--surface-muted` hairline. On hover the border turns `--brand` and the card lifts 2–4px with a blue-tinted shadow.
- Shadows are tinted with Signal Blue, not grey:
  - `--shadow-sm`: product card hover
  - `--shadow-md`: step card hover
  - `--shadow-featured`: featured pricing card at rest
  - `--shadow-card`: pricing card hover
  - `--shadow-banner`: CTA banner
  - `--shadow-cta`: primary button hover glow
  - `--shadow-device`: phone frame and physical-card mockups
- Motion: 0.2–0.25s ease for hovers; sections fade up 24px over 0.6s once (`mc-reveal`). Respect `prefers-reduced-motion`.
- Focus: a solid 2px `--focus-ring` outline with a 2px offset on every interactive element. `design-tokens.css` applies it inside `.mc-wp`, `.acc`, `.mc-site-header`, `.mc-site-footer`, `.me-onboarding` and `.me-auth-entry`. New UI outside those wrappers needs its own.

## Imagery

- Show the **physical card** in context: in hand, beside a phone, mid-tap. Use the card mockups (`card-custom-front.png` for the Custom card and hero moments, `card-classic-front.png` for the Classic card and bundle) with `--shadow-device` on `--surface` or a `--brand-tint` band.
- Show the **result**: a phone screen with the profile open and "Save contact" ready, framed with the phone frame.
- Real people, real meetings, warm light. No stock "hologram" or circuit-board imagery.

## Motif: the signal

The brand's shape language is the **NFC signal**: a dot with two or three concentric arcs, in `--brand` on `--brand-tint`, or in `--link` on Midnight. Use it as a section ornament, the cover pattern and the "tap here" hint on cards. It replaces the generic blurred circle in the CTA banner.

## Iconography

- Font Awesome 6 (solid) glyphs: `fa-check`, `fa-xmark`, `fa-wifi` rotated for NFC, `fa-qrcode`, `fa-whatsapp`, `fa-link`. Keep that set for consistency.
- Feature ticks in `--connect-strong`; crosses in `--ink-subtle` at 50% opacity.
- No emoji.

## Logo

- The wordmark is lowercase **me**card: *me* in bold, *card* in regular. The person comes first. `mecard-wordmark.png` (748×267) is black ink only: use it on Light grounds; on Midnight place it on a white chip until a white or SVG version exists.
- `me-mark.png` (512px) is the square mark for favicons and social avatars; `me-app-icon.png` (512px, padded) is the PWA / home-screen icon.
- Minimum clear space: the height of the *e* on all sides. Never recolour, stretch or set the wordmark in another font.

## Components

Components are CSS classes with the `mc-` prefix, no JavaScript. The full set lives in the artifact's `components/bundle.css`. In mecard-web, `src/app/(site)/site.css` already has `mc-btn`, `mc-badge`, `mc-step`, `mc-price-card`, `mc-cta` and `mc-reveal`. The others (`mc-label`, `mc-share`, `mc-product`, `mc-features`, `mc-phone`, `mc-contact`) are not ported yet: copy them from the artifact when a page needs them, rather than inventing new ones.

**Button** (`mc-btn` + one variant, optional `mc-btn-sm` / `mc-btn-lg`, optional leading icon sized to 1em). Buttons drive the single next step on a view.
- `mc-btn-primary`: one per view, the main conversion. `--brand` with `--on-brand` text; hover deepens to `--brand-strong` and lifts with `--shadow-cta`.
- `mc-btn-outline`: secondary ("For my team", "See pricing").
- `mc-btn-white` / `mc-btn-ghost`: only on Signal Blue or Midnight bands.
- Labels: sentence case, first person where it fits ("Create my free profile"), about 4 words at most. No arrows, no exclamation marks.

**Eyebrow** (`mc-label`). Labels a section above its heading, uppercase in `--link`. Write 1–3 words in sentence case in the source; CSS uppercases it. Always followed by an `h2` in `--ink`, `--space-3` between. One per section, never on cards or buttons.

**Badge** (`mc-badge`, optional `mc-badge--soft` on `--brand-tint` or `mc-badge--connect`, optional leading `mc-badge__dot`). 1–3 words. Blue badges sit on the top edge of a featured card ("Recommended", "Best value"). Green means connected: only for real saved / active / live states, always with a word.

**Share tile** (`mc-share mc-share--nfc|wa|qr|link`, icon in `mc-share__icon`, label in `mc-share__label`). Always in the order NFC, WhatsApp, QR code, Link. The `--share-*` colours belong to these tiles only. Always keep the text label: the QR glyph alone is under 3:1 on its tint.

**Step card** (`mc-step` with `mc-step__num`, `mc-step__title` of 2–4 words, `mc-step__desc` of one sentence). Three steps, never more than four, in an equal-width grid with `--space-6` gaps, stacked on mobile. The last step lands on connection ("you're saved").

**Price card** (`mc-price-card`, `--featured` plus a leading `mc-badge` for the recommended plan). Tier name, price as `R199` with optional `mc-price-card__period`, a sub-line, an `mc-features` list and one button. Exactly one featured card; its button is primary, the others outline. Keep feature lists to the differences between plans.

**Product card** (`mc-product`, `--best` plus a leading `mc-badge` for the bundle). Card image (80px tall), name, price and one-line description. Show the real card design, never a generic chip illustration.

**Feature list** (`<ul class="mc-features">`, each `<li>` starting with a check icon; `is-off` for an unavailable feature with a cross). Ticks in `--connect-strong`; unavailable rows drop to `--ink-subtle`. Lead each item with the benefit, not the feature name.

**CTA banner** (`mc-cta` with optional `mc-cta__signal`, eyebrow, `mc-cta__heading`, `mc-cta__text`, one primary button and an `mc-cta__trust` line). One per page, last before the footer. The signal arcs replace a blurred circle.

**Phone frame** (`mc-phone` > `mc-phone__screen` holding a screenshot `<img>`, object-fit cover, top, or a live component such as the contact card). Pair with `--shadow-device` on `--surface` or a `--brand-tint` band.

**Contact card** (`mc-contact`). What someone sees the instant they tap a MeCard. Name, role, company, optional photo (else initials in `mc-contact__avatar`), the profile URL in mono, up to four quick-contact icons and two actions.
- **Save contact** (downloads the vCard) is always the primary button and always visible without scrolling.
- "Share my details back" is the secondary action: it turns a one-way tap into a two-way connection.
- The cover band is the company's colour or photo when set; Midnight with signal arcs when not.

## Card pages

Card pages (`/t/...`) keep each company's own branding (colours, fonts, cover). Only the MeCard header and footer use the design tokens there.
