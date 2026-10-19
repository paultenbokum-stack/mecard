# Step 1: select the (already created) project, enable the APIs, create the image registry.
# Usage: .\deploy\1-setup-project.ps1 -Project <project-id>
param([string]$Project)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project

Write-Step "Using project $Project"
Invoke-Gcloud config set project $Project

Write-Step 'Enabling APIs (Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, Cloud Build)'
Invoke-Gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com

Write-Step "Docker repository '$Repo' in $Region"
if (Test-Gcloud artifacts repositories describe $Repo "--location=$Region") {
  Write-Host 'Already exists.'
} else {
  Invoke-Gcloud artifacts repositories create $Repo --repository-format=docker "--location=$Region"
}

Write-Host "`nDone. Next: .\deploy\2-database.ps1" -ForegroundColor Green
