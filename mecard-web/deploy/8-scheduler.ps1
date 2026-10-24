# Step 8 (one time): run the AutomateWoo replacements every hour (basket reminders, the
# on-hold EFT reminder, emptying abandoned baskets). Cloud Scheduler POSTs to
# /api/cron/automations/ with the CRON_SECRET from Secret Manager (made by 3-secrets.ps1).
# Re-running updates the job, e.g. after CRON_SECRET changes.
# Cloud Scheduler isn't offered in every region; -Location picks where the job lives
# (it only sends the request; the app still runs in africa-south1).
# Usage: .\deploy\8-scheduler.ps1 [-Project <id>] [-Location europe-west1] [-Url https://mecard.co.za]
param([string]$Project, [string]$Location = 'europe-west1', [string]$Url)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
Invoke-Gcloud config set project $Project

Write-Step 'Enabling Cloud Scheduler'
Invoke-Gcloud services enable cloudscheduler.googleapis.com

if (-not $Url) { $Url = "$(gcloud run services describe $Service --region=$Region --format='value(status.url)')".Trim() }
if (-not $Url) { throw "No URL for the $Service service: deploy it first (4-deploy.ps1) or pass -Url." }
if (-not (Test-Gcloud secrets describe CRON_SECRET)) { throw 'CRON_SECRET is missing: run .\deploy\3-secrets.ps1 first.' }
$secret = "$(gcloud secrets versions access latest --secret=CRON_SECRET)".Trim()

$job = 'mecard-automations'
$common = @("--location=$Location", '--schedule=0 * * * *', '--time-zone=Africa/Johannesburg', "--uri=$Url/api/cron/automations/",
  '--http-method=POST', '--attempt-deadline=300s', '--quiet', '--format=none')
Write-Step "Job ${job}: every hour, POST $Url/api/cron/automations/"
try {
  if (Test-Gcloud scheduler jobs describe $job "--location=$Location") {
    Invoke-Gcloud scheduler jobs update http $job @common "--update-headers=Authorization=Bearer $secret"
  } else {
    Invoke-Gcloud scheduler jobs create http $job @common "--headers=Authorization=Bearer $secret"
  }
} finally { $secret = $null }

Write-Host "`nDone. Run it now to check: gcloud scheduler jobs run $job --location=$Location" -ForegroundColor Green
Write-Host 'Then look for [automations] in the Cloud Run logs.'
