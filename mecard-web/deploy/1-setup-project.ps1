# Step 1: select the (already created) project, enable the APIs, create the image registry
# and the two image buckets (private; Cloud Run reads and writes them).
# Usage: .\deploy\1-setup-project.ps1 -Project <project-id>
param([string]$Project)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project

Write-Step "Using project $Project"
Invoke-Gcloud config set project $Project

# Billing: linked to the account in config.ps1 (Taggable), after you say yes. Nothing that costs
# money exists until the steps after this one create it.
$billing = "$(gcloud billing projects describe $Project --format='value(billingEnabled)')".Trim()
if ($billing -ne 'True') {
  Write-Step "Billing is not linked. Link $Project to billing account $BillingAccount?"
  if ((Read-Host 'Type LINK to link it now') -cne 'LINK') { throw 'Billing not linked: nothing else was changed.' }
  Invoke-Gcloud billing projects link $Project "--billing-account=$BillingAccount"
}

Write-Step 'Enabling APIs (Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, Cloud Build)'
Invoke-Gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com storage.googleapis.com

Write-Step "Docker repository '$Repo' in $Region"
if (Test-Gcloud artifacts repositories describe $Repo "--location=$Region") {
  Write-Host 'Already exists.'
} else {
  Invoke-Gcloud artifacts repositories create $Repo --repository-format=docker "--location=$Region"
}

$number = "$(gcloud projects describe $Project --format='value(projectNumber)')".Trim()
$sa = "serviceAccount:$number-compute@developer.gserviceaccount.com"
# Archive class for the originals: cheapest to keep, read once per image when its master is made.
foreach ($b in @(@{ Name = (Get-MediaBucket $Project); Class = 'STANDARD' }, @{ Name = (Get-ArchiveBucket $Project); Class = 'ARCHIVE' })) {
  Write-Step "Bucket gs://$($b.Name) ($($b.Class), $Region)"
  if (Test-Gcloud storage buckets describe "gs://$($b.Name)") { Write-Host 'Already exists.' }
  else {
    Invoke-Gcloud storage buckets create "gs://$($b.Name)" "--location=$Region" "--default-storage-class=$($b.Class)" `
      --uniform-bucket-level-access --public-access-prevention
  }
  Invoke-Gcloud storage buckets add-iam-policy-binding "gs://$($b.Name)" "--member=$sa" --role=roles/storage.objectAdmin --format=none
}

Write-Host "`nDone. Next: .\deploy\2-database.ps1" -ForegroundColor Green
