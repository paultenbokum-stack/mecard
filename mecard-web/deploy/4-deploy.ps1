# Step 4: build the Docker image, push it to Artifact Registry and deploy it to Cloud Run.
# Builds mecard-web as it is checked out, so commit first. The image tag defaults to the commit.
# The reCAPTCHA site key is only needed once: it is saved on the Cloud Run service and read
# back from there on later deploys (pass it again only to change it).
#
# -Test: the test deploy before cutover (TEST-DEPLOY.md). On the service's *.run.app address, with
# every email sent to -EmailTo instead of the customer, PayFast and Bob Go sandboxes (TEST_ secrets),
# and noindex on every page. A later deploy without -Test (cutover) replaces all of that.
# Usage: .\deploy\4-deploy.ps1 [-Test [-EmailTo you@example.com]] [-RecaptchaSiteKey <site key>] [-Project <id>] [-Tag v1] [-Url https://mecard.co.za]
param(
  [string]$Project,
  [string]$RecaptchaSiteKey,
  [string]$Tag,
  [string]$Url,
  [switch]$Test,
  [string]$EmailTo
)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
if ($Url) { $SiteUrl = $Url } elseif ($Test) { $SiteUrl = Get-RunUrl $Project }
Push-Location $AppDir
try {
  $branch = "$(git rev-parse --abbrev-ref HEAD)".Trim()
  if ($branch -ne 'master') { Write-Host "Warning: building branch '$branch', not master." -ForegroundColor Yellow }
  if (git status --porcelain --untracked-files=no) { Write-Host 'Warning: uncommitted changes will be in this image.' -ForegroundColor Yellow }
  if (-not $Tag) { $Tag = "$(git rev-parse --short HEAD)".Trim() }
  $image = "$Region-docker.pkg.dev/$Project/$Repo/web:$Tag"

  if (-not $RecaptchaSiteKey) {
    $ErrorActionPreference = 'Continue'
    $json = gcloud run services describe $Service "--project=$Project" "--region=$Region" --format=json 2>$null
    $ErrorActionPreference = 'Stop'
    if ($json) {
      $vars = ($json | Out-String | ConvertFrom-Json).spec.template.spec.containers[0].env
      $RecaptchaSiteKey = ($vars | Where-Object { $_.name -eq 'NEXT_PUBLIC_RECAPTCHA_SITE_KEY' } | Select-Object -First 1).value
      if ($Test -and -not $EmailTo) { $EmailTo = ($vars | Where-Object { $_.name -eq 'EMAIL_REDIRECT_TO' } | Select-Object -First 1).value }
    }
    if (-not $RecaptchaSiteKey) {
      # First deploy: the key keys.ps1 saved in .env.local.
      $line = Get-Content (Join-Path $AppDir '.env.local') -ErrorAction SilentlyContinue | Where-Object { $_ -match '^NEXT_PUBLIC_RECAPTCHA_SITE_KEY=(.+)$' } | Select-Object -First 1
      if ($line -match '=(.+)$') { $RecaptchaSiteKey = $Matches[1].Trim() }
    }
    if (-not $RecaptchaSiteKey) { throw 'No reCAPTCHA site key: run .\deploy\keys.ps1 (it asks for it), or pass -RecaptchaSiteKey <site key>.' }
    Write-Host 'Using the saved reCAPTCHA site key.'
  }

  if ($Test) {
    if (-not $EmailTo) { $EmailTo = (Read-Host 'Test deploy: every email goes to this address instead of the customer. Your email').Trim() }
    if ($EmailTo -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'A test deploy needs -EmailTo <your email address>, so no email reaches a customer.' }
    Write-Host "TEST deploy at $SiteUrl. Emails go to $EmailTo; PayFast and Bob Go sandboxes; not indexed." -ForegroundColor Yellow
  }

  Write-Step 'Docker login for Artifact Registry'
  Invoke-Gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

  Write-Step 'Base image node:22-slim'
  $ErrorActionPreference = 'Continue'
  docker pull node:22-slim *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Docker Hub not reachable; using the Google mirror.'
    docker pull mirror.gcr.io/library/node:22-slim
    docker tag mirror.gcr.io/library/node:22-slim node:22-slim
  }
  $ErrorActionPreference = 'Stop'

  Write-Step "Building $image"
  docker build -t $image --build-arg "NEXT_PUBLIC_APP_URL=$SiteUrl" --build-arg NEXT_PUBLIC_AUTH_GOOGLE=1 --build-arg "NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$RecaptchaSiteKey" .
  if ($LASTEXITCODE -ne 0) { throw 'docker build failed' }

  Write-Step 'Pushing'
  docker push $image
  if ($LASTEXITCODE -ne 0) { throw 'docker push failed' }

  $secrets = @()
  foreach ($name in $SecretNames) {
    $secret = Get-SecretName $name $Test
    if (Test-Gcloud secrets describe $secret "--project=$Project") { $secrets += "$name=${secret}:latest" }
    else { Write-Host "Warning: secret $secret is missing, so the app runs without $name." -ForegroundColor Yellow }
  }
  if ($secrets -notcontains 'DATABASE_URL=DATABASE_URL:latest') { throw 'DATABASE_URL secret missing: run 2-database.ps1 first.' }

  # Plain settings go in a YAML file (mail addresses come from src/lib/mail-settings.ts). The file
  # replaces every variable on the service, so a cutover deploy drops the test ones.
  $envFile = [IO.Path]::GetTempFileName()
  $plain = @(
    "AUTH_URL: `"$SiteUrl`""
    'AUTH_TRUST_HOST: "true"'
    "NEXT_PUBLIC_APP_URL: `"$SiteUrl`""
    "NEXT_PUBLIC_RECAPTCHA_SITE_KEY: `"$RecaptchaSiteKey`""
    "MEDIA_BUCKET: `"$(Get-MediaBucket $Project)`""
    "ARCHIVE_BUCKET: `"$(Get-ArchiveBucket $Project)`""
  )
  if ($Test) {
    $plain += 'PAYFAST_SANDBOX: "1"', 'BOBGO_SANDBOX: "1"', 'SITE_NOINDEX: "1"', "EMAIL_REDIRECT_TO: `"$EmailTo`""
  } else {
    $plain += 'PAYFAST_SANDBOX: ""'
  }
  $plain | Set-Content -Path $envFile -Encoding ascii

  Write-Step "Deploying Cloud Run service '$Service'"
  try {
    Invoke-Gcloud run deploy $Service "--project=$Project" "--image=$image" "--region=$Region" --allow-unauthenticated `
      --min-instances=0 --max-instances=3 --memory=512Mi "--add-cloudsql-instances=$(Get-ConnectionName $Project)" `
      "--env-vars-file=$envFile" "--set-secrets=$($secrets -join ',')"
  } finally { Remove-Item $envFile -Force -ErrorAction SilentlyContinue }

  $url = "$(gcloud run services describe $Service "--project=$Project" "--region=$Region" --format='value(status.url)')".Trim()
  Write-Host "`nDeployed $image" -ForegroundColor Green
  Write-Host "Service URL: $url" -ForegroundColor Green
  if ($Test) {
    Write-Host "`nTest site: $SiteUrl" -ForegroundColor Green
    Write-Host 'Add these once, if not done yet (TEST-DEPLOY.md):'
    Write-Host "  Google sign-in, Authorized redirect URI:  $SiteUrl/api/auth/callback/google"
    Write-Host "  reCAPTCHA admin, Domains:                 $(([Uri]$SiteUrl).Host)"
    Write-Host "  PayFast sandbox notify URL is sent with each payment ($SiteUrl/api/payfast/itn/); nothing to set."
  } else {
    Write-Host 'Do not place real orders until the live switch-over (guide Step 7).'
  }
} finally { Pop-Location }
