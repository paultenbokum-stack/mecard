# Shared settings and helpers for the deploy scripts. Dot-sourced, not run directly.
$ErrorActionPreference = 'Stop'

$Region   = 'africa-south1'
$Instance = 'mecard-db'
$DbName   = 'mecard'
$DbUser   = 'mecard'
$Repo     = 'mecard'
$Service  = 'mecard'
$AppDir   = Split-Path $PSScriptRoot -Parent

# Every secret the app reads. DATABASE_URL is made by 2-database.ps1, AUTH_SECRET and CRON_SECRET are generated.
$SecretNames = @(
  'DATABASE_URL', 'AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'RESEND_API_KEY',
  'PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE', 'BOBGO_API_KEY', 'RECAPTCHA_SECRET_KEY', 'CRON_SECRET'
)

function Get-Project([string]$Project) {
  if ($Project) { return $Project }
  $ErrorActionPreference = 'Continue'
  $p = gcloud config get-value project 2>$null
  if (-not $p) { throw 'No GCP project: pass -Project <id> or run: gcloud config set project <id>' }
  return "$p".Trim()
}

# Run gcloud and stop the script if it fails.
function Invoke-Gcloud {
  & gcloud @args
  if ($LASTEXITCODE -ne 0) { throw "gcloud $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

# True when a gcloud command succeeds (used for "does it exist yet?" checks).
function Test-Gcloud {
  $ErrorActionPreference = 'Continue'
  & gcloud @args *> $null
  return ($LASTEXITCODE -eq 0)
}

function New-RandomString([int]$Bytes = 32) {
  $b = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[+/=]', '')
}

# Create the secret, or add a new version if it exists. The value goes through a temp file
# (no trailing newline, never on the command line) that is deleted straight after.
function Set-Secret([string]$Name, [string]$Value) {
  $tmp = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($tmp, $Value)
    if (Test-Gcloud secrets describe $Name) {
      Invoke-Gcloud secrets versions add $Name "--data-file=$tmp"
    } else {
      Invoke-Gcloud secrets create $Name "--data-file=$tmp" --replication-policy=automatic
    }
  } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

function Get-ConnectionName([string]$Project) { return "${Project}:${Region}:${Instance}" }

# Image buckets (names are global, so they carry the project id):
# media = WebP masters made on first request; archive = every original upload.
function Get-MediaBucket([string]$Project) { return "$Project-media" }
function Get-ArchiveBucket([string]$Project) { return "$Project-uploads" }

function Write-Step([string]$Text) { Write-Host "`n==> $Text" -ForegroundColor Cyan }
