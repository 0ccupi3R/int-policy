param([Parameter(Mandatory=$true)][string]$SubscriptionId)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
# Requires Az modules and Python; no Azure CLI or Bicep compiler required for ARM path.
python3 tools/generate.py
if ($LASTEXITCODE -ne 0) { throw 'Generation failed; deployment stopped.' }
python3 tests/offline.py
if ($LASTEXITCODE -ne 0) { throw 'Offline tests failed; deployment stopped.' }
Connect-AzAccount
Set-AzContext -SubscriptionId $SubscriptionId
$Errors = Test-AzDeployment -Location canadacentral -TemplateFile ./generated/main.json -TemplateParameterFile ./generated/parameters.json -effect Audit -enforcementMode Default
if ($Errors) { $Errors | Format-List *; throw 'Azure validation failed; deployment stopped.' }
New-AzSubscriptionDeployment -Name naming-audit-v2 -Location canadacentral -TemplateFile ./generated/main.json -TemplateParameterFile ./generated/parameters.json -effect Audit -enforcementMode Default
