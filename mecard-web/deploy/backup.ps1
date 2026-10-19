# Take a manual Cloud SQL backup (go-live checklist, and before any risky change).
# Usage: .\deploy\backup.ps1 [-Project <id>]
param([string]$Project)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
Write-Step "Backing up $Instance"
Invoke-Gcloud sql backups create "--instance=$Instance" "--project=$Project" "--description=manual $(Get-Date -Format s)"
Invoke-Gcloud sql backups list "--instance=$Instance" "--project=$Project" --limit=5
