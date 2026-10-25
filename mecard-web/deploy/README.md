# Deploying to Google Cloud (Cloud Run + Cloud SQL, africa-south1)

PowerShell scripts for the steps in the deploy guide. Run them from `mecard-web`, after
`gcloud auth login`, with Docker Desktop running. Each one is safe to re-run: what already
exists is skipped. No secret values are stored in these files.

If Windows blocks the scripts, run them as
`powershell -ExecutionPolicy Bypass -File .\deploy\<script>.ps1 ...`.

| Order | Script | What it does |
| --- | --- | --- |
| 1 | `.\deploy\1-setup-project.ps1` | Links billing (after you type LINK), selects the project, enables the APIs, creates the `mecard` Docker repository and the two private image buckets (`<project>-media` for WebP masters, `<project>-uploads`, Archive class, for the original uploads) |
| 2 | `.\deploy\2-database.ps1` | Cloud SQL Postgres 16 `mecard-db` (about 10 min), database + user; the generated password goes straight into the `DATABASE_URL` secret |
| 3 | `.\deploy\keys.ps1 -Cloud` (same as `3-secrets.ps1`) | Every key in one go: shows which are set, asks for the missing ones (hidden typing), checks them with the service where it can, saves them to Secret Manager, generates `AUTH_SECRET` and `CRON_SECRET`, and lets Cloud Run read them. Keys already set locally can be reused. `-Update NAME,NAME` asks again. Without `-Cloud` it does the same for `.env.local` (sandbox PayFast and Bob Go) |
| 4 | `.\deploy\4-deploy.ps1` | Builds, pushes and deploys the current commit to the `mecard` Cloud Run service. The reCAPTCHA site key comes from `.env.local` (keys.ps1) the first time and is remembered on the service after that |
| 5 | `.\deploy\5-migrate-import.ps1` | Through the Cloud SQL Auth Proxy: runs migrations, then (after you type IMPORT) wipes and imports the WordPress data. `-MigrateOnly` for migrations alone |
| 6 | `.\deploy\6-domain.ps1` | HTTPS load balancer for mecard.co.za + www (static IP, managed certificate, http to https redirect); prints the IP for DNS |
| 7 | `.\deploy\7-github-actions.ps1` | One time: lets GitHub Actions deploy (keyless Workload Identity Federation). After this, add the deploy workflow (see the Nextag one) so every push to `master` that touches `mecard-web` runs it: lint, typecheck, test, build, migrate, deploy |
| 8 | `.\deploy\8-scheduler.ps1` | One time: a Cloud Scheduler job that runs the reminder emails and basket clean-up (`/api/cron/automations`) every hour, sending `CRON_SECRET` |
| 9 | `.\deploy\9-images.ps1 -Stage <folder> [-DryRun]` | Uploads the original images to the `-uploads` bucket with `gcloud storage rsync` (re-runnable, never deletes). Before it, on a fresh copy of the live site's `wp-content/uploads`: `npm run images:plan -- --source <copy> --stage <new folder>`, which leaves out resized copies and the folders holding customer data (CSV exports, invoices, quote PDFs, logs, private downloads) and lists any image the data refers to that the copy lacks |
| - | `.\deploy\backup.ps1` | Manual Cloud SQL backup |
| - | `.\deploy\rollback.ps1 [-Revision <name>]` | Sends all traffic to the previous (or named) Cloud Run revision |

Project, billing account, site address and the Xneelo connection are in `deploy/config.ps1`
(the existing "Mecard" project, Taggable billing). The scripts always use that project, never
gcloud's current default; `-Project` overrides. Step 1 links billing only after you type LINK.

For a test run before cutover (real data, emails to you, sandboxes, noindex, on the run.app
address), see [TEST-DEPLOY.md](TEST-DEPLOY.md): `.\deploy	est-deploy.ps1 -EmailTo <you>`.

The uploads and the go-live day have their own runbooks: [IMAGES.md](IMAGES.md) (with
`pull-uploads.ps1`, `npm run images:plan`, `9-images.ps1`, `npm run images:warm`) and
[CUTOVER.md](CUTOVER.md) (the Xneelo DNS records, TTL, rollback).

Step 5 needs `gcloud components install cloud-sql-proxy`. Run the import only at cutover,
with WordPress in maintenance mode and a fresh export loaded locally. Later deploys are
just step 4, plus `5-migrate-import.ps1 -MigrateOnly` when a commit adds a migration.
