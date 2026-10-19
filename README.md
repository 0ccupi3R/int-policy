# CustomerName naming policies v2.1

Clean replacement package using CustomerName/cust01 test values. It contains 25 existing type-specific naming definitions plus one integrated subnet definition, one initiative, and one subscription assignment.

## Safety defaults
- Existing rules: Audit
- Subnet rule: Audit
- Assignment enforcementMode: Default

Audit reports non-compliance but does not block requests. To enforce Deny after review, pass `effect=Deny`. Keep `subnetEffect=Audit` until inline and standalone subnet behavior has been tested in Azure.

## Structure
Only these maintained inputs should be edited:
- `config/customer.json`: customer tokens, effect values, subnet allowlist.
- `config/types.json`: normal type catalogue.
- `tools/generate.py`: generator logic.
- `tests/offline.py` and `tests/regression.py`: validation.

Never manually edit `generated/*`. Regenerate it.

## Generate and test
```bash
chmod u+w . config generated tests tools
python3 tools/generate.py && python3 tests/offline.py
python3 tests/regression.py
```
Generation removes prior output first. Tests compare hashes and reject stale or modified output.

## Subnet naming
The integrated subnet policy has reference ID `subnet`. It checks:
1. standalone `Microsoft.Network/virtualNetworks/subnets` requests; and
2. subnet names submitted inside a `Microsoft.Network/virtualNetworks` request.

Allowed names are maintained at `config/customer.json -> subnetNaming.allowedNames`. The supplied names are sample/proposed values plus required Azure service subnet names. Review the list before Deny.

Subnet is not automatically added to the existing VM/NIC/PIP exemption. Add reference ID `subnet` only if the approved waiver genuinely includes subnet naming.

## Azure CLI validation and deployment
```bash
SUBSCRIPTION_ID="YOUR-SUBSCRIPTION-ID"
az account set --subscription "$SUBSCRIPTION_ID"

az deployment sub validate \
  --subscription "$SUBSCRIPTION_ID" \
  --location canadacentral \
  --template-file generated/main.json \
  --parameters @generated/parameters.json \
  effect=Audit subnetEffect=Audit enforcementMode=Default
```

Deploy only after validation succeeds:
```bash
az deployment sub create \
  --subscription "$SUBSCRIPTION_ID" \
  --name cust01-naming-v2-1 \
  --location canadacentral \
  --template-file generated/main.json \
  --parameters @generated/parameters.json \
  effect=Audit subnetEffect=Audit enforcementMode=Default
```

For existing rules in Deny while subnet remains Audit:
```bash
az deployment sub create \
  --subscription "$SUBSCRIPTION_ID" \
  --name cust01-naming-v2-1 \
  --location canadacentral \
  --template-file generated/main.json \
  --parameters @generated/parameters.json \
  effect=Deny subnetEffect=Audit enforcementMode=Default
```

## Verify
```bash
SCOPE="/subscriptions/$SUBSCRIPTION_ID"
az policy assignment show \
  --name cust01-naming-test \
  --scope "$SCOPE" \
  --query "{Effect:parameters.effect.value,SubnetEffect:parameters.subnetEffect.value,Enforcement:enforcementMode}" \
  --output json
```

## Existing exemption
The package doesn't delete or replace exemptions. Your existing RG exemption for references `vm`, `nic`, and `pip` remains an Azure child resource. It is not stored in this generic customer-neutral package.

## Limits
Unknown types are unaffected. ENV is excluded. Subnet uses an explicit allowlist rather than a generated `{purpose}` pattern. Disk naming isn't covered. The VM portal still requires networking; subnet policy does not create a VNet or subnet. VM SKU/capacity errors are unrelated to naming policy. Global name availability and all provider-specific reserved-name conditions aren't checked locally.

## Validation status
Local generator, condition-tree tests, stale-output tests, configuration regression tests, and package structure checks were executed during creation. Azure Resource Manager validation, Azure Policy engine behavior, PowerShell execution, and Bicep compilation must be performed in your environment.

## Microsoft references
- Azure Policy rule structure: https://learn.microsoft.com/en-us/azure/governance/policy/concepts/definition-structure-policy-rule
- Array policy authoring: https://learn.microsoft.com/en-us/azure/governance/policy/how-to/author-policies-for-arrays
- Azure Policy exemptions: https://learn.microsoft.com/en-us/azure/governance/policy/concepts/exemption-structure
- Azure resource name restrictions: https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules
