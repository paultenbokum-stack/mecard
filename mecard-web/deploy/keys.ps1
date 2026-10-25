# Every key MeCard needs, in one place. Shows which are set, asks for each missing one (typing
# is hidden), checks it with the service where that's quick, and saves it:
#   .\deploy\keys.ps1                 this laptop: .env.local (sandbox PayFast and Bob Go offered)
#   .\deploy\keys.ps1 -Cloud          Google Cloud: Secret Manager, for the deployed app
#   .\deploy\keys.ps1 -Update PAYFAST_PASSPHRASE,BOBGO_API_KEY    ask again for these even though set
#   .\deploy\keys.ps1 -Cloud -Test    the test deploy: PayFast and Bob Go SANDBOX keys, saved as TEST_<name>
# Safe to re-run: keys already set are left alone. AUTH_SECRET and CRON_SECRET are generated.
# Values never appear on screen, in files in git, or on a command line.
param([switch]$Cloud, [string[]]$Update = @(), [string]$Project, [switch]$NoCheck, [switch]$Test)
. "$PSScriptRoot\_common.ps1"
$EnvFile = Join-Path $AppDir '.env.local'

# name, what it is, where to get it; Shared = the same value works locally and in the cloud.
# On the laptop, PayFast and Bob Go take sandbox keys (their own test accounts).
$Keys = @(
  @{ Name = 'AUTH_SECRET'; Generate = $true; Help = 'signs logins (generated)' }
  @{ Name = 'CRON_SECRET'; Generate = $true; Help = 'lets the scheduler run the hourly job (generated)' }
  @{ Name = 'INSIGHTS_MCP_TOKEN'; Generate = $true; Help = 'bearer token for the read-only insights MCP endpoint, /api/mcp/ (generated)' }
  @{ Name = 'AUTH_GOOGLE_ID'; Shared = $true; Help = 'Google sign-in client ID: console.cloud.google.com > APIs & Services > Credentials (OAuth client, Web). Redirect URIs: https://mecard.co.za/api/auth/callback/google and http://localhost:3000/api/auth/callback/google' }
  @{ Name = 'AUTH_GOOGLE_SECRET'; Shared = $true; Help = 'Google sign-in client secret (same OAuth client)' }
  @{ Name = 'RESEND_API_KEY'; Shared = $true; Help = 'Resend API key (resend.com > API Keys). taggable.co.za must be verified in Resend while mail goes from Taggable. Locally, leave blank to see emails in Mailpit instead' }
  @{ Name = 'PAYFAST_MERCHANT_ID'; Help = 'PayFast merchant ID, Settings > Integration (laptop: a free sandbox account from sandbox.payfast.co.za; blank keeps the Simulate payment button)' }
  @{ Name = 'PAYFAST_MERCHANT_KEY'; Help = 'PayFast merchant key (same page)' }
  @{ Name = 'PAYFAST_PASSPHRASE'; Help = 'PayFast passphrase: must match Settings > Security in that PayFast account' }
  @{ Name = 'BOBGO_API_KEY'; Help = 'Bob Go API key (Bob Go > Settings > API; sandbox key from api.sandbox.bobgo.co.za for the laptop)' }
)

function Read-Env {
  $map = [ordered]@{}
  if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) { if ($line -match '^\s*([A-Z0-9_]+)\s*=(.*)$') { $map[$Matches[1]] = $Matches[2].Trim() } }
  }
  return $map
}
# Set NAME=value in .env.local, keeping every other line as it is.
function Write-EnvValue([string]$Name, [string]$Value) {
  $lines = if (Test-Path $EnvFile) { @(Get-Content $EnvFile) } else { @() }
  $found = $false
  $lines = $lines | ForEach-Object { if ($_ -match "^\s*$Name\s*=") { $found = $true; "$Name=$Value" } else { $_ } }
  if (-not $found) { $lines += "$Name=$Value" }
  [IO.File]::WriteAllLines($EnvFile, [string[]]$lines)
}
function Read-Hidden([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}


# ── Quick checks with each service. A failed check warns; it doesn't stop you saving. ─────────
function Test-Key([string]$Name, [hashtable]$All, [bool]$Sandbox) {
  if ($NoCheck) { return }
  $v = $All[$Name]
  try {
    switch ($Name) {
      'AUTH_GOOGLE_ID' { if ($v -notmatch '\.apps\.googleusercontent\.com$') { Write-Warning 'That does not look like a Google OAuth client ID (…apps.googleusercontent.com).' } else { Write-Host '  looks right' -ForegroundColor DarkGreen } }
      'RESEND_API_KEY' {
        $r = Invoke-RestMethod 'https://api.resend.com/domains' -Headers @{ Authorization = "Bearer $v" }
        $d = @($r.data) | Where-Object { $_.name -eq 'taggable.co.za' }
        if (-not $d) { Write-Warning 'Key works, but taggable.co.za is not added in Resend yet: emails from info@taggable.co.za will be refused.' }
        elseif ($d.status -ne 'verified') { Write-Warning "Key works; taggable.co.za is '$($d.status)' in Resend (needs verified)." }
        else { Write-Host '  Resend: key works, taggable.co.za verified' -ForegroundColor DarkGreen }
      }
      'PAYFAST_MERCHANT_ID' { if ($v -notmatch '^\d{8}$') { Write-Warning 'PayFast merchant IDs are 8 digits.' } else { Write-Host '  looks right' -ForegroundColor DarkGreen } }
      'PAYFAST_MERCHANT_KEY' { if ($v -notmatch '^[a-z0-9]{13}$') { Write-Warning 'PayFast merchant keys are 13 letters and digits.' } else { Write-Host '  looks right (PayFast confirms the key and passphrase on the first test payment)' -ForegroundColor DarkGreen } }
      'BOBGO_API_KEY' {
        $base = if ($Sandbox) { 'https://api.sandbox.bobgo.co.za/v2' } else { 'https://api.bobgo.co.za/v2' }
        try { Invoke-WebRequest "$base/orders?limit=1" -Headers @{ Authorization = "Bearer $v" } -UseBasicParsing | Out-Null; Write-Host '  Bob Go: key accepted' -ForegroundColor DarkGreen }
        catch { $code = [int]$_.Exception.Response.StatusCode; if ($code -in 401, 403) { Write-Warning "Bob Go refused the key ($code)." } else { Write-Host "  Bob Go: key accepted (HTTP $code)" -ForegroundColor DarkGreen } }
      }
    }
  } catch { Write-Warning "Couldn't confirm $Name with the service: $($_.Exception.Message)" }
}

# ── Where the values live ─────────────────────────────────────────────────────────────────────
$local = Read-Env
if ($Cloud) {
  $Project = Get-Project $Project
  if (-not (Test-Gcloud services list --enabled "--project=$Project" '--filter=config.name=secretmanager.googleapis.com' '--format=value(config.name)')) { throw "Secret Manager isn't on in $Project yet: run .\deploy\1-setup-project.ps1 first." }
  $cloudHas = @{}
  foreach ($k in $Keys) { if (-not $k.Plain) { $cloudHas[$k.Name] = Test-Gcloud secrets describe (Get-SecretName $k.Name $Test) "--project=$Project" } }
  Write-Step "Keys in Secret Manager ($Project)$(if ($Test) { ': test deploy, sandbox PayFast and Bob Go' })"
} else {
  Write-Step "Keys in $EnvFile"
}

$values = @{}
foreach ($k in $Keys) { $values[$k.Name] = $local[$k.Name] }
$sandbox = (-not $Cloud) -or $Test

foreach ($k in $Keys) {
  $n = $k.Name
  if ($Cloud -and $k.Plain) { continue }   # plain (non-secret) settings go in with the deploy, not Secret Manager
  $isSet = if ($Cloud) { $cloudHas[$n] } else { [bool]$local[$n] }
  $status = if ($isSet) { if ($k.Plain -and -not $Cloud) { "(set: $($local[$n]))" } else { '(set)' } } else { 'missing' }
  Write-Host ("{0,-32} {1}" -f (Get-SecretName $n ($Cloud -and $Test)), $status) -ForegroundColor $(if ($isSet) { 'Gray' } else { 'Yellow' })
  if ($isSet -and ($Update -notcontains $n)) { continue }

  $value = $null
  if ($k.Generate) {
    $value = New-RandomString 32
    Write-Host '  generated'
  } else {
    Write-Host "  $($k.Help)" -ForegroundColor DarkGray
    # The laptop's sandbox PayFast and Bob Go keys suit the test deploy too.
    $reusable = $k.Shared -or ($Test -and $SandboxSecretNames -contains $n)
    if ($Test -and $SandboxSecretNames -contains $n) { Write-Host '  SANDBOX key for the test deploy (sandbox.payfast.co.za / api.sandbox.bobgo.co.za), not the live one' -ForegroundColor Yellow }
    if ($Cloud -and $reusable -and $local[$n] -and ((Read-Host "  Use the value from .env.local? (Y/n)") -ne 'n')) { $value = $local[$n] }
    elseif ($k.Plain) { $value = (Read-Host "  $n (blank = skip)").Trim() }
    else { $value = (Read-Hidden "  $n (blank = skip)").Trim() }
  }
  if (-not $value) { Write-Host '  skipped' -ForegroundColor Yellow; continue }
  $values[$n] = $value

  Test-Key $n $values $sandbox

  if ($Cloud) { Set-Secret (Get-SecretName $n $Test) $value; Write-Host "  saved to Secret Manager as $(Get-SecretName $n $Test)" -ForegroundColor Green }
  else { Write-EnvValue $n $value; Write-Host '  saved to .env.local' -ForegroundColor Green }
  $value = $null
}

if (-not $Cloud) {
  # The laptop talks to PayFast's and Bob Go's sandboxes, never the live accounts.
  if ($values['PAYFAST_MERCHANT_ID']) { Write-EnvValue 'PAYFAST_SANDBOX' '1' }
  if ($values['BOBGO_API_KEY']) { Write-EnvValue 'BOBGO_SANDBOX' '1' }
  Write-Host "`nDone. Restart npm run dev:all to pick the keys up." -ForegroundColor Green
} else {
  Write-Step 'Letting Cloud Run read the secrets and connect to Cloud SQL'
  $number = "$(gcloud projects describe $Project --format='value(projectNumber)')".Trim()
  $sa = "serviceAccount:$number-compute@developer.gserviceaccount.com"
  foreach ($role in 'roles/secretmanager.secretAccessor', 'roles/cloudsql.client') {
    Invoke-Gcloud projects add-iam-policy-binding $Project "--member=$sa" "--role=$role" --condition=None --quiet --format=none
  }
  Write-Host "`nDone. Next: .\deploy\4-deploy.ps1$(if ($Test) { ' -Test' })" -ForegroundColor Green
}
