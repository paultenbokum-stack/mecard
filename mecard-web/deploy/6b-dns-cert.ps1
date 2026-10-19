# Step 6b (optional): a certificate proven through DNS instead of through the load balancer.
# 6-domain.ps1's certificate is only issued after mecard.co.za already points at the load balancer,
# so https is down for a while. This one is issued from two CNAME records, whatever the A
# records point at, so it can be ready before the switch (or speed things up after it).
# Run it once: it creates everything and prints the CNAME records to add at xneelo.
# Run it again after adding them: once the certificate is ACTIVE it attaches it to the load balancer.
# Usage: .\deploy\6b-dns-cert.ps1 [-Project <id>]
param([string]$Project, [string[]]$Domains = @('mecard.co.za', 'www.mecard.co.za'))
. "$PSScriptRoot\_common.ps1"
$Project = Get-Project $Project
Invoke-Gcloud config set project $Project

$cert = 'mecard-dns-cert'; $map = 'mecard-map'; $httpsProxy = 'mecard-https-proxy'
$auths = $Domains | ForEach-Object { 'auth-' + ($_ -replace '\.', '-') }

Write-Step 'Enabling the Certificate Manager API'
Invoke-Gcloud services enable certificatemanager.googleapis.com

for ($i = 0; $i -lt $Domains.Count; $i++) {
  Write-Step "DNS authorization for $($Domains[$i])"
  if (Test-Gcloud certificate-manager dns-authorizations describe $auths[$i]) { Write-Host 'Already exists.' }
  else { Invoke-Gcloud certificate-manager dns-authorizations create $auths[$i] "--domain=$($Domains[$i])" }
}

Write-Step "Certificate $cert"
if (Test-Gcloud certificate-manager certificates describe $cert) { Write-Host 'Already exists.' }
else { Invoke-Gcloud certificate-manager certificates create $cert "--domains=$($Domains -join ',')" "--dns-authorizations=$($auths -join ',')" }

Write-Step "Certificate map $map"
if (Test-Gcloud certificate-manager maps describe $map) { Write-Host 'Already exists.' }
else { Invoke-Gcloud certificate-manager maps create $map }
foreach ($d in $Domains) {
  $entry = 'entry-' + ($d -replace '\.', '-')
  if (-not (Test-Gcloud certificate-manager maps entries describe $entry "--map=$map")) {
    Invoke-Gcloud certificate-manager maps entries create $entry "--map=$map" "--hostname=$d" "--certificates=$cert"
  }
}

Write-Host "`nAdd these CNAME records in xneelo DNS (leave everything else as it is):" -ForegroundColor Green
foreach ($a in $auths) {
  $rec = "$(gcloud certificate-manager dns-authorizations describe $a --format='value(dnsResourceRecord.name,dnsResourceRecord.data)')".Trim() -split '\s+'
  Write-Host "  $($rec[0])  CNAME  $($rec[1])" -ForegroundColor Green
}

$state = "$(gcloud certificate-manager certificates describe $cert --format='value(managed.state)')".Trim()
Write-Host "`nCertificate state: $state"
if ($state -eq 'ACTIVE') {
  Write-Step "Attaching $map to $httpsProxy"
  Invoke-Gcloud compute target-https-proxies update $httpsProxy --global "--certificate-map=$map"
  Write-Host 'Done: the load balancer now serves this certificate (allow a few minutes).' -ForegroundColor Green
} else {
  Write-Host 'Not ACTIVE yet (usually a few minutes after the CNAMEs resolve). Run this script again to attach it.' -ForegroundColor Yellow
}
