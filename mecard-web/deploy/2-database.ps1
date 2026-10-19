# Step 2: Cloud SQL Postgres 16 instance, the mecard database and user, and the DATABASE_URL secret.
# The user's password is generated here and only ever stored in Secret Manager.
# Creating the instance takes about 10 minutes. Safe to re-run: existing pieces are skipped.
# Usage: .\deploy\2-database.ps1 [-Project <project-id>]
param([string]$Project)
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
$conn = Get-ConnectionName $Project
Invoke-Gcloud config set project $Project

Write-Step "Cloud SQL instance $Instance (Postgres 16, db-f1-micro, $Region)"
if (Test-Gcloud sql instances describe $Instance "--project=$Project") {
  Write-Host 'Already exists.'
} else {
  Invoke-Gcloud sql instances create $Instance "--project=$Project" --database-version=POSTGRES_16 "--region=$Region" `
    --tier=db-f1-micro --edition=ENTERPRISE --storage-size=10 --backup-start-time=01:00 --enable-point-in-time-recovery
}

Write-Step "Database '$DbName'"
if (Test-Gcloud sql databases describe $DbName "--instance=$Instance" "--project=$Project") {
  Write-Host 'Already exists.'
} else {
  Invoke-Gcloud sql databases create $DbName "--instance=$Instance" "--project=$Project"
}

Write-Step "User '$DbUser' and the DATABASE_URL secret"
if (Test-Gcloud secrets describe DATABASE_URL "--project=$Project") {
  Write-Host 'DATABASE_URL secret already exists; leaving the password as it is.'
} else {
  $password = New-RandomString 24
  $users = @(gcloud sql users list "--instance=$Instance" "--project=$Project" --format='value(name)')
  if ($users -contains $DbUser) {
    Invoke-Gcloud sql users set-password $DbUser "--instance=$Instance" "--project=$Project" "--password=$password"
  } else {
    Invoke-Gcloud sql users create $DbUser "--instance=$Instance" "--project=$Project" "--password=$password"
  }
  Set-Secret DATABASE_URL "postgresql://${DbUser}:${password}@/${DbName}?host=/cloudsql/$conn"
  Write-Host 'Password generated and saved in the DATABASE_URL secret.'
}

Write-Host "`nConnection name: $conn" -ForegroundColor Green
Write-Host 'Next: .\deploy\3-secrets.ps1' -ForegroundColor Green
