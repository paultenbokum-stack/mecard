# MeCard conversion plan: measurement, experimentation and weekly UX review

**Status:** v2, updated with Paul's decisions · 24 Oct 2026
**Codebase:** `mecard-web` (Next.js), branch `claude/project-thread-xxq7j6`
**Where this will run:** Paul's Taggable Claude account, through Claude Code (see section 8)
**Cutover target:** this weekend (24–25 Oct 2026), with Phase 0 and Phase 1 included

---

## 1. Goal

Grow acquisition and conversion by running a steady series of measured changes on the flows MeCard already has. The flow change in April/May is the baseline, not something to undo.

Claude's role is UX advisor. Each week it reads the live numbers, finds where people drop off, proposes the next change, and judges the last one.

**What we optimise, in order:**

1. **Acquisition.** At 5–10 signups a week, getting more people to the top of the funnel matters most right now.
2. **Paid conversion.** A free profile becomes a card order or a Pro upgrade within 30 days.
3. **Activation.** A free profile is published, shared, and viewed by at least one other person.
4. **Viral reach.** New signups that come from existing profiles, per active profile.
5. **Team expansion.** A single user becomes a company with 2 or more members.

## 2. Guiding rules

- **Measure first.** No change ships without an event that can show whether it worked.
- **No personal data leaves the app.** Claude sees counts and opaque IDs only: no names, emails, phone numbers or IP addresses. This is enforced by a database role (section 4).
- **Plan for low volume (5–10 signups a week).** Classic 50/50 A/B tests on signup or paid conversion would take months to reach a result. Instead:
  - **Split-test only high-volume surfaces.** Public profile views (the viral CTA, post-save prompts) see far more traffic than signups do.
  - **Run signup and paid funnel changes one after another.** Hold each change for a fixed period, compare it against the period before, and change one thing at a time.
  - **Make big changes, not small tweaks.** Small effects can't be seen at this volume.
  - **Read each user's path.** With about 8 signups a week, Claude can review every new user's anonymised event trail and describe where each one stopped. That's often more useful than a percentage.

## 3. Phase 0: tracking, shipped with the cutover

The guiding question for the weekend: **which data is lost forever if it isn't captured from day one?** That data ships with the cutover. Anything that can be worked out later from raw events can wait.

### 3a. Must ship with the cutover (this data can't be recovered later)

| # | Change | Why it can't wait | Where |
|---|---|---|---|
| 0.1 | **Link visits to accounts:** at `signup_completed`, store the `mecard_sid` session cookie on the user (`users.first_session_id`) | Without it, anonymous visits before signup can never be linked to the account | signup route |
| 0.2 | **First-touch source:** on first page load, save `utm_*`, referrer domain, landing path and `ref_profile_id` in a cookie; copy it to `users.acquisition` (jsonb) at signup | The source is only known at the moment of arrival | middleware + signup |
| 0.3 | **Viral referral:** `recipient_ad_clicked` and `post_save_cta_clicked` set `ref_profile_id` in that cookie | Otherwise signups from the viral loop can't be attributed | card page script |
| 0.4 | **Signup intent:** one-tap "For me / For my team" question at signup (`signup_intent`); no change to where the user goes next yet | It must be asked at signup | signup form |
| 0.5 | **Upsell impressions:** new `upsell_viewed`; add `{placement, trigger}` to it and to `pro_upsell_clicked` | Impressions can't be rebuilt later | `/manage/`, onboarding, editor |
| 0.6 | **Checkout events (server-side):** `checkout_started`, `payment_cancelled`, `payment_failed` | PayFast returns and failures happen only once | `cart.ts`, `payfast.ts` |
| 0.7 | **Page events:** `page_viewed {path}` on marketing pages (home, pricing, teams, shop, product), sent from the browser | Visits to these pages can't be rebuilt later | layout beacon |
| 0.8 | **Onboarding step views:** `onboarding_step_viewed {step}` | Tells "never reached a step" apart from "reached it but didn't save" | onboarding page |
| 0.9 | **Experiment tag:** a `meta.exp` field accepted on every event (empty for now) | Saves a schema change later | `lib/tracking.ts` |

### 3b. Can follow after the cutover (no data lost)

- `card_activated`: can be worked out from the first `/t/` view after a card is assigned
- Grouping the funnel by signup week: a query change only
- Team path and pricing breakdowns: can be built from `page_viewed`

### Checks before go-live

On staging, take one test visitor from a UTM link, through signup ("for my team"), each onboarding step, an upsell impression and a PayFast sandbox checkout. Then confirm one user row shows every event, with its acquisition source and `first_session_id` filled in. Also confirm the WordPress `wp_mecard_events` data has migrated into `events`, so history back to mid-June is kept.

## 4. Phase 1: connect Claude, shipped with or just after the cutover

### 4.1 `insights` schema (one Drizzle migration)

These are read-only views that return IDs and counts only. They never include names, emails, phones or `ip_hash`. A dedicated Postgres role, `claude_insights`, has `USAGE` and `SELECT` on `insights` **and nothing else**.

**Minimum for the cutover:**

| View | Answers |
|---|---|
| `insights.user_journeys` | One row per event for each user and session: opaque user ID, event, timestamp, source, step, placement, device and country. Used for the per-user path reviews. |
| `insights.signups` | Opaque user ID, signup time, acquisition source, intent, and flags/dates for published, first external view, upsell seen, checkout started and paid |
| `insights.engagement_daily` | Profile views, saves, contact taps, shares and viral CTA views and clicks per day, by source and device |
| `insights.orders` | Opaque user ID, order time, product type (single, Pro, bundle, team), value and status |

**Next (built from the above, no new tracking needed):** `funnel_cohort`, `viral_loop`, `upsell_performance`, `checkout_funnel`, `team_path`, `experiment_results`.

### 4.2 MCP endpoint: `/api/mcp`

A read-only MCP server inside `mecard-web` on the existing Cloud Run service, using `@modelcontextprotocol/sdk` over Streamable HTTP and connected to the database as `claude_insights`.

**Minimum tools for the cutover:**

- `query(sql)`: read-only `SELECT` on `insights.*` only, with a 500-row limit and a 10-second timeout
- `schema()`: lists the `insights` views and their columns, so Claude can write correct SQL

**Later:** shortcut tools such as `funnel`, `viral`, `upsells` and `experiment_result`.

**Auth:** a bearer token, `INSIGHTS_MCP_TOKEN`, stored in Secret Manager and added to `deploy/keys.ps1`. Register it in Claude Code with:

```
claude mcp add --transport http mecard-insights https://<site>/api/mcp --header "Authorization: Bearer <token>"
```

**Safety checks:**

- A test confirms the `claude_insights` role gets a permission error on `users`, `profiles` and `orders`.
- `query` rejects anything that isn't a single `SELECT`.
- Every query is written to `admin_log`.

## 5. Phase 2: experiment framework (after the cutover, deferred)

- **Assignment:** variant = hash(`mecard_sid` + experiment key) mod 100, so a visitor always sees the same variant. Card pages are cached, so the assignment there is done in the browser script.
- **Registry:** an `experiments` table plus a staff page at `/admin/experiments/` (start, stop, end, decision).
- **Exposure:** an `experiment_exposed {key, variant}` event fires when the change is actually seen.
- **Run modes** (because of low volume):
  - `split` for public profile surfaces
  - `sequential` for signup and paid funnel changes: the whole period runs variant B and is compared with the period before

## 6. Experiment backlog (first-pass ranking, to revisit after the cutover)

| # | Experiment | Mode | Primary metric |
|---|---|---|---|
| E4 | **Viral CTA on public profiles:** clearer "Get your free MeCard", including after a contact save | split | Signups per 1,000 profile views; viral factor K |
| E3 | **Defer the install (add to home screen) step** until after publishing | sequential | Share of signups that publish and get a first external view |
| E1 | **Route by signup intent:** send "for my team" to the team flow (routing decision deferred) | sequential | Rate of signups that become teams; paid within 30 days |
| E2 | **Upsell at the moment of value**, triggered by the first external views or contact saves | sequential | Paid within 30 days |
| E5 | **Colleague prompt** on `/manage/` | sequential | Invites per active user |
| E6 | **Pricing anchor:** team bundle shown first | sequential | Pricing page → checkout rate |
| E7 | **Two-sided referral** (budget decision deferred) | sequential | Referral signups |
| E8 | **Checkout friction** | sequential | Checkout → paid rate |

E4 moves to the top: it's the only test with enough traffic for a split test, and it works on acquisition, which is the biggest constraint.

## 7. Weekly review loop (starts the first Monday after cutover)

**Claude reports:**

1. **Scorecard:** profile views, signups (by source and intent), activation, paid conversion, viral factor K and revenue, each against the 4-week average
2. **New-user walkthrough:** each of the week's roughly 5–10 signups, showing their anonymised path and where they stopped
3. **Running change:** status, and a call to keep, ship or roll back
4. **Next proposal:** hypothesis, mode, metric, and any tracking it needs

**Decision rules:**

- **Split tests:** at least 2 weeks and at least 1,000 profile views per variant. Ship at 90% confidence or better, with no worse guardrail metric.
- **Sequential changes:** at least 4 weeks per period, or 30 signups, whichever comes later. Call the result "directional" unless the effect is large, for example paid conversion doubling. Roll back if activation or revenue clearly drops.

## 8. Moving this to the Taggable account

This plan was drafted in a YUMBI-account session. MeCard data must not flow through YUMBI.

1. Commit this file to the repo as `mecard-web/docs/conversion-plan.md`. Claude Code in the Taggable account will read it from there.
2. Point `mecard-web/CLAUDE.md` at this plan, so build sessions follow sections 3 and 4.
3. Register the `mecard-insights` MCP endpoint **only in Claude Code under the Taggable account**.
4. Optional: in the Taggable account, schedule the Monday review (section 7) as a recurring task.

## 9. Decisions

| # | Decision | Status |
|---|---|---|
| 1 | Cut over this weekend with Phase 0 (3a) and Phase 1 (minimum) included | **Decided** |
| 2 | Connect Claude through Claude Code with a bearer token | **Decided** |
| 3 | Volume is 5–10 signups a week, so use the low-volume approach in section 2 | **Decided** |
| 4 | Where "for my team" signups go (E1) | Deferred until experiments start after cutover |
| 5 | Referral incentive budget (E7) | Deferred until after cutover |
| 6 | Is the MCP endpoint in the cutover release, or a follow-up release within days? Phase 0 (3a) must be in the cutover; the MCP endpoint can follow without losing data | **Open:** choose based on how the weekend goes |
