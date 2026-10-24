# Step 9 (at cutover, after a fresh copy of the live site's wp-content/uploads is on this laptop):
# upload the original images to the archive bucket. The app makes the WebP versions itself.
#   1. npm run images:plan -- --source <live uploads copy> --stage <new empty folder>
#      (checks every image the data refers to and lays out only what should go up)
#   2. .\deploy\9-images.ps1 -Stage <that folder> -DryRun   (lists what would be copied)
#   3. .\deploy\9-images.ps1 -Stage <that folder>
# rsync only copies what is new or changed, so it is safe to re-run (e.g. a last top-up at
# cutover). It never deletes from the bucket.
# Usage: .\deploy\9-images.ps1 -Stage <folder> [-Project <id>] [-DryRun]
param([Parameter(Mandatory = $true)][string]$Stage, [string]$Project, [switch]$DryRun)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
if (-not (Test-Path $Stage)) { throw "No folder $Stage. Run npm run images:plan with --stage first." }
$bucket = "gs://$(Get-ArchiveBucket $Project)"
if (-not (Test-Gcloud storage buckets describe $bucket "--project=$Project")) { throw "Bucket $bucket is missing: run .\deploy\1-setup-project.ps1 first." }

$files = (Get-ChildItem -Path $Stage -Recurse -File | Measure-Object -Property Length -Sum)
Write-Step ("Uploading {0} files ({1:N0} MB) from {2} to {3}" -f $files.Count, ($files.Sum / 1MB), $Stage, $bucket)
$rsync = @('storage', 'rsync', $Stage, $bucket, '--recursive', "--project=$Project")
if ($DryRun) { $rsync += '--dry-run' }
Invoke-Gcloud @rsync
if ($DryRun) { Write-Host "`nDry run: nothing copied." -ForegroundColor Yellow }
else { Write-Host "`nDone. Images are served from the bucket from the next request on." -ForegroundColor Green }
