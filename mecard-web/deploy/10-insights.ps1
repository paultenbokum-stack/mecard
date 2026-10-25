# Step 10: the read-only insights MCP endpoint (docs/conversion-plan.md, section 4).
# Creates the claude_insights database role in Cloud SQL (it can read the insights views and
# nothing else), saves its connection as the INSIGHTS_DATABASE_URL secret, and makes the
# INSIGHTS_MCP_TOKEN bearer token. Run the migrations first (5-migrate-import.ps1 -MigrateOnly),
# then this, then 4-deploy.ps1. Safe to re-run: the role's password is kept once saved.
# Usage: powershell -ExecutionPolicy Bypass -File .\deploy\10-insights.ps1 [-Project <id>] [-Port 5440] [-NewToken]
param([string]$Project, [int]$Port = 5440, [switch]$NewToken)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
Invoke-Gcloud config set project $Project

if (-not (Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue)) {
  throw 'cloud-sql-proxy not found. Install it with: gcloud components install cloud-sql-proxy'
}

$cloudUrl = "$(gcloud secrets versions access latest --secret=DATABASE_URL "--project=$Project")"
if ($cloudUrl -notmatch '^postgresql://([^:]+):([^@]+)@/([^?]+)(\?.*)$') { throw 'DATABASE_URL secret is not in the expected format.' }
$adminUrl = "postgres://$($Matches[1]):$($Matches[2])@127.0.0.1:$Port/$($Matches[3])"
$dbName = $Matches[3]; $socketQuery = $Matches[4]

# Keep the existing password when the secret is already there, so re-runs change nothing.
$password = $null
if (Test-Gcloud secrets describe INSIGHTS_DATABASE_URL "--project=$Project") {
  $existing = "$(gcloud secrets versions access latest --secret=INSIGHTS_DATABASE_URL "--project=$Project")"
  if ($existing -match '^postgresql://claude_insights:([^@]+)@/') { $password = $Matches[1] }
}
$newPassword = -not $password
if ($newPassword) { $password = New-RandomString 24 }

Write-Step "Starting Cloud SQL Auth Proxy on 127.0.0.1:$Port"
$proxy = Start-Process cloud-sql-proxy -ArgumentList '--gcloud-auth', '--port', $Port, (Get-ConnectionName $Project) -PassThru -NoNewWindow
$oldUrl = $env:DATABASE_URL
Push-Location $AppDir
try {
  $ready = $false
  for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
    Start-Sleep -Seconds 1
    try { (New-Object Net.Sockets.TcpClient('127.0.0.1', $Port)).Close(); $ready = $true } catch {}
  }
  if (-not $ready) { throw 'The proxy did not start listening.' }

  Write-Step 'Creating the claude_insights role (npm run insights:role)'
  $env:DATABASE_URL = $adminUrl
  $env:INSIGHTS_DB_PASSWORD = $password
  npm run insights:role
  if ($LASTEXITCODE -ne 0) { throw 'Creating the role failed. Have the migrations run (5-migrate-import.ps1 -MigrateOnly)?' }
} finally {
  $env:DATABASE_URL = $oldUrl
  Remove-Item Env:INSIGHTS_DB_PASSWORD -ErrorAction SilentlyContinue
  Pop-Location
  if ($proxy -and -not $proxy.HasExited) { Stop-Process -Id $proxy.Id -Force }
  Write-Host 'Proxy stopped.'
}

Write-Step 'Secrets'
if ($newPassword) {
  Set-Secret INSIGHTS_DATABASE_URL "postgresql://claude_insights:${password}@/${dbName}${socketQuery}"
  Write-Host 'INSIGHTS_DATABASE_URL saved.' -ForegroundColor Green
} else { Write-Host 'INSIGHTS_DATABASE_URL already set; password unchanged.' }
$password = $null

if ($NewToken -or -not (Test-Gcloud secrets describe INSIGHTS_MCP_TOKEN "--project=$Project")) {
  Set-Secret INSIGHTS_MCP_TOKEN (New-RandomString 32)
  Write-Host 'INSIGHTS_MCP_TOKEN saved.' -ForegroundColor Green
} else { Write-Host 'INSIGHTS_MCP_TOKEN already set (-NewToken makes a new one).' }

Write-Host "`nNext: .\deploy\4-deploy.ps1 so the app picks the secrets up. Then, in Claude Code under the Taggable account:" -ForegroundColor Green
Write-Host '  $t = gcloud secrets versions access latest --secret=INSIGHTS_MCP_TOKEN' -ForegroundColor Green
Write-Host '  claude mcp add --transport http mecard-insights https://mecard.co.za/api/mcp/ --header "Authorization: Bearer $t"' -ForegroundColor Green
