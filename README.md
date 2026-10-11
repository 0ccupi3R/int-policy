# CustomerName naming policies v2

This is a complete replacement package, not a search-and-replace patch. Default organization is cust01; displayName is CustomerName; policyPrefix is cust01-naming. Change those values only in config/customer.json. Do not replace strings throughout source files. Source labels still identify AirGate documentation and Microsoft CAF as provenance, not customer identity.

## Fixes
- Key Vault uses its own purpose list: core and apps. With cust01/con/cc these generate 21-character names. General monitoring purpose is not silently shortened or removed from other types.
- Failure invalidates generated outputs; tests require matching config, generator, type-catalog and artifact hashes. No stale pass after a failed generation.
- Tests derive prefixes, subscription codes and roles from config, not hard-coded names.
- Literal allOf/anyOf/not conditions replace runtime count/current expressions. Only effect remains a Policy expression; it is escaped for ARM deployment.
- Audit and Default are the shipped settings. No automatic Deny activation script is included.
- ARM JSON is generated directly; it is not claimed to be Bicep compiler output. This permits deployment without Bicep CLI. Bicep wrapper is included separately.

## Run locally
From the extracted folder:
```
python3 tools/generate.py && python3 tests/offline.py
python3 tests/regression.py
```
After configuration changes, regenerate before any deployment. Do not deploy old main.json files from the prior package. The generator checks a selected set of type-specific name length limits, plus compact storage/registry and Key Vault characters. It does not validate global name availability, reserved names, every provider constraint or guest VM computerName.

## PowerShell deployment, no Azure CLI/Bicep compiler
Install/import Az modules using your approved process, then:
```
./Deploy-Audit.ps1 -SubscriptionId YOUR-SUBSCRIPTION-ID
```
The script requires Python under python3, signs in, sets context, runs local generation/tests, validates the generated ARM template, and deploys with explicit Audit/Default overrides. If Python is installed under python on Windows, replace python3 with python in this script only. PowerShell was not available for execution here; cmdlet calls require validation in your environment.

Manual equivalent after successful local generation/tests:
```
Connect-AzAccount
Set-AzContext -SubscriptionId YOUR-SUBSCRIPTION-ID
Test-AzDeployment -Location canadacentral -TemplateFile ./generated/main.json -TemplateParameterFile ./generated/parameters.json -effect Audit -enforcementMode Default
New-AzSubscriptionDeployment -Name naming-audit-v2 -Location canadacentral -TemplateFile ./generated/main.json -TemplateParameterFile ./generated/parameters.json -effect Audit -enforcementMode Default
```
Stop if validation returns errors. Policy assignment name is cust01-naming-test by default. Use Get-AzPolicyAssignment with this name and subscription scope. Use Start-AzPolicyComplianceScan and Get-AzPolicyState to inspect compliance. Microsoft.PolicyInsights must be registered for compliance reporting. Permissions must cover policy definitions, initiatives, assignments and deployments.

## Azure CLI / Cloud Shell Bash alternative
```
python3 tools/generate.py && python3 tests/offline.py
az account set --subscription YOUR-SUBSCRIPTION-ID
az deployment sub validate --location canadacentral --template-file generated/main.json --parameters @generated/parameters.json effect=Audit enforcementMode=Default
az deployment sub create --name naming-audit-v2 --location canadacentral --template-file generated/main.json --parameters @generated/parameters.json effect=Audit enforcementMode=Default
```
Stop on validation failure. The JSON path does not require Bicep compilation. For Bicep path compile main.bicep using your installed Bicep compiler and validate it before deployment.

## Migration warning
New cust01-prefixed policies do NOT replace or disable previously deployed aig-prefixed policies. Review existing assignments in the subscription. If an old Deny assignment exists it can still block requests. No old assignments are deleted by this package. Resource names themselves are not renamed.

## Coverage and unresolved decisions
25 selected resource types, one initiative, one subscription assignment. Unknown resource types are unaffected. One subscription code is fixed per generated package. Regions cc/ce bind to actual resource location. Purpose values are controlled lists. VM 01-99 uses ## and explicit 00 exclusion. Case-insensitive matching is deliberate. ENV is excluded. Compact VM/dashless exception is deferred. Subnets, peering, DNS, ARO, local gateway typo, management groups and subscription display names are not enforced. Gateway suffix is not tied to gatewayType, and LB i/e is not tied to frontend IP configuration. Platform-generated names may appear non-compliant; review exclusions before any Deny change. All non-core full patterns are proposals, not universal AirGate/Microsoft rules. Storage prd/prda semantics remain unresolved.

## Validation honesty
Python generation, local condition-tree tests, regression tests and JSON structure checks were run. No Azure account connection, Azure Policy engine test, ARM service validation, PowerShell execution or Bicep compilation was possible here. Do not interpret local passed tests as cloud deployment certification. See generated/validation.json.

## Sources
Microsoft Policy operators: https://learn.microsoft.com/en-us/azure/governance/policy/concepts/definition-structure-policy-rule
Provider restrictions: https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules
Audit: https://learn.microsoft.com/en-us/azure/governance/policy/concepts/effect-audit
PowerShell deployment: https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-powershell

## Cleanup
Remove/disable the assignment before deleting the initiative and definitions. Removing deployment history does not remove policies. No workload test resources are automatically created or deleted.
