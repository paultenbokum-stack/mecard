# Step 7 (one time): let GitHub Actions deploy on every push to master that touches mecard-web.
# Creates a deploy service account and a Workload Identity Federation pool/provider that only
# trusts GitHub Actions runs from paultenbokum-stack/mecard. No keys are created and nothing has
# to be added in GitHub: .github/workflows/deploy.yml already names the provider and account.
# Safe to re-run: existing pieces are skipped.
# Usage: .\deploy\7-github-actions.ps1 [-Project <id>] [-Repo paultenbokum-stack/mecard]
param([string]$Project, [string]$GitHubRepo = 'paultenbokum-stack/mecard')
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
Invoke-Gcloud config set project $Project

$sa = "mecard-deployer@$Project.iam.gserviceaccount.com"
$pool = 'github'; $provider = 'github'
$number = "$(gcloud projects describe $Project --format='value(projectNumber)')".Trim()

Write-Step 'Enabling IAM / token APIs'
Invoke-Gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

Write-Step "Service account $sa"
if (Test-Gcloud iam service-accounts describe $sa) { Write-Host 'Already exists.' }
else { Invoke-Gcloud iam service-accounts create mecard-deployer --display-name='GitHub Actions deploy' }

Write-Step 'Roles: deploy Cloud Run, push images, run migrations, read secrets'
foreach ($role in 'roles/run.admin', 'roles/artifactregistry.writer', 'roles/cloudsql.client', 'roles/secretmanager.secretAccessor') {
  Invoke-Gcloud projects add-iam-policy-binding $Project "--member=serviceAccount:$sa" "--role=$role" --condition=None --quiet --format=none
}
# Cloud Run runs as the default compute account; the deployer must be allowed to "act as" it.
Invoke-Gcloud iam service-accounts add-iam-policy-binding "$number-compute@developer.gserviceaccount.com" `
  "--member=serviceAccount:$sa" --role=roles/iam.serviceAccountUser --quiet --format=none

Write-Step "Workload identity pool '$pool'"
if (Test-Gcloud iam workload-identity-pools describe $pool --location=global) { Write-Host 'Already exists.' }
else { Invoke-Gcloud iam workload-identity-pools create $pool --location=global --display-name='GitHub Actions' }

Write-Step "GitHub OIDC provider '$provider' (only $GitHubRepo)"
if (Test-Gcloud iam workload-identity-pools providers describe $provider --location=global "--workload-identity-pool=$pool") {
  Write-Host 'Already exists.'
} else {
  # Flags go through a YAML file so the condition's quotes survive gcloud.cmd.
  $flags = [IO.Path]::GetTempFileName() + '.yaml'
  try {
    @(
      '--location: global'
      "--workload-identity-pool: $pool"
      '--display-name: GitHub'
      '--issuer-uri: https://token.actions.githubusercontent.com'
      '--attribute-mapping: google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref'
      "--attribute-condition: assertion.repository == '$GitHubRepo'"
    ) | Set-Content -Path $flags -Encoding ascii
    Invoke-Gcloud iam workload-identity-pools providers create-oidc $provider "--flags-file=$flags"
  } finally { Remove-Item $flags -Force -ErrorAction SilentlyContinue }
}

Write-Step "Letting $GitHubRepo use $sa"
Invoke-Gcloud iam service-accounts add-iam-policy-binding $sa --role=roles/iam.workloadIdentityUser `
  "--member=principalSet://iam.googleapis.com/projects/$number/locations/global/workloadIdentityPools/$pool/attribute.repository/$GitHubRepo" `
  --quiet --format=none

Write-Host "`nDone. Pushes to master now deploy automatically (GitHub > Actions shows each run)." -ForegroundColor Green
Write-Host "Provider: projects/$number/locations/global/workloadIdentityPools/$pool/providers/$provider"
Write-Host "Account:  $sa"
