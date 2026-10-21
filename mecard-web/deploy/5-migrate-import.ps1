# Step 5: create/upgrade the tables in Cloud SQL, then (at cutover) import the live WordPress data.
# Needs cloud-sql-proxy on PATH (gcloud components install cloud-sql-proxy) and, for the import,
# the fresh WordPress export loaded into the local MySQL that WP_DATABASE_URL in .env.local points at.
# The import WIPES the cloud database and refills it, so it asks you to type IMPORT first.
# Usage: .\deploy\5-migrate-import.ps1 [-Project <id>] [-MigrateOnly] [-Port 5440]
param([string]$Project, [switch]$MigrateOnly, [int]$Port = 5440)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project

if (-not (Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue)) {
  throw 'cloud-sql-proxy not found. Install it with: gcloud components install cloud-sql-proxy'
}

# Reuse the password from the DATABASE_URL secret, pointed at the local proxy port.
$cloudUrl = "$(gcloud secrets versions access latest --secret=DATABASE_URL "--project=$Project")"
if ($cloudUrl -notmatch '^postgresql://([^:]+):([^@]+)@/([^?]+)') { throw 'DATABASE_URL secret is not in the expected format.' }
$localUrl = "postgres://$($Matches[1]):$($Matches[2])@127.0.0.1:$Port/$($Matches[3])"

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

  # Set for these commands only; .env.local's DATABASE_URL does not override it.
  $env:DATABASE_URL = $localUrl

  Write-Step 'Running migrations (npm run db:migrate)'
  npm run db:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migrations failed.' }

  if (-not $MigrateOnly) {
    Write-Host "`nThe import WIPES the Cloud SQL database and refills it from your local WordPress export." -ForegroundColor Yellow
    Write-Host 'Put WordPress in maintenance mode and load a fresh export first.' -ForegroundColor Yellow
    if ((Read-Host 'Type IMPORT to continue') -ceq 'IMPORT') {
      Write-Step 'Importing WordPress data (npm run import:wp)'
      npm run import:wp
      if ($LASTEXITCODE -ne 0) { throw 'Import failed.' }
      # Baskets aren't imported: cards still "in a basket" in WordPress are abandoned.
      Write-Step 'Archiving abandoned basket cards (npm run cards:archive-abandoned)'
      npm run cards:archive-abandoned
      if ($LASTEXITCODE -ne 0) { throw 'Archiving abandoned cards failed.' }
      Write-Host 'Check the counts above against WordPress: users, profiles, companies, cards, orders, quotes, coupons.' -ForegroundColor Green
    } else { Write-Host 'Import skipped.' }
  }
} finally {
  $env:DATABASE_URL = $oldUrl
  Pop-Location
  if ($proxy -and -not $proxy.HasExited) { Stop-Process -Id $proxy.Id -Force }
  Write-Host 'Proxy stopped.'
}
