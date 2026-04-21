param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PlaywrightArgs
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $projectRoot)
$nodeRoot = Join-Path $workspaceRoot '.tools\node-v22.22.2-win-x64'
$npx = Join-Path $nodeRoot 'npx.cmd'

if (-not (Test-Path $npx)) {
    throw "Portable Node.js was not found at $nodeRoot"
}

$env:PATH = "$nodeRoot;$env:PATH"
& $npx playwright @PlaywrightArgs
