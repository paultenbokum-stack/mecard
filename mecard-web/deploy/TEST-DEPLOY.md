# Test deploy (Cloud Run, Johannesburg) before cutover

A full copy of the live site on its Cloud Run address (`https://mecard-<number>.africa-south1.run.app`),
with real data and images, and three safety switches so testing can't touch customers:

- **Email**: every email (invites, orders, quotes, reminders, the contact form) goes to *your*
  address, its subject starting `[TEST, for <the customer>]`.
- **Payments and couriers**: PayFast and Bob Go **sandboxes** (keys kept as `TEST_…` secrets; your
  live keys are never touched).
- **Search engines**: every page says `noindex`.

The domain (steps 6, 6b) and the hourly reminder job (step 8) are **not** set up: they are for
cutover. Run everything in PowerShell from `mecard-web`.

## Before you start

1. Google Cloud SDK installed, then `gcloud auth login` and `gcloud auth application-default login`
   (the account that owns the Mecard project).
2. `gcloud components install cloud-sql-proxy`
3. Docker Desktop running.
4. The fresh WordPress export loaded into the local MariaDB on port 3307 (`WP_DATABASE_URL` in
   `.env.local`).
5. Images pulled and checked: [IMAGES.md](IMAGES.md) steps 1 to 3, then the stage folder from
   step 4's first command (`npm run images:plan -- … --stage C:\mecard-cutover\stage-1`).
6. To hand: PayFast **sandbox** merchant ID, key and passphrase (sandbox.payfast.co.za), a Bob Go
   **sandbox** key, the Resend key, and the Google sign-in client ID and secret.
   Values already in `.env.local` are offered for reuse.

## Deploy (one command)

```
.\deploy\test-deploy.ps1 -EmailTo you@example.com -ImagesStage C:\mecard-cutover\stage-1
```

It runs, skipping whatever already exists:

1. Project, APIs, Docker registry, image buckets (asks you to type LINK if billing isn't linked).
2. Cloud SQL Postgres (about 10 minutes the first time).
3. Keys into Secret Manager (asks only for missing ones; PayFast and Bob Go as sandbox).
4. Migrations (all of them, including 0008 and 0009), then the WordPress import after you type
   IMPORT. It wipes and refills the cloud database, so it can be re-run with a newer export.
5. Uploads the staged images (leave out `-ImagesStage` to skip).
6. Builds and deploys in test mode, then prints the site address and the setting below.

Without the import: add `-SkipImport`. Redeploy after a code change:
`.\deploy\4-deploy.ps1 -Test` (it remembers your email address).

## Once, after the first deploy

7. Google sign-in: console.cloud.google.com > APIs & Services > Credentials > the OAuth client >
   Authorized redirect URIs: add the `…run.app/api/auth/callback/google` address the deploy printed.
8. Warm the images: `npm run images:warm -- --url https://mecard-…run.app` (IMAGES.md step 5).

## Click through

9. Public: a card page `/t/<slug>/` and `/mecard-profile/<slug>/` (photos, logo, Save contact,
    vCard download), the home page, shop and contact form (its email arrives at your address).
10. Log in as yourself (staff): `/admin/` orders, cards, stats.
11. Log in as a customer (use Lost password: the reset email comes to you, with their address
    in the subject): My MeCard Home or the team dashboard, edit a profile, a company, My Cards.
12. Sign up a new account, both "Just me" and "For my team", with throwaway addresses.
13. Order: add a card, check out with PayFast **sandbox** (sandbox card details from PayFast),
    check the order, its emails (to you) and the Bob Go sandbox rates at checkout.
14. Request a quote; open it from the email.
15. Logs if anything misbehaves: Cloud Run > mecard > Logs.

## Afterwards

- **Keep it for cutover** (recommended): cutover is then CUTOVER.md, with
  `.\deploy\keys.ps1 -Cloud` for the live PayFast and Bob Go keys and `.\deploy\4-deploy.ps1`
  **without** `-Test`. That replaces every test setting (email redirect, sandboxes, noindex,
  run.app address) and builds for https://mecard.co.za.
- **Pause it**: nothing runs when nobody visits (no minimum instances). Cloud SQL costs while it
  exists: `gcloud sql instances patch mecard-db --activation-policy=NEVER` stops it, `ALWAYS` starts it.
- **Remove it**: `gcloud run services delete mecard --region=africa-south1` and
  `gcloud sql instances delete mecard-db` (the second deletes the database for good).
