# Step 4: build the Docker image, push it to Artifact Registry and deploy it to Cloud Run.
# Builds mecard-web as it is checked out, so commit first. The image tag defaults to the commit.
# The reCAPTCHA site key is only needed once: it is saved on the Cloud Run service and read
# back from there on later deploys (pass it again only to change it).
# Usage: .\deploy\4-deploy.ps1 [-RecaptchaSiteKey <site key>] [-Project <id>] [-Tag v1] [-SiteUrl https://mecard.co.za]
param(
  [string]$Project,
  [string]$RecaptchaSiteKey,
  [string]$Tag,
  [string]$SiteUrl = 'https://mecard.co.za',
  [string]$EmailFrom = 'MeCard <info@mecard.co.za>',
  [string]$ContactTo = 'info@taggable.co.za',
  [string]$OrderNotifyTo = 'info@taggable.co.za'
)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
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
    }
    if (-not $RecaptchaSiteKey) { throw 'No reCAPTCHA site key saved yet: pass -RecaptchaSiteKey <site key> this once.' }
    Write-Host 'Using the reCAPTCHA site key saved on the service.'
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
    if (Test-Gcloud secrets describe $name "--project=$Project") { $secrets += "$name=${name}:latest" }
    else { Write-Host "Warning: secret $name is missing, so the app runs without it." -ForegroundColor Yellow }
  }
  if ($secrets -notcontains 'DATABASE_URL=DATABASE_URL:latest') { throw 'DATABASE_URL secret missing: run 2-database.ps1 first.' }

  # Plain settings go in a YAML file so EMAIL_FROM's spaces and <> survive.
  $envFile = [IO.Path]::GetTempFileName()
  @(
    "AUTH_URL: `"$SiteUrl`""
    'AUTH_TRUST_HOST: "true"'
    "NEXT_PUBLIC_APP_URL: `"$SiteUrl`""
    "NEXT_PUBLIC_RECAPTCHA_SITE_KEY: `"$RecaptchaSiteKey`""
    'PAYFAST_SANDBOX: ""'
    "EMAIL_FROM: `"$EmailFrom`""
    "CONTACT_TO: `"$ContactTo`""
    "ORDER_NOTIFY_TO: `"$OrderNotifyTo`""
    "MEDIA_BUCKET: `"$(Get-MediaBucket $Project)`""
    "ARCHIVE_BUCKET: `"$(Get-ArchiveBucket $Project)`""
  ) | Set-Content -Path $envFile -Encoding ascii

  Write-Step "Deploying Cloud Run service '$Service'"
  try {
    Invoke-Gcloud run deploy $Service "--project=$Project" "--image=$image" "--region=$Region" --allow-unauthenticated `
      --min-instances=0 --max-instances=3 --memory=512Mi "--add-cloudsql-instances=$(Get-ConnectionName $Project)" `
      "--env-vars-file=$envFile" "--set-secrets=$($secrets -join ',')"
  } finally { Remove-Item $envFile -Force -ErrorAction SilentlyContinue }

  $url = "$(gcloud run services describe $Service "--project=$Project" "--region=$Region" --format='value(status.url)')".Trim()
  Write-Host "`nDeployed $image" -ForegroundColor Green
  Write-Host "Service URL: $url" -ForegroundColor Green
  Write-Host 'Do not place real orders until the live switch-over (guide Step 7).'
} finally { Pop-Location }
