# Step 3: put the app's keys in Secret Manager and let Cloud Run read them.
# Asks for each missing secret (typing is hidden); AUTH_SECRET and CRON_SECRET are generated for you.
# Existing secrets are skipped; to change one, pass its name: -Update PAYFAST_PASSPHRASE,BOBGO_API_KEY
# Usage: .\deploy\3-secrets.ps1 [-Project <project-id>] [-Update NAME,NAME]
param([string]$Project, [string[]]$Update = @())
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
Invoke-Gcloud config set project $Project

$help = @{
  AUTH_GOOGLE_ID       = 'Google OAuth client ID (APIs & Services > Credentials)'
  AUTH_GOOGLE_SECRET   = 'Google OAuth client secret'
  RESEND_API_KEY       = 'Resend API key (mecard.co.za verified in Resend)'
  PAYFAST_MERCHANT_ID  = 'Live PayFast merchant ID'
  PAYFAST_MERCHANT_KEY = 'Live PayFast merchant key'
  PAYFAST_PASSPHRASE   = 'PayFast passphrase (must match PayFast > Settings > Security)'
  BOBGO_API_KEY        = 'Bob Go production API key'
  RECAPTCHA_SECRET_KEY = 'NEW reCAPTCHA v2 secret for mecard.co.za (the old one is in git)'
}

foreach ($name in $SecretNames) {
  if ($name -eq 'DATABASE_URL') { continue }  # made by 2-database.ps1
  $exists = Test-Gcloud secrets describe $name
  if ($exists -and ($Update -notcontains $name)) { Write-Host "$name exists, skipping."; continue }

  if ($name -eq 'AUTH_SECRET' -or $name -eq 'CRON_SECRET') {
    Write-Step "$name (generated)"
    Set-Secret $name (New-RandomString 32)
    continue
  }

  Write-Step "$name - $($help[$name])"
  $secure = Read-Host "Value for $name (blank = skip for now)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if (-not $value) { Write-Host "Skipped $name. Run this script again when you have it." -ForegroundColor Yellow; continue }
  Set-Secret $name $value
  $value = $null
}

Write-Step 'Letting the Cloud Run service account read secrets and connect to Cloud SQL'
$number = "$(gcloud projects describe $Project --format='value(projectNumber)')".Trim()
$sa = "serviceAccount:$number-compute@developer.gserviceaccount.com"
foreach ($role in 'roles/secretmanager.secretAccessor', 'roles/cloudsql.client') {
  Invoke-Gcloud projects add-iam-policy-binding $Project "--member=$sa" "--role=$role" --condition=None --quiet --format=none
}

Write-Step 'Secrets status'
foreach ($name in $SecretNames) {
  if (Test-Gcloud secrets describe $name) { Write-Host "  [x] $name" } else { Write-Host "  [ ] $name (missing)" -ForegroundColor Yellow }
}
Write-Host "`nNext: .\deploy\4-deploy.ps1 -RecaptchaSiteKey <site key>" -ForegroundColor Green
