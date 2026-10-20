param([Parameter(Mandatory=$true)][string]$SubscriptionId)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$Python = if (Get-Command python3 -ErrorAction SilentlyContinue) { 'python3' } elseif (Get-Command python -ErrorAction SilentlyContinue) { 'python' } else { throw 'Python was not found.' }
& $Python tools/generate.py
if ($LASTEXITCODE -ne 0) { throw 'Generation failed; deployment stopped.' }
& $Python tests/offline.py
if ($LASTEXITCODE -ne 0) { throw 'Offline tests failed; deployment stopped.' }

Connect-AzAccount
Set-AzContext -SubscriptionId $SubscriptionId
$Errors = Test-AzDeployment -Location canadacentral -TemplateFile ./generated/main.json -TemplateParameterFile ./generated/parameters.json -effect Audit -subnetEffect Audit -enforcementMode Default
if ($Errors) { $Errors | Format-List *; throw 'Azure validation failed; deployment stopped.' }
New-AzSubscriptionDeployment -Name contoso-naming-v2-1 -Location canadacentral -TemplateFile ./generated/main.json -TemplateParameterFile ./generated/parameters.json -effect Audit -subnetEffect Audit -enforcementMode Default
