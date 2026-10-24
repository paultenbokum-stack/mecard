# Send all traffic back to an earlier Cloud Run revision (for a bad deploy; DNS rollback is separate).
# With no -Revision it picks the one before the newest.
# Usage: .\deploy\rollback.ps1 [-Project <id>] [-Revision mecard-00003-abc]
param([string]$Project, [string]$Revision)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project

$revs = @(gcloud run revisions list "--service=$Service" "--region=$Region" "--project=$Project" `
  --sort-by='~metadata.creationTimestamp' --format='value(metadata.name)')
Write-Host 'Revisions, newest first:'; $revs | ForEach-Object { Write-Host "  $_" }
if (-not $Revision) {
  if ($revs.Count -lt 2) { throw 'There is no earlier revision to roll back to.' }
  $Revision = $revs[1]
}
Write-Step "Routing 100% of traffic to $Revision"
Invoke-Gcloud run services update-traffic $Service "--to-revisions=$Revision=100" "--region=$Region" "--project=$Project"
Write-Host 'New deploys stay pinned to this revision until you run: gcloud run services update-traffic mecard --to-latest --region=africa-south1' -ForegroundColor Yellow
