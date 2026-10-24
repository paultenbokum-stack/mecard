# Step 3: the app's keys into Secret Manager. All the work is in keys.ps1 (which also does
# .env.local for the laptop); this step is the same as: .\deploy\keys.ps1 -Cloud
# Usage: .\deploy\3-secrets.ps1 [-Project <project-id>] [-Update NAME,NAME]
param([string]$Project, [string[]]$Update = @())
& "$PSScriptRoot\keys.ps1" -Cloud -Project $Project -Update $Update
