# Step 6: put mecard.co.za (and www) in front of the Cloud Run service.
# Cloud Run's simple domain mapping isn't offered in africa-south1, so this builds a global
# external HTTPS load balancer: fixed IP, Google-managed certificate, http -> https redirect.
# Safe to re-run: existing pieces are skipped. Prints the IP to put in DNS.
# The certificate is only issued once DNS points at that IP (usually 15-60 minutes).
# Usage: .\deploy\6-domain.ps1 [-Project <id>] [-Domains mecard.co.za,www.mecard.co.za]
param([string]$Project, [string[]]$Domains)
. "$PSScriptRoot\_common.ps1"
if (-not $Domains) { $Domains = $SiteDomains }
$Project = Get-Project $Project
Invoke-Gcloud config set project $Project

$ip = 'mecard-ip'; $neg = 'mecard-neg'; $backend = 'mecard-backend'; $urlMap = 'mecard-urlmap'
$cert = 'mecard-cert'; $httpsProxy = 'mecard-https-proxy'; $redirectMap = 'mecard-http-redirect'; $httpProxy = 'mecard-http-proxy'

function Ensure([string]$What, [string[]]$Describe, [string[]]$Create) {
  Write-Step $What
  if (Test-Gcloud @Describe) { Write-Host 'Already exists.' } else { Invoke-Gcloud @Create }
}

Write-Step 'Enabling the Compute API'
Invoke-Gcloud services enable compute.googleapis.com

Ensure "Static IP $ip" @('compute', 'addresses', 'describe', $ip, '--global') `
  @('compute', 'addresses', 'create', $ip, '--global', '--ip-version=IPV4')

Ensure "Serverless endpoint group $neg -> Cloud Run '$Service'" @('compute', 'network-endpoint-groups', 'describe', $neg, "--region=$Region") `
  @('compute', 'network-endpoint-groups', 'create', $neg, "--region=$Region", '--network-endpoint-type=serverless', "--cloud-run-service=$Service")

Write-Step "Backend service $backend"
if (Test-Gcloud compute backend-services describe $backend --global) { Write-Host 'Already exists.' } else {
  Invoke-Gcloud compute backend-services create $backend --global --load-balancing-scheme=EXTERNAL_MANAGED
  Invoke-Gcloud compute backend-services add-backend $backend --global "--network-endpoint-group=$neg" "--network-endpoint-group-region=$Region"
}

Ensure "URL map $urlMap" @('compute', 'url-maps', 'describe', $urlMap, '--global') `
  @('compute', 'url-maps', 'create', $urlMap, "--default-service=$backend", '--global')

Ensure "Managed certificate $cert for $($Domains -join ', ')" @('compute', 'ssl-certificates', 'describe', $cert, '--global') `
  @('compute', 'ssl-certificates', 'create', $cert, "--domains=$($Domains -join ',')", '--global')

Ensure "HTTPS proxy $httpsProxy" @('compute', 'target-https-proxies', 'describe', $httpsProxy, '--global') `
  @('compute', 'target-https-proxies', 'create', $httpsProxy, "--url-map=$urlMap", "--ssl-certificates=$cert", '--global')

Ensure 'HTTPS forwarding rule (port 443)' @('compute', 'forwarding-rules', 'describe', 'mecard-https', '--global') `
  @('compute', 'forwarding-rules', 'create', 'mecard-https', '--global', '--load-balancing-scheme=EXTERNAL_MANAGED',
    "--address=$ip", "--target-https-proxy=$httpsProxy", '--ports=443')

Write-Step 'http -> https redirect'
if (Test-Gcloud compute url-maps describe $redirectMap --global) { Write-Host 'Already exists.' } else {
  $yaml = [IO.Path]::GetTempFileName()
  try {
    @(
      "name: $redirectMap"
      'defaultUrlRedirect:'
      '  httpsRedirect: true'
      '  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT'
    ) | Set-Content -Path $yaml -Encoding ascii
    Invoke-Gcloud compute url-maps import $redirectMap "--source=$yaml" --global --quiet
  } finally { Remove-Item $yaml -Force -ErrorAction SilentlyContinue }
}
Ensure "HTTP proxy $httpProxy" @('compute', 'target-http-proxies', 'describe', $httpProxy, '--global') `
  @('compute', 'target-http-proxies', 'create', $httpProxy, "--url-map=$redirectMap", '--global')
Ensure 'HTTP forwarding rule (port 80)' @('compute', 'forwarding-rules', 'describe', 'mecard-http', '--global') `
  @('compute', 'forwarding-rules', 'create', 'mecard-http', '--global', '--load-balancing-scheme=EXTERNAL_MANAGED',
    "--address=$ip", "--target-http-proxy=$httpProxy", '--ports=80')

$address = "$(gcloud compute addresses describe $ip --global --format='value(address)')".Trim()
$status = "$(gcloud compute ssl-certificates describe $cert --global --format='value(managed.status)')".Trim()
Write-Host "`nLoad balancer IP: $address" -ForegroundColor Green
Write-Host 'In xneelo DNS set:' -ForegroundColor Green
foreach ($d in $Domains) { Write-Host "  $d  A  $address" -ForegroundColor Green }
Write-Host '(remove any old A/AAAA/CNAME for those names; leave MX and mail records alone)'
Write-Host "Certificate status: $status  (ACTIVE about 15-60 min after DNS points here; check with:"
Write-Host "  gcloud compute ssl-certificates describe $cert --global --format='value(managed.status,managed.domainStatus)')"
