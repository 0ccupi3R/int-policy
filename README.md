# Azure Landing Zone Policy Studio

A modern, config-driven Azure Policy automation suite and visual web studio for designing, testing, and deploying enterprise-grade **Resource Naming Conventions** and **Granular Tag Governance** across Azure Landing Zones (ALZ).

Aligned with the **Microsoft Cloud Adoption Framework (CAF)** and Azure Landing Zones Enterprise-Scale architecture.

---

## Key Features

1. **Multi-Customer Workspace Engine**:
   - Easily manage and switch between customer profiles (Customer Name, Abbreviation, Subscription Name, Subscription Code like `CON` or `PRDA`, Target Regions, and Semantic Versioning like `v1.0.0`).
   - Customer configurations are persistently saved in local storage and exportable as JSON profiles.

2. **Naming Convention Studio**:
   - **Dynamic Token Pattern Engine**: Define pattern syntax using smart tokens with automatic case rules:
     - `{Org}`: TitleCase customer abbreviation (e.g. `Con`, `Contoso`)
     - `{org}`: lowercase customer abbreviation (e.g. `con`, `contoso`)
     - `{ORG}`: UPPERCASE customer abbreviation (e.g. `CON`, `CONTOSO`)
     - `{OrgName}` / `{orgname}` / `{ORGNAME}`: Full customer name (e.g. `ContosoEnterprise`, `contoso-enterprise`, `CONTOSO-ENTERPRISE`)
     - `{SUB}`: UPPERCASE subscription code (e.g. `CON`, `PRDA`, `AIP`)
     - `{sub}`: lowercase subscription code (e.g. `con`, `prda`, `aip`)
     - `{SUBNAME}` / `{subname}` / `{SubName}`: Full subscription name (e.g. `CONNECTIVITY`, `Connectivity`)
     - `{ENV}` / `{env}`: Environment short code (e.g. `PRD`, `prd`, `DEV`, `dev`)
     - `{ENVNAME}` / `{envname}`: Full environment name (e.g. `PRODUCTION`, `production`)
     - `{ResourceGroup}` / `{RG}` / `{RGNAME}`: Resource Group wildcard (`*`) in Azure Policy
     - `{Region}` / `{region}` / `{REGION}`: Region codes (e.g. `Cc`, `cc`, `CC`)
     - `{Role}` / `{role}`: Server or VM role (e.g. `dc`, `web`, `app`)
     - `##`: Two-digit instance numbering (`01-99`)
   - **Extensible Resource Type Catalog**: 30+ preloaded official Azure resource types with an **"Add Custom Resource Type"** modal for custom types.
   - **Enforcement Modes**:
     - 🟢 **Custom Pattern**: Strictly enforces customer pattern.
     - 🟡 **Microsoft CAF Standard**: Falls back to official Microsoft CAF naming pattern (`<type>-<workload>-<env>-<region>-<instance>`).
     - ⚪ **Direct Creation (Unrestricted)**: Omits policy definition so the resource type can be created directly with any name.
   - **Interactive Live Name Sandbox**: Type any candidate name and test in real time whether it complies with policy rules.
   - **Subnet Allowlist Manager**: Safe allowlist for standalone subnets and inline `Microsoft.Network/virtualNetworks` subnets, with quick-add presets for Azure reserved subnets (`GatewaySubnet`, `AzureBastionSubnet`, `AzureFirewallSubnet`).

3. **Granular Tag Governance Studio**:
   - **Hierarchical Governance**:
     - 🏢 **Subscription Scope**: Broad financial & ownership governance (e.g. `CostCenter`, `Owner`, `BusinessUnit`).
     - 📁 **Resource Group Scope**: Lifecycle & project governance (e.g. `Environment`, `Workload`, `CostCenter`, `Owner`).
     - 📦 **Resource Scope**: Granular operational governance with `mode: Indexed` (e.g. `Environment`, `Application`, `DataClassification`, `Criticality`, `BackupPolicy`).
   - **Flexible Requirement & Fallback**:
     - **Required**: Tag must be present and value must match the allowed list.
     - **Optional**: Tag is not required; if omitted or provided as `NA` / `N/A`, it is accepted; if provided with a custom value, it must be in the approved list.
   - **Comma-Separated Allowed Values**: Fast text input with automatic badge chip rendering.
   - **CAF Baseline Quick-Import**: Import standard recommended tags with one click.

4. **One-Click Bicep & Artifact Downloader**:
   - **Instant Bicep Generator**: Generates clean, production-ready, modular `main.bicep` code with version metadata.
   - **Interactive Code Inspector**: Live syntax-highlighted tabs for `main.bicep`, `main.json` (ARM), `parameters.json`, `Deploy-Audit.ps1`, `deploy.sh`, and `customer.json`.
   - **One-Click Download**:
     - 🚀 **Download Bicep**: Downloads `<customer>-<subName>-policy-v<version>.bicep` directly.
     - 📦 **Download ZIP Bundle**: Packages `main.bicep`, `main.json`, `parameters.json`, `Deploy-Audit.ps1`, `deploy.sh`, and `README.md`.

---

## Getting Started

### 1. Launch the Web Portal
```bash
# Start the local development server
npm run dev
```
Open your browser at **`http://localhost:5173/`**.

### 2. Build for Production
```bash
# Build the optimized production bundle
npm run build
```
The static assets are compiled into `portal/dist/` and can be hosted on Azure Static Web Apps, an internal storage container, or accessed locally.

---

## Deployment to Azure

### Option A: Deploy via Azure CLI
```bash
SUBSCRIPTION_ID="YOUR-SUBSCRIPTION-ID"
az account set --subscription "$SUBSCRIPTION_ID"

# Validate
az deployment sub validate \
  --location canadacentral \
  --template-file main.bicep \
  --parameters namingEffect=Audit subnetEffect=Audit tagEffect=Audit

# Deploy
az deployment sub create \
  --name "alz-policy-bundle" \
  --location canadacentral \
  --template-file main.bicep \
  --parameters namingEffect=Audit subnetEffect=Audit tagEffect=Audit
```

### Option B: Deploy via PowerShell
```powershell
.\Deploy-Audit.ps1 -SubscriptionId "YOUR-SUBSCRIPTION-ID" -NamingEffect Audit -SubnetEffect Audit -TagEffect Audit
```

---

## Offline CI/CD Testing & CLI Validation

For automated pipelines, run the local AST condition-tree tests:
```bash
npm run test:offline
npm run test:regression
```

## Documentation & Tabletop Guides

- 📘 **[Enterprise User Guide & Tabletop Runbook](file:///Users/mrkhan/Tools/int-policy/USER_GUIDE.md)**: A complete enterprise walkthrough simulating onboarding **NovaAI Dynamics** (AI Landing Zone with Azure OpenAI, AI Search, and ML Workspaces), detailed tabletop drills, and operator troubleshooting.
- 📋 **[Quality Assurance & Verification Protocols](file:///Users/mrkhan/Tools/int-policy/QA.md)**: Mandatory QA checklist, tabletop sign-off rubric, and deployment verification standards.

---

## Architecture References
- [Microsoft Cloud Adoption Framework (CAF) Resource Naming](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming)
- [Microsoft CAF Resource Abbreviations](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)
- [Microsoft CAF Resource Tagging Strategy](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-tagging)
- [Azure Policy Definition Structure](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/definition-structure-policy-rule)

