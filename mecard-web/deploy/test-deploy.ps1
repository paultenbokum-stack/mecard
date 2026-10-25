# The test deploy before cutover, in one go (TEST-DEPLOY.md): steps 1, 2, keys (sandbox PayFast and
# Bob Go), 4 with -Test (run.app address, every email to you, noindex) and 5 (migrations, then the
# WordPress import after you type IMPORT). Each step skips what already exists, so it is safe to re-run.
# It never sets up the domain (6, 6b) or the hourly email job (8): those are for cutover.
# Usage: .\deploy\test-deploy.ps1 -EmailTo you@example.com [-Project <id>] [-SkipImport] [-ImagesStage <folder>]
param(
  [Parameter(Mandatory = $true)][string]$EmailTo,
  [string]$Project,
  [switch]$SkipImport,
  [string]$ImagesStage
)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project

if ($EmailTo -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw '-EmailTo must be your email address: every email the test site sends goes there.' }
foreach ($tool in 'gcloud', 'docker') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed or not on PATH (TEST-DEPLOY.md, before you start)." }
}
if (-not $SkipImport -and -not (Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue)) {
  throw 'cloud-sql-proxy not found. Install it with: gcloud components install cloud-sql-proxy'
}
$ErrorActionPreference = 'Continue'
docker info *> $null
$dockerUp = $LASTEXITCODE -eq 0
$account = "$(gcloud config get-value account 2>$null)".Trim()
$ErrorActionPreference = 'Stop'
if (-not $dockerUp) { throw 'Docker Desktop is not running. Start it and run this again.' }
if (-not $account) { throw 'Not logged in to gcloud. Run: gcloud auth login   and   gcloud auth application-default login' }

Write-Host "Test deploy of MeCard to $Project ($Region) as $account" -ForegroundColor Cyan
Write-Host "Every email the test site sends goes to $EmailTo." -ForegroundColor Cyan

Write-Step '1/5 Project, APIs, registry and image buckets'
& "$PSScriptRoot\1-setup-project.ps1" -Project $Project

Write-Step '2/5 Cloud SQL database (about 10 minutes the first time)'
& "$PSScriptRoot\2-database.ps1" -Project $Project

Write-Step '3/5 Keys (sandbox PayFast and Bob Go for the test)'
& "$PSScriptRoot\keys.ps1" -Cloud -Test -Project $Project

# The tables first, so the site has a database to read when it starts.
Write-Step '4/5 Migrations, then the WordPress import'
if ($SkipImport) {
  & "$PSScriptRoot\5-migrate-import.ps1" -Project $Project -MigrateOnly
} else {
  Write-Host 'The import reads the WordPress export loaded in your local MariaDB (WP_DATABASE_URL in .env.local).' -ForegroundColor Yellow
  & "$PSScriptRoot\5-migrate-import.ps1" -Project $Project
}

if ($ImagesStage) {
  Write-Step 'Images: uploading the staged originals (IMAGES.md)'
  & "$PSScriptRoot\9-images.ps1" -Project $Project -Stage $ImagesStage
}

Write-Step '5/5 Build and deploy (test mode)'
& "$PSScriptRoot\4-deploy.ps1" -Project $Project -Test -EmailTo $EmailTo

Write-Host "`nNext: the click-through in TEST-DEPLOY.md. Not done here, on purpose: the domain (6, 6b) and the hourly email job (8)." -ForegroundColor Green
