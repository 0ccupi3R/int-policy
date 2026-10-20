# Quality Assurance & Verification Protocols

This document establishes the mandatory Quality Assurance (QA) checklist, verification protocols, and sign-off criteria for policy authoring and deployment within Azure Landing Zones.

---

## 1. Pre-Deployment Validation Checklist

Every policy bundle must pass all checks before moving from `Audit` to `Deny` in production:

- [ ] **Customer Profile Integrity**:
  - [ ] Customer Name and Abbreviation are non-empty and adhere to character constraints (`[a-z0-9]`).
  - [ ] Subscription Code matches approved Landing Zone subscription abbreviations (`CON`, `MGT`, `AIP`, `PRDA`).
  - [ ] Target regions are explicitly mapped to 2-4 character regional shortcodes.
- [ ] **Naming Convention Verification**:
  - [ ] Every active resource type has a valid pattern defined.
  - [ ] All patterns satisfy the resource provider's character and length restrictions (e.g. Storage Accounts: 3-24 alphanumeric lowercase only; Key Vault: 3-24 characters).
  - [ ] Subnet allowlist contains required Azure infrastructure service subnets (`GatewaySubnet`, `AzureBastionSubnet`, `AzureFirewallSubnet`).
  - [ ] Candidate sample names for each type have been tested in the Live Name Sandbox.
- [ ] **Granular Tag Governance Verification**:
  - [ ] Tag policies for resources use `mode: Indexed` to avoid evaluating untaggable child resources (locks, subnets, role assignments).
  - [ ] Tag policies for Resource Groups use `mode: All` with type `Microsoft.Resources/subscriptions/resourceGroups`.
  - [ ] Tag policies for Subscriptions use `mode: All` with type `Microsoft.Resources/subscriptions`.
  - [ ] Optional tags include `NA` and `N/A` in their allowed values list.
- [ ] **Safety & Rollout Controls**:
  - [ ] Initial rollout sets `namingEffect=Audit`, `subnetEffect=Audit`, `tagEffect=Audit`.
  - [ ] `notScopes` parameter is reviewed for approved exemption scopes or legacy sandboxes.
- [ ] **Bicep & ARM Compilation**:
  - [ ] Generated `main.bicep` compiles cleanly without warnings.
  - [ ] Generated `main.json` passes ARM schema validation.

---

## 2. Tabletop Exercise Sign-Off Rubric

Before enabling policy enforcement on customer workloads, conduct the tabletop scenario drills:

| Test Drill | Verification Criteria | Pass / Fail |
|---|---|---|
| **Drill 1: Compliant Deployment** | Resource with approved naming pattern and mandatory tags passes validation with zero policy errors. | PASS (Required) |
| **Drill 2: Non-Compliant Detection** | Resource with invalid pattern or missing tag is correctly identified in audit log or blocked with `RequestDisallowedByPolicy`. | PASS (Required) |
| **Drill 3: Emergent Workload Onboarding** | New resource type (e.g. Azure OpenAI `oai` or Databricks `dbw`) can be added dynamically and reflected in policy within 5 minutes. | PASS (Required) |
| **Drill 4: Scope Exemption** | Resources deployed into an exempted Resource Group listed in `notScopes` are not blocked or audited. | PASS (Required) |

---

## 3. Automated Test Execution

Run the local regression suite and offline test harness before every release:

```bash
# 1. Run offline AST condition-tree tests
npm run test:offline

# 2. Run configuration mutation regression tests
npm run test:regression

# 3. Run Azure live policy test harness (requires az login)
python3 tools/azure_test_runner.py
```

## 4. Azure Combined Test Suite (Naming & Tag Governance)

Automated test execution using `tools/azure_combined_test_runner.py` validates both naming conventions and granular tag governance:

```bash
python3 tools/azure_combined_test_runner.py
```

### Combined Test Results (100% Pass Rate - 28 Scenarios)

| Scenario ID | Workload Type | Target Name | Tags Tested | Naming | Tags | Outcome | Status |
|---|---|---|---|---|---|---|---|
| **RG-LIVE-01** | Resource Group | `cust01-con-cc-monitoring-rg` | `Environment: Prod`<br>`CostCenter: 1000`<br>`Workload: Connectivity`<br>`Owner: cloudops@customer.com` | ✅ Valid | ✅ Valid | Live Provisioned & Policy Compliant | ✅ **PASS** |
| **SA-LIVE-01** | Storage Account | `cust01conccdiagsa` | `Environment: Prod`<br>`Application: Monitoring`<br>`CostCenter: 1000`<br>`DataClassification: Confidential` | ✅ Valid | ✅ Valid | Live Provisioned & Policy Compliant | ✅ **PASS** |
| **RG-LIVE-02** | Resource Group | `cust01-con-cc-monitoring-rg` | Missing `CostCenter` | ✅ Valid | ❌ Missing | CAUGHT (Missing CostCenter tag) | ✅ **PASS** |
| **RG-LIVE-03** | Resource Group | `cust01-con-cc-monitoring-rg` | `Environment: UnapprovedEnv`<br>`CostCenter: 9999` | ✅ Valid | ❌ Invalid | CAUGHT (Invalid Environment & CostCenter) | ✅ **PASS** |
| **RG-LIVE-04** | Resource Group | `unapproved-random-rg-name` | Compliant Tags | ❌ Invalid | ✅ Valid | CAUGHT (Naming Pattern Violation) | ✅ **PASS** |
| **RG-LIVE-05** | Resource Group | `unapproved-random-rg-name` | `Environment: RogueTier`<br>`CostCenter: 9999` | ❌ Invalid | ❌ Invalid | CAUGHT (Dual Violation) | ✅ **PASS** |
| **SA-LIVE-02** | Storage Account | `cust01conccdiagsa` | Missing `Application` | ✅ Valid | ❌ Missing | CAUGHT (Missing Application tag) | ✅ **PASS** |
| **SA-LIVE-03** | Storage Account | `cust01conccdiagsa` | `Application: BitcoinMiner` | ✅ Valid | ❌ Invalid | CAUGHT (Invalid Application value) | ✅ **PASS** |
| **SA-LIVE-04** | Storage Account | `badstoragename0099` | Compliant Tags | ❌ Invalid | ✅ Valid | CAUGHT (Naming Pattern Violation) | ✅ **PASS** |
| **SA-LIVE-05** | Storage Account | `badstoragename0099` | `Environment: BadEnv` | ❌ Invalid | ❌ Invalid | CAUGHT (Dual Violation) | ✅ **PASS** |
| **VM-VAL-01** | Virtual Machine | `cust01-con-cc-web01-vm` | `Environment: Prod`<br>`Application: Portal`<br>`CostCenter: 1000` | ✅ Valid | ✅ Valid | PASS (Compliant Name & Tags) | ✅ **PASS** |
| **VM-VAL-02** | Virtual Machine | `cust01-con-cc-web01-vm` | Missing `Application` | ✅ Valid | ❌ Missing | CAUGHT (Missing Application tag) | ✅ **PASS** |
| **VM-VAL-03** | Virtual Machine | `cust01-con-cc-web01-vm` | `Environment: SandboxIllegal` | ✅ Valid | ❌ Invalid | CAUGHT (Invalid Environment value) | ✅ **PASS** |
| **VM-VAL-04** | Virtual Machine | `my-unapproved-vm` | Compliant Tags | ❌ Invalid | ✅ Valid | CAUGHT (Naming Pattern Violation) | ✅ **PASS** |
| **VM-VAL-05** | Virtual Machine | `my-unapproved-vm` | `Environment: Test` | ❌ Invalid | ❌ Invalid | CAUGHT (Dual Violation) | ✅ **PASS** |
| **VN-VAL-01** | Virtual Network | `cust01-con-cc-core-vnet` | `Environment: Prod`<br>`Application: Firewall`<br>`CostCenter: 1000` | ✅ Valid | ✅ Valid | PASS (ARM Validated & Compliant) | ✅ **PASS** |
| **VN-VAL-02** | Virtual Network | `random-vnet` | Compliant Tags | ❌ Invalid | ✅ Valid | CAUGHT (Naming Pattern Violation) | ✅ **PASS** |
| **SN-VAL-01** | Subnet (Inline) | `snet-apps` (in VNet) | N/A (Untaggable child) | ✅ Valid | Exempt | PASS (Approved Allowlist) | ✅ **PASS** |
| **SN-VAL-02** | Subnet (Inline) | `unapproved-subnet` | N/A (Untaggable child) | ❌ Invalid | Exempt | CAUGHT (Subnet Allowlist Violation) | ✅ **PASS** |
| **KV-VAL-01** | Key Vault | `cust01-con-cc-core-kv` | `Environment: Prod`<br>`Application: Monitoring`<br>`CostCenter: 1000` | ✅ Valid | ✅ Valid | PASS (ARM Validated & Compliant) | ✅ **PASS** |
| **KV-VAL-02** | Key Vault | `cust01-con-cc-core-kv` | Missing `CostCenter` | ✅ Valid | ❌ Missing | CAUGHT (Missing CostCenter tag) | ✅ **PASS** |
| **KV-VAL-03** | Key Vault | `rogue-vault-name` | Compliant Tags | ❌ Invalid | ✅ Valid | CAUGHT (Naming Pattern Violation) | ✅ **PASS** |
| **NSG-VAL-01** | Network Sec Group | `cust01-con-cc-hub-vnet-nsg-hub` | Compliant Tags | ✅ Valid | ✅ Valid | PASS (ARM Validated & Compliant) | ✅ **PASS** |
| **NIC-VAL-01** | Network Interface | `cust01-con-cc-dc01-nic` | Compliant Tags | ✅ Valid | ✅ Valid | PASS (ARM Validated & Compliant) | ✅ **PASS** |
| **PIP-VAL-01** | Public IP | `cust01-con-cc-hub-pip` | Compliant Tags | ✅ Valid | ✅ Valid | PASS (ARM Validated & Compliant) | ✅ **PASS** |
| **AI-VAL-01** | Azure OpenAI Account | `cust01-con-cc-rag-oai` | Compliant Tags + `DataClassification: Confidential` | ✅ Valid | ✅ Valid | PASS (ARM Validated & Compliant) | ✅ **PASS** |
| **AI-VAL-02** | Azure OpenAI Account | `cust01-con-cc-rag-oai` | `DataClassification: TopSecretClassified` | ✅ Valid | ❌ Invalid | CAUGHT (Invalid Optional Tag value) | ✅ **PASS** |
| **AI-VAL-03** | Azure OpenAI Account | `unapproved-ai-endpoint` | Compliant Tags | ❌ Invalid | ✅ Valid | CAUGHT (Naming Pattern Violation) | ✅ **PASS** |

**Zero Residual Footprint**: All live test resources deployed during testing (`cust01-con-cc-monitoring-rg` and `cust01conccdiagsa`) are automatically cleaned up with asynchronous ARM deletion.

---

## 5. Operational Sign-Off Form

| Role | Name | Signature / Approver ID | Date |
|---|---|---|---|
| **Lead Cloud Architect** | ____________________ | ____________________ | ____/____/2026 |
| **Security & Compliance Lead** | ____________________ | ____________________ | ____/____/2026 |
| **Landing Zone Platform Lead** | ____________________ | ____________________ | ____/____/2026 |
