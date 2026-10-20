# Azure Landing Zone Policy Studio: Enterprise User Guide & Tabletop Runbook

## Executive Summary

This runbook guides Cloud Architecture, Security, and Landing Zone Platform teams through designing, testing, and deploying enterprise-grade **Resource Naming Conventions** and **Granular Tag Governance** policies using **Azure Landing Zone Policy Studio**.

To ground these concepts in realistic operations, this guide is structured around a real-world enterprise **Tabletop Exercise** featuring a fictional customer: **"NovaAI Dynamics"**, an enterprise rapidly scaling generative AI, RAG architectures, and foundation models on Microsoft Azure.

---

## Table of Contents
1. [The Tabletop Scenario: NovaAI Dynamics](#1-the-tabletop-scenario-novaai-dynamics)
2. [Quick-Start: Launching the Studio](#2-quick-start-launching-the-studio)
3. [Step 1: Workspace & Profile Configuration](#3-step-1-workspace--profile-configuration)
4. [Step 2: Naming Convention Architecture & AI Workloads](#4-step-2-naming-convention-architecture--ai-workloads)
5. [Step 3: Granular Tag Governance Architecture](#5-step-3-granular-tag-governance-architecture)
6. [Step 4: Live Code Inspection & One-Click Download](#6-step-4-live-code-inspection--one-click-download)
7. [Step 5: Tabletop Simulation Drills](#7-step-5-tabletop-simulation-drills)
8. [Step 6: Azure Deployment & Pipeline Integration](#8-step-6-azure-deployment--pipeline-integration)
9. [Step 7: Operator Troubleshooting & Exception Management](#9-step-7-operator-troubleshooting--exception-management)

---

## 1. The Tabletop Scenario: NovaAI Dynamics

### The Enterprise Profile
- **Organization**: NovaAI Dynamics (`nova`)
- **Landing Zone Subscription**: `AI-Foundry-Production` (`AIP`)
- **Target Regions**: Canada Central (`cc`), Canada East (`ce`), East US 2 (`eus2`)
- **Workload Portfolio**: Azure OpenAI (GPT-4o / Embeddings), Azure AI Search (Vector Retrieval), Azure Machine Learning Workspaces, Azure Databricks, and Core Supporting Infrastructure.

### The Business & Governance Challenge
1. **Shadow AI Prevention**: Developers must not spin up unapproved or unmanaged AI endpoints across arbitrary regions.
2. **Cost Attribution for Expensive AI Infrastructure**: GPU compute clusters and token-based endpoints must be strictly tagged with valid `CostCenter` and `Owner` metadata.
3. **Information Security & Model Governance**: Resources processing model weights or vector embeddings must declare a mandatory `DataClassification` tag (`Restricted`, `Confidential`, `Internal`, `Public`).
4. **Predictable Resource Naming**: All assets must adhere to the standardized schema `{Org}-{SUB}-{ResourceGroup}-{abbreviation}` (e.g., `Novaai-AIP-RagApp-oai`).

---

## 2. Quick-Start: Launching the Studio

The web portal is fully self-contained and runs on any local machine or internal cloud workstation:

```bash
# 1. Clone or navigate to the repository
cd /Users/mrkhan/Tools/int-policy

# 2. Launch the Policy Studio Web Portal
npm run dev
```

Open your browser at **`http://localhost:5173/`**.

---

## 3. Step 1: Workspace & Profile Configuration

Every customer or landing zone environment has its own isolated profile in the Studio.

```mermaid
graph LR
    A[Customer Name: NovaAI Dynamics] -->|{Org} Token| D[Novaai TitleCase]
    B[Customer Abbr: nova] -->|{org} Token| E[nova lowercase]
    C[Subscription Code: AIP] -->|{SUB} Token| F[AIP UPPERCASE]
    D & E & F --> G[Resolved Resource Name: Novaai-AIP-RagApp-oai]
```

### Profile Attributes
Navigate to the top header and click **"Profile"** (or select **"NovaAI Dynamics (AIP)"** from the dropdown):
- **Customer Name**: `NovaAI Dynamics` (Resolves `{Org}` to `Novaai`)
- **Customer Abbreviation**: `nova` (Resolves `{org}` to `nova`, `{ORG}` to `NOVA`)
- **Subscription Name**: `AI-Foundry-Production`
- **Subscription Code**: `AIP` (Resolves `{SUB}` to `AIP`, `{sub}` to `aip`)
- **Azure Regions Mapping**: `canadacentral: cc, canadaeast: ce, eastus2: eus2`
- **Semantic Version**: `1.0.0` (Tracks policy changes over time)

---

## 4. Step 2: Naming Convention Architecture & AI Workloads

### Dynamic Token Engine
The Studio's token engine supports automatic casing transformations:

| Token | Description | Resolved Example (NovaAI) |
|---|---|---|
| `{Org}` | TitleCase Customer Abbreviation | `Nova` |
| `{org}` | Lowercase Customer Abbreviation | `nova` |
| `{ORG}` | UPPERCASE Customer Abbreviation | `NOVA` |
| `{OrgName}` | TitleCase Full Customer Name | `NovaaiDynamics` |
| `{orgname}` | Lowercase Full Customer Name | `novaai-dynamics` |
| `{ORGNAME}` | UPPERCASE Full Customer Name | `NOVAAI-DYNAMICS` |
| `{SUB}` | UPPERCASE Subscription Code | `AIP` |
| `{sub}` | Lowercase Subscription Code | `aip` |
| `{Sub}` | TitleCase Subscription Code | `Aip` |
| `{SUBNAME}` | UPPERCASE Full Subscription Name | `AI-FOUNDRY-PRODUCTION` |
| `{subname}` | Lowercase Full Subscription Name | `ai-foundry-production` |
| `{SubName}` | TitleCase Full Subscription Name | `AiFoundryProduction` |
| `{ENV}` | UPPERCASE Environment Code | `PRD` |
| `{env}` | Lowercase Environment Code | `prd` |
| `{Env}` | TitleCase Environment Code | `Prd` |
| `{ENVNAME}` | UPPERCASE Full Environment Name | `PRODUCTION` |
| `{envname}` | Lowercase Full Environment Name | `production` |
| `{EnvName}` | TitleCase Full Environment Name | `Production` |
| `{RG}` / `{rg}` | Short Resource Group token (`*` in policy) | `core` |
| `{RGNAME}` / `{ResourceGroup}` | Full Resource Group name (`*` in policy) | `RagApp` |
| `{Region}` / `{region}` | Regional code | `Cc` / `cc` |
| `{purpose}` / `{Purpose}` / `{PURPOSE}` | Workload / Subnet purpose token (`*` in policy) | `core`, `Core`, `CORE` |
| `{Role}` | Server/Workload component | `inference` |
| `{abbreviation}` | Official CAF service abbreviation | `oai`, `srch`, `mlw` |
| `##` | Two-digit instance counter (`01-99`) | `01` |

### Official Microsoft CAF AI Workloads in the Catalog
The catalog features built-in support for official Microsoft CAF AI and Analytics abbreviations:

| Service | Resource Provider Namespace | CAF Abbreviation | Standard Pattern |
|---|---|---|---|
| **Azure OpenAI Service** | `Microsoft.CognitiveServices/accounts` (kind: OpenAI) | `oai` | `{Org}-{SUB}-{ResourceGroup}-oai` |
| **Azure AI Search** | `Microsoft.Search/searchServices` | `srch` | `{org}-{sub}-{region}-srch` |
| **Azure Machine Learning Workspace** | `Microsoft.MachineLearningServices/workspaces` | `mlw` | `{Org}-{SUB}-{ResourceGroup}-mlw` |
| **Azure AI Foundry Account** | `Microsoft.CognitiveServices/accounts` (kind: AIServices) | `aif` | `{Org}-{SUB}-{ResourceGroup}-aif` |
| **Azure Databricks Workspace** | `Microsoft.Databricks/workspaces` | `dbw` | `{Org}-{SUB}-{ResourceGroup}-dbw` |

### Dual Preset Standards: AirGate vs. Azure CAF
For each resource type in the Naming Studio, operators have dual quick-set preset controls:
- **AirGate Standard (Default)**: Sets the enterprise landing zone pattern `{Org}-{SUB}-{ResourceGroup}-{abbreviation}`. Shows a cyan active chip (`AirGate Standard`) with checkmark.
- **Azure CAF**: Sets the Microsoft Cloud Adoption Framework default pattern `{abbreviation}-{workload}-{env}-{region}`. Shows a purple active chip (`Azure CAF`) with checkmark.
- **Custom Pattern**: Any freeform edit typed by the administrator is immediately recognized and badged as `Custom Pattern`.

#### Bulk Baseline Actions
Located directly in the Resource Type toolbar:
- **Apply AirGate to All**: Instantly aligns all active resource types to the AirGate standard formula.
- **Apply Azure CAF to All**: Switches all active resource types to official Microsoft CAF defaults.

### Curated Naming Baselines & Workload Templates
Administrators can load pre-architected naming baselines for specific workloads or save customer configurations as reusable organizational templates:
1. Click **"Baselines & Templates"** in the top header.
2. Select an enterprise baseline:
   - **AirGate Enterprise ALZ Core** (18 foundation resources: Resource Groups, VNet, Subnets, NSG, NIC, Public IP, Route Table, Azure Firewall, Bastion, Key Vault, Storage, VM, Log Analytics, Automation, User Managed Identity, App Gateway, Private Endpoint, NAT Gateway).
   - **AI & Modern Analytics Suite** (12 resources: Azure OpenAI, AI Search, Azure ML Workspaces, AI Foundry, Databricks, Synapse, Cognitive Services, Storage, Key Vault, VNet, Private Endpoints, RG).
   - **Cloud-Native & Microservices** (13 resources: AKS, Container Registry, Container Apps, App Service, App Service Plan, Functions, Cosmos DB, Azure SQL, Redis, APIM, Event Hubs, Service Bus, RG).
   - **Full Enterprise CAF Suite** (36 comprehensive Azure resource types).
3. **Dynamic Customer Resolution**: Inspect the live name compliance previews on the right panel. All template tokens (`{Org}`, `{SUB}`, `{Region}`) automatically resolve using the active customer's profile details.
4. Click **"Apply Template to {Customer Name}"** to enforce the baseline.
5. **Save Custom Baseline**: Save the current workspace rules as a named custom template (e.g. `NovaAI-Gov-Baseline-v1`) for reuse across subscriptions.

### Enforcement Modes
For each resource type, administrators can toggle between:
- 🟢 **Enforced**: Mandates compliance with the designated naming formula. Non-compliant resource deployments are denied by Azure Policy.
- ⚪ **Direct Creation (Unrestricted)**: Exempts the resource type from policy naming rules, allowing developers to create resources with any name (useful for sandboxes or third-party legacy integrations).

### Real-Time Azure Platform Character Type & Length Constraint Validation

Azure Resource Manager (ARM) enforces physical platform-level naming constraints that are completely independent of Azure Policy. If an administrator configures a naming pattern that violates these platform limits (for example, setting `{Org}-{RG}-sa` for a Storage Account), Azure ARM will physically reject the resource deployment during provisioning, even if an Azure Policy would otherwise permit it.

The Policy Studio includes a real-time **Azure Platform Constraint Engine** integrated directly into the live studio:

#### 1. Live Constraints on Resource Cards
Every resource card displays its official Microsoft CAF constraints:
- **Length Bounds**: `📏 {minLength}–{maxLength} chars` (e.g., `3–24 chars` for Storage Accounts, `1–15 chars` for Windows VMs, `3–24 chars` for Key Vaults, `1–90 chars` for Resource Groups).
- **Allowed Character Sets**: Explicit character guidelines (e.g. `Lowercase letters and numbers only (no hyphens/underscores)` for Storage Accounts, `Alphanumerics only` for ACR, `Alphanumerics and hyphens` for Key Vaults).

#### 2. Sensitive Resource Rules & Auto-Fix Suggestions

| Sensitive Azure Resource | Allowed Characters | Length Limit | What Happens if Changed to Hyphens/Uppercase? |
|---|---|---|---|
| **Storage Account (`sa`)** | `a-z0-9` (lowercase only) | 3–24 chars | **Rejected**: Card turns red, flags hyphen/uppercase errors. Clicking **`⚡ Auto-Fix`** converts `{Org}-{RG}-sa` into `{org}{rg}sa`. |
| **Key Vault (`kv`)** | `a-zA-Z0-9-` | 3–24 chars | **Rejected if underscores (`_`) used**: Card flags underscore error. Clicking **`⚡ Auto-Fix`** converts `{Org}_{RG}_kv` to `{Org}-{RG}-kv`. |
| **Container Registry (`cr`)** | `a-zA-Z0-9` (alphanumeric only) | 5–50 chars | **Rejected if hyphens/underscores used**: ACR only permits alphanumeric characters. Auto-fix removes symbols. |
| **Virtual Machine (`vm`)** | `a-zA-Z0-9-` | 1–15 chars (Windows) / 64 (Linux) | **Warned if length > 15 chars**: Azure Windows NetBIOS names cannot exceed 15 chars. Studio warns operators in real time. |
| **Cosmos DB & AI Search** | `a-z0-9-` (lowercase only) | 3–44 / 2–60 chars | **Rejected if uppercase used**: Studio warns if TitleCase tokens (`{Org}`, `{SUB}`) are used instead of lowercase (`{org}`, `{sub}`). |

#### 3. Real-Time Character Counters & Compliant Badges
- **Live Counter**: As pattern tokens expand into resolved customer sample names, each card displays a live character count badge (e.g., `14 / 24 chars`). If a long customer abbreviation causes the name to exceed the maximum length, the badge turns red and highlights `EXCEEDED`.
- **Compliance Badge**: Green `✓ Compliant` vs. Red `❌ Non-Compliant` chip.

#### 4. Global Violations Banner & Auto-Fix All
If any active resource naming pattern violates Azure ARM platform constraints, a global red warning banner displays at the top of the Studio:
- Alerts the cloud architect to the exact number of broken patterns.
- Provides a 1-click **`⚡ Auto-Fix All Violations`** button that automatically sanitizes all broken patterns across the entire tenant.

#### 5. Dual-Layer Live Compliance Sandbox
In the interactive Sandbox at the top of the Studio, candidate names are evaluated simultaneously against:
1. **Azure Policy Rule Match**: Does the candidate name match the wildcard regex format?
2. **Physical ARM Constraints**: Can Azure ARM actually provision this resource name (checking length, hyphens, underscores, uppercase letters)?


### Adding Emergent AI & Cloud Resource Types (CAF Autocomplete)
When adding any resource type:
1. In the Naming Studio, click **"+ Add Resource Type"**.
2. **Search 200 CAF & AirGate Resources**: Use the live search box to type keywords (e.g. `Databricks`, `OpenAI`, `Key Vault`, `Redis`, `Event Hub`).
3. **Instant Autofill**: Selecting a matched resource automatically populates:
   - **Provider String** (e.g. `Microsoft.Databricks/workspaces`)
   - **CAF & AirGate Abbreviations** (with live indicator if an AirGate enterprise override is active, e.g. `sa` vs `st`)
   - **Azure Platform Constraints**: Automatically checks and enforces minimum/maximum character length limits (`3` to `30` chars for Databricks, `3` to `24` for Storage) and allowed character sets (e.g., alphanumeric only, lowercase only).
   - **Default Naming Pattern**: Dynamically constructed with customer tokens (`{Org}-{SUB}-{ResourceGroup}-{abbr}`).
4. Click **"Add Resource Type to Naming Rules"** — the rule is immediately activated in the naming policy and rendered in Bicep.

---

## 5. Step 3: CAF & AirGate Resource Catalogue Management

The Studio includes a dedicated **CAF & AirGate Resource Catalogue** tab (`3. CAF & AirGate Catalogue`):

- **200 Azure Resource Types Across 14 Categories**: Complete single source of truth spanning AI + Machine Learning, Networking, Compute, Storage, Databases, Security, Containers, Analytics, and Governance.
- **AirGate Enterprise Overrides vs. Official CAF**:
  - AirGate enterprise standards override 5 specific CAF codes by default:
    - `microsoft.storage/storageaccounts`: `sa` (official CAF: `st`)
    - `microsoft.operationalinsights/workspaces`: `law` (official CAF: `log`)
    - `microsoft.network/virtualnetworkgateways`: `gw` (official CAF: `vgw`)
    - `microsoft.network/connections`: `conn` (official CAF: `con`)
    - `microsoft.network/loadbalancers`: `lb` (official CAF: `lbe`)
  - **Customizable Overrides**: Click the edit icon on any resource row to customize the shortcode or click **"Reset to CAF"**. Overrides persist in browser local storage.
  - **Quick One-Click Import**: Click **"+ Add to Naming"** on any catalogue resource to immediately import it into the active workspace's naming policy.
  - **Tag Governance Alignment**: The catalogue highlights whether a resource is evaluated at Subscription level (`mode: All`), Resource Group level (`mode: All`), Leaf Resource level (`mode: Indexed`), or is an untaggable child resource (e.g. Subnets).

---

## 6. Step 4: Granular Tag Governance Architecture

Tag governance is organized into 3 distinct hierarchical scopes, from broad subscription governance down to operational resource tags.

```mermaid
graph TD
    subgraph Subscription Scope [Broad Governance]
        S1["CostCenter: AI-RND-101, AI-PROD-202, DATA-ENG"]
        S2["Owner: ai-leads@nova.ai, mlops-platform@nova.ai"]
        S3["ComplianceFramework: ISO42001-AI, SOC2-Type2, HIPAA, NA"]
    end

    subgraph Resource Group Scope [Workload Lifecycle]
        R1["Environment: Prod, NonProd, Dev, Stage, Sandbox"]
        R2["Workload: GenerativeAI-RAG, ModelFineTuning, AnalyticsLakehouse"]
        R3["CostCenter: Inherited / Declared"]
    end

    subgraph Resource Scope [Granular Operational - mode: Indexed]
        M1["Environment: Prod, NonProd, Dev, Stage, Sandbox"]
        M2["DataClassification: Restricted, Confidential, Internal, Public"]
        M3["AIModelType: LLM-GPT4, LLM-GPT4o, Embedding-Ada, Vision, NA"]
        M4["BackupPolicy: Daily-30Days, Weekly-90Days, NA"]
    end

    Subscription Scope --> Resource Group Scope
    Resource Group Scope --> Resource Scope
```

### Required vs. Optional Tags (The `NA` Fallback Rule)
- **Mandatory Tags**: Tag must exist on the resource, and its value must strictly match the allowed list. If omitted, Azure Policy triggers `Deny` or `Audit`.
- **Optional Tags (`NA` Fallback)**: Tag is not strictly required.
  - If omitted: Allowed (compliant).
  - If supplied as `NA` or `N/A`: Allowed (compliant).
  - If supplied with a custom string: Must be one of the pre-approved values.

---

## 6. Step 4: Live Code Inspection & One-Click Download

Navigate to **"3. Bicep & Artifact Inspector"**:
- **`main.bicep`**: Production-ready, fully documented Azure Bicep code declaring type-specific policy definitions, initiatives, and assignments.
- **`main.json`**: Pre-compiled ARM JSON template for direct Azure CLI or REST API deployment.
- **`parameters.json`**: Runtime parameter file with default values.
- **`Deploy-Audit.ps1`**: Ready-to-run PowerShell script with pre-flight deployment validation.
- **`deploy.sh`**: Bash script for Azure CLI automated execution.

### Export Actions
- Click **"Download Bicep"** to download `nova-aip-alz-policies-v1.0.0.bicep`.
- Click **"Download Bundle (.zip)"** to package all templates, scripts, and documentation into a single zip archive.

---

## 7. Step 5: Tabletop Simulation Drills

Conduct these four tabletop exercises to train platform engineers and validate policy enforcement.

### Drill A: Validating a Compliant Azure OpenAI Deployment
- **Scenario**: The MLOps team provisions a production Azure OpenAI resource in Canada Central.
- **Target Name**: `Novaai-AIP-RagApp-oai`
- **Resource Group**: `cust01-con-cc-apps-rg`
- **Location**: `canadacentral`
- **Tags Supplied**:
  ```json
  {
    "Environment": "Prod",
    "DataClassification": "Confidential",
    "CostCenter": "AI-PROD-202",
    "AIModelType": "LLM-GPT4o"
  }
  ```
- **Expected Outcome**: **PASS (Compliant)**.
  - Name adheres to `{Org}-{SUB}-{ResourceGroup}-oai`.
  - Location matches Canada Central mapping (`cc`).
  - Mandatory tags and approved values are verified.

### Drill B: Catching a Non-Compliant AI Search Service
- **Scenario**: A developer attempts to create an unapproved vector search index with a non-standard name.
- **Attempted Name**: `my-test-search-cluster`
- **Location**: `canadacentral`
- **Expected Outcome**: **CAUGHT (Non-Compliant)**.
  - The name violates `{org}-{sub}-{region}-srch` (expected `nova-aip-cc-srch`).
  - Policy engine flags an audit finding or blocks creation with `RequestDisallowedByPolicy`.

### Drill C: Emergent AI Tool Onboarding
- **Scenario**: The data science team requests Azure Databricks (`dbw`).
- **Action in Studio**:
  1. Open Naming Studio.
  2. Locate `Azure Databricks Workspace`.
  3. Verify pattern `{Org}-{SUB}-{ResourceGroup}-dbw`.
  4. Test candidate name `Novaai-AIP-Lakehouse-dbw` in Live Sandbox.
  5. Verify green checkmark.
  6. Click **Download Bicep** and commit to repository.

### Drill D: Managing Exemptions for an AI R&D Sandbox
- **Scenario**: An AI research team requires a temporary sandbox where researchers can test arbitrary names.
- **Action**: Pass the sandbox Resource Group ID to the `notScopes` parameter during deployment:
  ```bash
  az deployment sub create \
    --name "nova-aip-policies" \
    --location canadacentral \
    --template-file main.bicep \
    --parameters notScopes='["/subscriptions/YOUR-SUB-ID/resourceGroups/nova-aip-sandbox-rg"]'
  ```

---

## 8. Step 6: Azure Deployment & Pipeline Integration

### Option 1: Azure CLI Deployment
```bash
SUBSCRIPTION_ID="a2e6a0ac-fc03-4f4b-9632-8b4b60ea0976"
az account set --subscription "$SUBSCRIPTION_ID"

# 1. Pre-flight Validation
az deployment sub validate \
  --location canadacentral \
  --template-file main.bicep \
  --parameters namingEffect=Audit subnetEffect=Audit tagEffect=Audit

# 2. Deploy Policy Bundle
az deployment sub create \
  --name "nova-aip-governance-v1" \
  --location canadacentral \
  --template-file main.bicep \
  --parameters namingEffect=Audit subnetEffect=Audit tagEffect=Audit
```

### Option 2: CI/CD Pipeline (GitHub Actions Example)
```yaml
name: Deploy Landing Zone Policies
on:
  push:
    branches: [main]
    paths: ['portal/**', 'main.bicep']

jobs:
  validate-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Validate Bicep
        run: |
          az deployment sub validate \
            --location canadacentral \
            --template-file main.bicep \
            --parameters namingEffect=Audit tagEffect=Audit

      - name: Deploy to Azure
        run: |
          az deployment sub create \
            --name "alz-policy-run-${{ github.run_id }}" \
            --location canadacentral \
            --template-file main.bicep
```

---

## 9. Step 7: Operator Troubleshooting & Exception Management

| Symptom / Error | Root Cause | Remediation |
|---|---|---|
| `RequestDisallowedByPolicy` on Resource Creation | Name or required tags failed policy evaluation while in `Deny` mode. | Check policy error message for the specific failing pattern or missing tag key. Correct resource parameters or request approved waiver. |
| Tag Policy flagged on Subnets or Locks | Policy evaluated untaggable child resources. | Ensure resource tag policies use `mode: Indexed` (Studio generates this automatically). |
| Resource Group missing tags | Resource Group was created without mandatory tags. | Resource Groups are evaluated with `mode: All` and `type: Microsoft.Resources/subscriptions/resourceGroups`. Add required tags during RG creation. |
| Region code mismatch (`-cc-` vs `-ce-`) | Name specifies Canada Central (`cc`) but resource was targeted at Canada East (`ce`). | Align resource deployment region with the name tokens. |
