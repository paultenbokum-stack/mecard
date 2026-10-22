# Copy the live site's wp-content/uploads from Xneelo to this laptop over SFTP, with rclone.
# The first run copies everything; every later run copies only new or changed files (a delta),
# so run it again close to cutover and once more right before the DNS switch. It never deletes
# anything on either side, and it skips the folders holding customer data rather than images
# (CSV exports, invoices, quote PDFs, logs, private downloads).
# Usage: .\deploy\pull-uploads.ps1 [-DryRun] [-User <ftp user>] [-Dest C:\mecard-cutover\uploads]
param([switch]$DryRun, [string]$User, [string]$Dest)
. "$PSScriptRoot\_common.ps1"
if (-not $User) { $User = $XneeloUser }
if (-not $Dest) { $Dest = $UploadsCopy }

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
  Write-Step 'rclone (copies over SFTP, only what changed) is not installed.'
  if ((Read-Host 'Install it now with winget? (Y/n)') -eq 'n') { throw 'rclone is needed: winget install Rclone.Rclone' }
  winget install --id Rclone.Rclone --exact
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) { throw 'rclone installed: open a new PowerShell window and run this again.' }
}

if (-not $User) { $User = (Read-Host "Xneelo FTP/SFTP user for $XneeloHost").Trim() }
$secure = Read-Host "Password for $User (hidden)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
# rclone wants the password obscured; it goes through the environment, never the command line.
$env:RCLONE_SFTP_PASS = ($plain | rclone obscure -)
$plain = $null
$env:RCLONE_SFTP_HOST = $XneeloHost
$env:RCLONE_SFTP_USER = $User

New-Item -ItemType Directory -Force $Dest | Out-Null
$copy = @('copy', ":sftp:$XneeloUploadsPath", $Dest, '--transfers=8', '--checkers=16', '--progress', '--stats-one-line',
  '--exclude=woocommerce_uploads/**', '--exclude=wpo_wcpdf_*/**', '--exclude=yith_ywraq/**', '--exclude=wc-logs/**',
  '--exclude=views-import-temp/**', '--exclude=cache/**', '--exclude=*.{zip,csv,pdf,log,sql,gz}')
if ($DryRun) { $copy += '--dry-run' }
Write-Step "Copying $($XneeloHost):$XneeloUploadsPath to $Dest$(if ($DryRun) { ' (dry run)' })"
try {
  & rclone @copy
  if ($LASTEXITCODE -ne 0) { throw "rclone failed (exit $LASTEXITCODE). Check the user, password and that SFTP is on in konsoleH." }
} finally {
  Remove-Item Env:RCLONE_SFTP_PASS, Env:RCLONE_SFTP_HOST, Env:RCLONE_SFTP_USER -ErrorAction SilentlyContinue
}
$files = Get-ChildItem $Dest -Recurse -File | Measure-Object -Property Length -Sum
Write-Host ("`n{0} files, {1:N0} MB in {2}." -f $files.Count, ($files.Sum / 1MB), $Dest) -ForegroundColor Green
Write-Host "Next: npm run images:plan -- --source `"$Dest`"" -ForegroundColor Green
