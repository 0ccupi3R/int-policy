// Deployment Scripts and In-Browser Bundle Exporter

import JSZip from "jszip";
import { generateBicep } from "./bicepGenerator.js";
import { generateArmTemplate } from "./armGenerator.js";
import {
  generateBicepParameters,
  generateArmParameters,
  generateCompanionResourcesBicep,
  getBaselineTopology,
  evaluateRgNode,
  evaluateResourceNode
} from "./topologyGenerator.js";

export function generateDeployPs1(customer) {
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = customer.subscriptionCode || "CON";
  const prefix = `${orgAbbr.toLowerCase()}-${subCode.toLowerCase()}`;
  const version = customer.version || "1.0.0";
  const defaultRegion = customer.defaultRegion || Object.keys(customer.regions || {})[0] || "canadacentral";

  return `# ==============================================================================
# Azure Landing Zone Policy Deployment Script (PowerShell)
# Customer: ${customer.name} | Subscription: ${customer.subscriptionName} (${subCode})
# Version: ${version}
# ==============================================================================
param(
    [Parameter(Mandatory=$false)][string]$SubscriptionId,
    [Parameter(Mandatory=$false)][ValidateSet('Audit','Deny','Disabled')][string]$NamingEffect = '${customer.namingEffect || "Audit"}',
    [Parameter(Mandatory=$false)][ValidateSet('Audit','Deny','Disabled')][string]$SubnetEffect = '${customer.subnetEffect || "Audit"}',
    [Parameter(Mandatory=$false)][ValidateSet('Audit','Deny','Disabled')][string]$TagEffect = '${customer.tagEffect || "Audit"}',
    [Parameter(Mandatory=$false)][ValidateSet('Audit','Deny','Disabled')][string]$GeoEffect = '${customer.geoRestrictions?.effect || "Audit"}',
    [Parameter(Mandatory=$false)][ValidateSet('modify','audit','disabled')][string]$TagInheritanceEffect = '${customer.tagInheritance?.effect || "modify"}',
    [Parameter(Mandatory=$false)][ValidateSet('Default','DoNotEnforce')][string]$EnforcementMode = '${customer.enforcementMode || "Default"}'
)

$ErrorActionPreference = 'Stop'

Write-Host ">>> Starting Azure Landing Zone Policy Deployment for ${customer.name} (${version})..." -ForegroundColor Cyan

# 1. Connect and Set Context
if (-not (Get-AzContext)) {
    Connect-AzAccount
}
if ($SubscriptionId) {
    Set-AzContext -SubscriptionId $SubscriptionId | Out-Null
}

$CurrentContext = Get-AzContext
Write-Host "Target Subscription: $($CurrentContext.Subscription.Name) ($($CurrentContext.Subscription.Id))" -ForegroundColor Yellow

# 2. Validation
Write-Host "Validating deployment template..." -ForegroundColor Gray
$ValidationErrors = Test-AzSubscriptionDeployment \`
    -Location '${defaultRegion}' \`
    -TemplateFile ./main.bicep \`
    -namingEffect $NamingEffect \`
    -subnetEffect $SubnetEffect \`
    -tagEffect $TagEffect \`
    -geoEffect $GeoEffect \`
    -tagInheritanceEffect $TagInheritanceEffect \`
    -enforcementMode $EnforcementMode

if ($ValidationErrors) {
    $ValidationErrors | Format-Table
    throw "Deployment validation failed. Please check errors above."
}

Write-Host "Validation passed successfully." -ForegroundColor Green

# 3. Deploy
$DeploymentName = "${prefix}-alz-policies-v" + ("${version}".Replace('.', '-'))
Write-Host "Submitting deployment: $DeploymentName" -ForegroundColor Cyan

$Result = New-AzSubscriptionDeployment \`
    -Name $DeploymentName \`
    -Location '${defaultRegion}' \`
    -TemplateFile ./main.bicep \`
    -namingEffect $NamingEffect \`
    -subnetEffect $SubnetEffect \`
    -tagEffect $TagEffect \`
    -geoEffect $GeoEffect \`
    -tagInheritanceEffect $TagInheritanceEffect \`
    -enforcementMode $EnforcementMode

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "SUCCESS: Policies deployed to subscription." -ForegroundColor Green
Write-Host "Naming Assignment ID: $($Result.Outputs.namingAssignmentId.Value)" -ForegroundColor Gray
Write-Host "Tag Assignment ID:    $($Result.Outputs.tagAssignmentId.Value)" -ForegroundColor Gray
Write-Host "==============================================================================" -ForegroundColor Green
`;
}

export function generateDeploySh(customer) {
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = customer.subscriptionCode || "CON";
  const prefix = `${orgAbbr.toLowerCase()}-${subCode.toLowerCase()}`;
  const version = customer.version || "1.0.0";
  const defaultRegion = customer.defaultRegion || Object.keys(customer.regions || {})[0] || "canadacentral";

  return `#!/usr/bin/env bash
# ==============================================================================
# Azure Landing Zone Policy Deployment Script (Azure CLI / Bash)
# Customer: ${customer.name} | Subscription: ${customer.subscriptionName} (${subCode})
# Version: ${version}
# ==============================================================================
set -euo pipefail

LOCATION="${defaultRegion}"
DEPLOYMENT_NAME="${prefix}-alz-policies-v$(echo "${version}" | tr '.' '-')"
NAMING_EFFECT="${customer.namingEffect || "Audit"}"
SUBNET_EFFECT="${customer.subnetEffect || "Audit"}"
TAG_EFFECT="${customer.tagEffect || "Audit"}"
GEO_EFFECT="${customer.geoRestrictions?.effect || "Audit"}"
TAG_INHERITANCE_EFFECT="${customer.tagInheritance?.effect || "modify"}"
ENFORCEMENT_MODE="${customer.enforcementMode || "Default"}"

echo ">>> Validating ALZ Policy deployment for ${customer.name} (${version})..."
az deployment sub validate \\
  --location "$LOCATION" \\
  --template-file main.bicep \\
  --parameters \\
    namingEffect="$NAMING_EFFECT" \\
    subnetEffect="$SUBNET_EFFECT" \\
    tagEffect="$TAG_EFFECT" \\
    geoEffect="$GEO_EFFECT" \\
    tagInheritanceEffect="$TAG_INHERITANCE_EFFECT" \\
    enforcementMode="$ENFORCEMENT_MODE"

echo ">>> Validation successful. Deploying to Azure..."
az deployment sub create \\
  --name "$DEPLOYMENT_NAME" \\
  --location "$LOCATION" \\
  --template-file main.bicep \\
  --parameters \\
    namingEffect="$NAMING_EFFECT" \\
    subnetEffect="$SUBNET_EFFECT" \\
    tagEffect="$TAG_EFFECT" \\
    geoEffect="$GEO_EFFECT" \\
    tagInheritanceEffect="$TAG_INHERITANCE_EFFECT" \\
    enforcementMode="$ENFORCEMENT_MODE"

echo ">>> Deployment completed successfully!"
`;
}

export function generateReadme(customer) {
  const version = customer.version || "1.0.0";

  return `# ${customer.name} Azure Landing Zone Policies (v${version})

This package was generated automatically by **Azure Landing Zone Policy Studio**.
It contains production-ready policies for:
1. **Resource Naming Conventions** (with custom patterns and fallback support).
2. **Subnet Naming Allowlist** (standalone subnets and inline VNet subnets).
3. **Granular Tag Governance** across:
   - Subscription Level (${customer.tags?.subscription?.length || 0} rules)
   - Resource Group Level (${customer.tags?.resourceGroup?.length || 0} rules)
   - Resource Level (${customer.tags?.resource?.length || 0} rules)

---

## Files in this Package
- \`main.bicep\`: Azure Bicep deployment template containing all policy definitions, initiatives, and assignments.
- \`main.json\`: Pre-compiled ARM JSON template for direct deployment without Bicep CLI.
- \`parameters.json\`: Deployment parameters.
- \`Deploy-Audit.ps1\`: PowerShell script for validation and deployment.
- \`deploy.sh\`: Azure CLI Bash script for validation and deployment.
- \`customer-config.json\`: The raw customer configuration that produced this bundle.

---

## Quick Deployment

### Azure CLI
\`\`\`bash
az deployment sub create \\
  --name "${customer.abbreviation || "cust"}-alz-policies" \\
  --location canadacentral \\
  --template-file main.bicep \\
  --parameters namingEffect=Audit subnetEffect=Audit tagEffect=Audit
\`\`\`

### PowerShell
\`\`\`powershell
.\\Deploy-Audit.ps1 -NamingEffect Audit -SubnetEffect Audit -TagEffect Audit
\`\`\`
`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateApplyResourceTagsPs1(customer, catalog) {
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = customer.subscriptionCode || "CON";
  const version = customer.version || "1.0.0";
  const paradigm = customer.environmentParadigm || "greenfield";
  const topology = customer.topology || getBaselineTopology(customer);

  let script = `<#
==============================================================================
Azure Landing Zone Tag Remediation & Application Script (PowerShell)
Customer: ${customer.name} (${orgAbbr}) | Subscription: ${customer.subscriptionName || "Platform"} (${subCode})
Environment Paradigm: ${paradigm.toUpperCase()}
Generated: ${new Date().toISOString()} | Version: ${version}
==============================================================================
This operational runbook applies and remediates governance tags across
Resource Groups and Leaf Resources according to your ALZ Policy baselines.
#>
param(
    [Parameter(Mandatory=$false)][string]$SubscriptionId,
    [Parameter(Mandatory=$false)][switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

Write-Host ">>> Starting ALZ Tag Governance Runbook for ${customer.name}..." -ForegroundColor Cyan

if (-not (Get-AzContext)) {
    Connect-AzAccount
}
if ($SubscriptionId) {
    Set-AzContext -SubscriptionId $SubscriptionId | Out-Null
}

$CurrentContext = Get-AzContext
$subId = $CurrentContext.Subscription.Id
Write-Host "Active Subscription Context: $($CurrentContext.Subscription.Name) ($subId)" -ForegroundColor Yellow

$appliedCount = 0
$errorCount = 0

`;

  (topology.subscriptions || []).forEach((sub) => {
    script += `# ------------------------------------------------------------------------------\n`;
    script += `# Scope: Subscription ${sub.name} (${sub.code})\n`;
    script += `# ------------------------------------------------------------------------------\n\n`;

    (sub.resourceGroups || []).forEach((rg) => {
      const evalRg = evaluateRgNode(customer, catalog, sub, rg);
      const rgTags = evalRg.tags || {};
      const tagEntries = Object.entries(rgTags);

      if (tagEntries.length > 0) {
        script += `# Resource Group: ${evalRg.evaluatedName}\n`;
        script += `$rgId = "/subscriptions/$subId/resourceGroups/${evalRg.evaluatedName}"\n`;
        script += `$rgTags = @{\n`;
        tagEntries.forEach(([k, v]) => {
          script += `    '${k}' = '${v}'\n`;
        });
        script += `}\n`;
        script += `Write-Host "Applying tags to Resource Group: ${evalRg.evaluatedName}..." -ForegroundColor Cyan\n`;
        script += `if ($WhatIf) {\n`;
        script += `    Write-Host "[WhatIf] Would merge tags on $rgId" -ForegroundColor DarkGray\n`;
        script += `} else {\n`;
        script += `    try {\n`;
        script += `        Update-AzTag -ResourceId $rgId -Tag $rgTags -Operation Merge | Out-Null\n`;
        script += `        $appliedCount++\n`;
        script += `    } catch {\n`;
        script += `        Write-Warning "Failed to tag $rgId: $_"\n`;
        script += `        $errorCount++\n`;
        script += `    }\n`;
        script += `}\n\n`;
      }

      (rg.resources || []).forEach((res) => {
        const evalRes = evaluateResourceNode(customer, catalog, sub, rg, res);
        const resTags = evalRes.tags || {};
        const resTagEntries = Object.entries(resTags);

        if (resTagEntries.length > 0) {
          const resType = evalRes.resourceMeta?.resourceType || "Microsoft.Resources/unknown";
          script += `# Resource: ${evalRes.evaluatedName} (${resType})\n`;
          script += `$resId = "/subscriptions/$subId/resourceGroups/${evalRg.evaluatedName}/providers/${resType}/${evalRes.evaluatedName}"\n`;
          script += `$resTags = @{\n`;
          resTagEntries.forEach(([k, v]) => {
            script += `    '${k}' = '${v}'\n`;
          });
          script += `}\n`;
          script += `Write-Host "Applying tags to Resource: ${evalRes.evaluatedName}..." -ForegroundColor Cyan\n`;
          script += `if ($WhatIf) {\n`;
          script += `    Write-Host "[WhatIf] Would merge tags on $resId" -ForegroundColor DarkGray\n`;
          script += `} else {\n`;
          script += `    try {\n`;
          script += `        Update-AzTag -ResourceId $resId -Tag $resTags -Operation Merge | Out-Null\n`;
          script += `        $appliedCount++\n`;
          script += `    } catch {\n`;
          script += `        Write-Warning "Failed to tag $resId: $_"\n`;
          script += `        $errorCount++\n`;
          script += `    }\n`;
          script += `}\n\n`;
        }
      });
    });
  });

  script += `Write-Host "==============================================================================" -ForegroundColor Green\n`;
  script += `Write-Host "Tag Governance Runbook Complete: $appliedCount entities tagged, $errorCount errors." -ForegroundColor Green\n`;
  script += `Write-Host "==============================================================================" -ForegroundColor Green\n`;

  return script;
}

export function generateApplyResourceTagsSh(customer, catalog) {
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = customer.subscriptionCode || "CON";
  const version = customer.version || "1.0.0";
  const paradigm = customer.environmentParadigm || "greenfield";
  const topology = customer.topology || getBaselineTopology(customer);

  let script = `#!/usr/bin/env bash
# ==============================================================================
# Azure Landing Zone Tag Remediation & Application Script (Azure CLI / Bash)
# Customer: ${customer.name} (${orgAbbr}) | Subscription: ${customer.subscriptionName || "Platform"} (${subCode})
# Environment Paradigm: ${paradigm.toUpperCase()}
# Generated: ${new Date().toISOString()} | Version: ${version}
# ==============================================================================
set -euo pipefail

SUB_ID="\${1:-$(az account show --query id -o tsv)}"
echo ">>> Active Subscription Context: $SUB_ID"

`;

  (topology.subscriptions || []).forEach((sub) => {
    (sub.resourceGroups || []).forEach((rg) => {
      const evalRg = evaluateRgNode(customer, catalog, sub, rg);
      const rgTags = evalRg.tags || {};
      const tagEntries = Object.entries(rgTags);

      if (tagEntries.length > 0) {
        const tagArgs = tagEntries.map(([k, v]) => `"${k}=${v}"`).join(" ");
        script += `# Resource Group: ${evalRg.evaluatedName}\n`;
        script += `echo "Tagging Resource Group: ${evalRg.evaluatedName}..."\n`;
        script += `az tag update --resource-id "/subscriptions/$SUB_ID/resourceGroups/${evalRg.evaluatedName}" --operation merge --tags ${tagArgs}\n\n`;
      }

      (rg.resources || []).forEach((res) => {
        const evalRes = evaluateResourceNode(customer, catalog, sub, rg, res);
        const resTags = evalRes.tags || {};
        const resTagEntries = Object.entries(resTags);

        if (resTagEntries.length > 0) {
          const resType = evalRes.resourceMeta?.resourceType || "Microsoft.Resources/unknown";
          const tagArgs = resTagEntries.map(([k, v]) => `"${k}=${v}"`).join(" ");
          script += `# Resource: ${evalRes.evaluatedName} (${resType})\n`;
          script += `echo "Tagging Resource: ${evalRes.evaluatedName}..."\n`;
          script += `az tag update --resource-id "/subscriptions/$SUB_ID/resourceGroups/${evalRg.evaluatedName}/providers/${resType}/${evalRes.evaluatedName}" --operation merge --tags ${tagArgs}\n\n`;
        }
      });
    });
  });

  script += `echo ">>> Tag Governance Script Execution Completed Successfully!"\n`;
  return script;
}

export function downloadBicepFile(customer, catalog, options = {}) {
  const bicepContent = generateBicep(customer, catalog, options);
  const org = customer.abbreviation || customer.name || "cust";
  const sub = customer.subscriptionCode || "sub";
  const version = customer.version || "1.0.0";
  const filename = `${org.toLowerCase()}-${sub.toLowerCase()}-alz-policies-v${version}.bicep`;

  const blob = new Blob([bicepContent], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}

export async function downloadZipBundle(customer, catalog, options = {}) {
  const bicepContent = generateBicep(customer, catalog, options);
  const { template, parameters } = generateArmTemplate(customer, catalog, options);
  const ps1Content = generateDeployPs1(customer);
  const shContent = generateDeploySh(customer);
  const readmeContent = generateReadme(customer);
  const customerJson = JSON.stringify(customer, null, 2);

  // Generate tag application scripts
  const applyTagsPs1Content = generateApplyResourceTagsPs1(customer, catalog);
  const applyTagsShContent = generateApplyResourceTagsSh(customer, catalog);

  // Generate topology parameters & companion module
  const topology = customer.topology || getBaselineTopology(customer);
  const bicepParamsContent = generateBicepParameters(customer, topology, catalog);
  const armParamsObj = generateArmParameters(customer, topology, catalog);
  const companionBicepContent = generateCompanionResourcesBicep(customer, topology);

  const zip = new JSZip();
  // Policy Initiative & Assignment Files
  zip.file("main.bicep", bicepContent);
  zip.file("main.json", JSON.stringify(template, null, 2));
  zip.file("parameters.json", JSON.stringify(parameters, null, 2));
  zip.file("Deploy-Audit.ps1", ps1Content);
  zip.file("deploy.sh", shContent);
  zip.file("Apply-ResourceTags.ps1", applyTagsPs1Content);
  zip.file("apply-tags.sh", applyTagsShContent);
  zip.file("customer-config.json", customerJson);
  zip.file("README.md", readmeContent);

  // Topology Provisioning & Parameter Files (Unified Governance Engine)
  zip.file("resources.bicepparam", bicepParamsContent);
  zip.file("resources.bicep", companionBicepContent);
  zip.file("resource-parameters.json", JSON.stringify(armParamsObj, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const org = customer.abbreviation || customer.name || "cust";
  const sub = customer.subscriptionCode || "sub";
  const version = customer.version || "1.0.0";
  const filename = `${org.toLowerCase()}-${sub.toLowerCase()}-alz-package-v${version}.zip`;

  triggerDownload(blob, filename);
}
