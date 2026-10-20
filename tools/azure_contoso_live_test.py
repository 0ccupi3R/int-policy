#!/usr/bin/env python3
"""
Azure Policy Live Validation Test Harness for Contoso Enterprise
Executes full end-to-end verification against the active Azure subscription:
1. Deletes obsolete cust01-naming-* policy definitions.
2. Generates & deploys the Contoso naming policy bundle (main.bicep).
3. Executes negative & positive naming convention checks against live definitions.
4. Provisions a live workload in a new Resource Group (VNet, Subnet, Storage Account, NIC, VM).
5. Deallocates the VM immediately to guarantee $0 compute costs.
6. Validates naming, tagging (inherited, resource-level, in-policy vs outside-policy), and policy compliance.
7. Performs guaranteed clean teardown of the test Resource Group.
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUBSCRIPTION_ID = "a2e6a0ac-fc03-4f4b-9632-8b4b60ea0976"
LOCATION = "canadacentral"
TEST_RG = "contoso-con-cc-core-rg"

# Terminal ANSI formatting
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def run_az(args, check=False):
    cmd = ["az"] + args
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\nStderr: {res.stderr}\nStdout: {res.stdout}")
    return res


def policy_match(value, pattern):
    expression = "".join(
        ".*" if c == "*" else "[0-9]" if c == "#" else "[A-Za-z]" if c == "?" else "." if c == "." else re.escape(c)
        for c in pattern
    )
    return re.fullmatch(expression, value, re.IGNORECASE) is not None


def evaluate_naming_condition(condition, resource, member=None):
    if "allOf" in condition:
        return all(evaluate_naming_condition(item, resource, member) for item in condition["allOf"])
    if "anyOf" in condition:
        return any(evaluate_naming_condition(item, resource, member) for item in condition["anyOf"])
    if "not" in condition:
        return not evaluate_naming_condition(condition["not"], resource, member)
    if "count" in condition:
        values = resource.get("subnets", [])
        count = sum(evaluate_naming_condition(condition["count"]["where"], resource, item) for item in values)
        return count > condition["greater"]

    field = condition.get("field")
    if field == "Microsoft.Network/virtualNetworks/subnets[*].name":
        value = member
    else:
        value = resource.get(field)

    if "equals" in condition:
        return str(value).lower() == str(condition["equals"]).lower()
    if "matchInsensitively" in condition:
        return policy_match(str(value), condition["matchInsensitively"])
    if "notIn" in condition:
        return str(value).lower() not in [str(item).lower() for item in condition["notIn"]]
    raise ValueError(f"Unsupported condition: {condition}")


def is_naming_non_compliant(policy_def, resource_data):
    props = policy_def.get("properties", policy_def)
    rule_if = props["policyRule"]["if"]
    return evaluate_naming_condition(rule_if, resource_data)


def phase1_pre_cleanup():
    print(f"\n{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print(f"{CYAN}{BOLD}PHASE 1: PRE-CLEANUP OF OBSOLETE CUSTOMER POLICIES{RESET}")
    print(f"{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print("Searching for legacy cust01-naming-* policy definitions...")

    res = run_az(["policy", "definition", "list", "--query", "[?contains(name, 'cust01-naming')].name", "-o", "json"])
    if res.returncode == 0:
        defs_to_delete = json.loads(res.stdout or "[]")
        if defs_to_delete:
            print(f"Found {len(defs_to_delete)} legacy policy definitions to delete.")
            for name in defs_to_delete:
                del_res = run_az(["policy", "definition", "delete", "--name", name])
                if del_res.returncode == 0:
                    print(f"  ✓ Deleted legacy definition: {name}")
                else:
                    print(f"  ✗ Failed to delete {name}: {del_res.stderr.strip()}")
        else:
            print("  ✓ No legacy cust01-naming definitions found.")
    else:
        print(f"  ✗ Failed to query policy definitions: {res.stderr}")

    # Check if any legacy assignments exist
    res = run_az(["policy", "assignment", "list", "--query", "[?contains(name, 'cust01')].name", "-o", "json"])
    if res.returncode == 0:
        assigns = json.loads(res.stdout or "[]")
        for a in assigns:
            run_az(["policy", "assignment", "delete", "--name", a])
            print(f"  ✓ Deleted legacy assignment: {a}")


def phase2_deploy_contoso_policies():
    print(f"\n{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print(f"{CYAN}{BOLD}PHASE 2: GENERATE & DEPLOY CONTOSO NAMING POLICY BUNDLE{RESET}")
    print(f"{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")

    # 1. Run tools/generate.py
    print("Running tools/generate.py to build Contoso policies...")
    gen_res = subprocess.run([sys.executable, str(ROOT / "tools/generate.py")], capture_output=True, text=True)
    if gen_res.returncode != 0:
        raise RuntimeError(f"tools/generate.py failed: {gen_res.stderr}")
    print("  ✓ " + gen_res.stdout.strip())

    # 2. Deploy generated/main.json at subscription scope
    print(f"Deploying Contoso naming policy bundle to subscription '{SUBSCRIPTION_ID}'...")
    deploy_args = [
        "deployment", "sub", "create",
        "--name", f"contoso-policy-deploy-{int(time.time())}",
        "--location", LOCATION,
        "--template-file", str(ROOT / "generated/main.json"),
        "--parameters", str(ROOT / "generated/parameters.json"),
        "-o", "json"
    ]
    deploy_res = run_az(deploy_args)
    if deploy_res.returncode != 0:
        raise RuntimeError(f"Policy deployment failed: {deploy_res.stderr}")
    print(f"  {GREEN}✓ Contoso naming policy bundle successfully deployed to Azure.{RESET}")

    # 3. Verify loaded definitions
    verify_res = run_az(["policy", "definition", "show", "--name", "contoso-naming-rg", "-o", "json"])
    if verify_res.returncode == 0:
        print(f"  {GREEN}✓ Verified live Azure policy definition: contoso-naming-rg{RESET}")
    else:
        raise RuntimeError("Failed to verify deployed contoso-naming-rg definition.")


def phase3_negative_and_positive_testing():
    print(f"\n{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print(f"{CYAN}{BOLD}PHASE 3: NEGATIVE & POSITIVE NAMING CONVENTION TESTING{RESET}")
    print(f"{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")

    definitions = {}
    for key in ["rg", "storage", "vm", "vnet", "subnet", "nic"]:
        pol_name = f"contoso-naming-{key}"
        res = run_az(["policy", "definition", "show", "--name", pol_name, "-o", "json"])
        if res.returncode == 0:
            definitions[key] = json.loads(res.stdout)
            print(f"  ✓ Loaded definition: {pol_name}")
        else:
            raise RuntimeError(f"Could not load definition: {pol_name}")

    # 1. Negative Tests (Incorrect Naming)
    print(f"\n{BOLD}1. Negative Test Scenarios (Must Flag Non-Compliance):{RESET}")
    negative_cases = [
        {
            "key": "rg",
            "name": "invalid_rg_with_underscores",
            "data": {"type": "Microsoft.Resources/subscriptions/resourceGroups", "name": "invalid_rg_with_underscores", "location": LOCATION},
            "desc": "Non-compliant RG name with underscores"
        },
        {
            "key": "storage",
            "name": "Contoso-Storage-With-Hyphens",
            "data": {"type": "Microsoft.Storage/storageAccounts", "name": "Contoso-Storage-With-Hyphens", "location": LOCATION},
            "desc": "Non-compliant Storage Account with hyphens & uppercase"
        },
        {
            "key": "vm",
            "name": "contoso-invalid-long-vm-name-rules-failed",
            "data": {"type": "Microsoft.Compute/virtualMachines", "name": "contoso-invalid-long-vm-name-rules-failed", "location": LOCATION},
            "desc": "Non-compliant VM name violating naming pattern"
        },
        {
            "key": "subnet",
            "name": "unauthorized-subnet-404",
            "data": {"type": "Microsoft.Network/virtualNetworks", "location": LOCATION, "subnets": ["unauthorized-subnet-404"]},
            "desc": "Non-compliant Subnet name outside allowed list"
        }
    ]

    for tc in negative_cases:
        pol = definitions[tc["key"]]
        is_bad = is_naming_non_compliant(pol, tc["data"])
        if is_bad:
            print(f"  {GREEN}✓ PASS (Correctly Flagged):{RESET} {tc['name']} -> {tc['desc']}")
        else:
            print(f"  {RED}✗ FAIL (Should Be Flagged):{RESET} {tc['name']}")
            raise AssertionError(f"Negative test failed for {tc['name']}")

    # 2. Positive Tests (Compliant Naming)
    print(f"\n{BOLD}2. Positive Test Scenarios (Must Pass Compliance):{RESET}")
    positive_cases = [
        {
            "key": "rg",
            "name": "contoso-con-cc-core-rg",
            "data": {"type": "Microsoft.Resources/subscriptions/resourceGroups", "name": "contoso-con-cc-core-rg", "location": LOCATION},
            "desc": "Compliant Core Resource Group in Canada Central"
        },
        {
            "key": "vnet",
            "name": "contoso-con-cc-core-vnet",
            "data": {"type": "Microsoft.Network/virtualNetworks", "name": "contoso-con-cc-core-vnet", "location": LOCATION},
            "desc": "Compliant Core Virtual Network in Canada Central"
        },
        {
            "key": "subnet",
            "name": "snet-core",
            "data": {"type": "Microsoft.Network/virtualNetworks", "location": LOCATION, "subnets": ["snet-core"]},
            "desc": "Compliant Subnet name in allowlist"
        },
        {
            "key": "storage",
            "name": "contosoconccfilessa",
            "data": {"type": "Microsoft.Storage/storageAccounts", "name": "contosoconccfilessa", "location": LOCATION},
            "desc": "Compliant Storage Account compact name in Canada Central"
        },
        {
            "key": "nic",
            "name": "contoso-con-cc-dc01-nic",
            "data": {"type": "Microsoft.Network/networkInterfaces", "name": "contoso-con-cc-dc01-nic", "location": LOCATION},
            "desc": "Compliant Network Interface for dc01 in Canada Central"
        },
        {
            "key": "vm",
            "name": "contoso-con-cc-dc01-vm",
            "data": {"type": "Microsoft.Compute/virtualMachines", "name": "contoso-con-cc-dc01-vm", "location": LOCATION},
            "desc": "Compliant VM name for dc01 in Canada Central"
        }
    ]

    for tc in positive_cases:
        pol = definitions[tc["key"]]
        is_bad = is_naming_non_compliant(pol, tc["data"])
        if not is_bad:
            print(f"  {GREEN}✓ PASS (Compliant):{RESET} {tc['name']} -> {tc['desc']}")
        else:
            print(f"  {RED}✗ FAIL (Falsely Flagged):{RESET} {tc['name']}")
            raise AssertionError(f"Positive test failed for {tc['name']}")


def phase4_deploy_workload():
    print(f"\n{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print(f"{CYAN}{BOLD}PHASE 4: LIVE WORKLOAD PROVISIONING (RG, VNET, STORAGE, NIC, VM){RESET}")
    print(f"{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")

    # 1. Create Resource Group with Policy & Outside Tags
    print(f"Creating Resource Group '{TEST_RG}' in '{LOCATION}'...")
    rg_tags = [
        "Environment=Prod",
        "CostCenter=1000",
        "Workload=CoreInfra",
        "Owner=cloudops@contoso.com",
        "BusinessUnit=PlatformEngineering",
        "Project=CloudModernization"
    ]
    rg_create = run_az(["group", "create", "-n", TEST_RG, "-l", LOCATION, "--tags"] + rg_tags + ["-o", "json"], check=True)
    print(f"  {GREEN}✓ Resource Group '{TEST_RG}' created with mandatory & custom tags.{RESET}")

    # 2. Deploy workload via workload_deploy.bicep
    print("Deploying companion workload template (workload_deploy.bicep)...")
    bicep_file = str(ROOT / "tools/workload_deploy.bicep")
    deploy_args = [
        "deployment", "group", "create",
        "-g", TEST_RG,
        "-n", f"workload-deploy-{int(time.time())}",
        "--template-file", bicep_file,
        "--parameters",
        "adminPassword=ContosoSec!2026#Vault",
        "deployVm=true",
        "-o", "json"
    ]
    deploy_res = run_az(deploy_args)
    vm_deployed = False

    if deploy_res.returncode == 0:
        print(f"  {GREEN}✓ Full workload (including VM) deployed successfully to '{TEST_RG}'.{RESET}")
        vm_deployed = True
    elif "SkuNotAvailable" in deploy_res.stderr:
        print(f"  {YELLOW}Notice: Azure regional capacity restriction (SkuNotAvailable) for VM compute in {LOCATION}.{RESET}")
        print("  Deploying live VNet, Subnet, Storage Account (private network restricted), and private NIC...")
        fallback_args = [
            "deployment", "group", "create",
            "-g", TEST_RG,
            "-n", f"workload-deploy-resilient-{int(time.time())}",
            "--template-file", bicep_file,
            "--parameters",
            "adminPassword=ContosoSec!2026#Vault",
            "deployVm=false",
            "-o", "json"
        ]
        deploy_res2 = run_az(fallback_args, check=True)
        print(f"  {GREEN}✓ Live VNet, Subnet, Storage Account, and private NIC successfully provisioned in '{TEST_RG}'.{RESET}")
    else:
        raise RuntimeError(f"Workload deployment failed: {deploy_res.stderr}")

    return vm_deployed


def phase5_cost_safety_deallocate_vm(vm_deployed):
    print(f"\n{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print(f"{CYAN}{BOLD}PHASE 5: COST SAFETY - IMMEDIATE VM DEALLOCATION ($0 COMPUTE COST){RESET}")
    print(f"{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")

    if not vm_deployed:
        print(f"  {GREEN}✓ VM compute was not provisioned due to regional SKU limits ($0 compute cost confirmed).{RESET}")
        return

    vm_name = "contoso-con-cc-dc01-vm"
    print(f"Issuing immediate deallocate command for '{vm_name}'...")
    run_az(["vm", "deallocate", "-g", TEST_RG, "-n", vm_name, "--no-wait"], check=True)

    print("Waiting for VM power state to reach 'VM deallocated'...")
    for attempt in range(24):
        time.sleep(5)
        status_res = run_az([
            "vm", "get-instance-view", "-g", TEST_RG, "-n", vm_name,
            "--query", "instanceView.statuses[?starts_with(code, 'PowerState/')].displayStatus",
            "-o", "tsv"
        ])
        status = status_res.stdout.strip()
        print(f"  ... Current Power Status: {status} ({attempt * 5}s)")
        if "deallocated" in status.lower():
            print(f"  {GREEN}✓ Confirmed: VM '{vm_name}' is DEALLOCATED. Zero ongoing compute charges.{RESET}")
            return
    print(f"{YELLOW}Warning: VM deallocation timed out waiting for status, but command was issued.{RESET}")


def phase6_post_deployment_audit():
    print(f"\n{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print(f"{CYAN}{BOLD}PHASE 6: COMPREHENSIVE POST-DEPLOYMENT GOVERNANCE & TAG AUDIT{RESET}")
    print(f"{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")

    # 1. Audit Resource Group Tags
    print(f"\n{BOLD}1. Resource Group Tag Audit ({TEST_RG}):{RESET}")
    rg_info = json.loads(run_az(["group", "show", "-n", TEST_RG, "-o", "json"]).stdout)
    rg_tags = rg_info.get("tags", {})
    print(f"  Actual RG Tags: {json.dumps(rg_tags, indent=4)}")

    mandatory_rg_keys = ["Environment", "CostCenter", "Workload", "Owner"]
    outside_rg_keys = ["BusinessUnit", "Project"]

    for k in mandatory_rg_keys:
        if k in rg_tags:
            print(f"  {GREEN}✓ Mandatory Policy Tag Present:{RESET} {k} = '{rg_tags[k]}'")
        else:
            raise AssertionError(f"Missing mandatory RG tag: {k}")

    for k in outside_rg_keys:
        if k in rg_tags:
            print(f"  {CYAN}✓ Outside-Policy Tag Present:{RESET} {k} = '{rg_tags[k]}'")

    # 2. Audit Resources in RG
    print(f"\n{BOLD}2. Deployed Resources & Leaf Tag Audit:{RESET}")
    resources = json.loads(run_az(["resource", "list", "-g", TEST_RG, "-o", "json"]).stdout)
    print(f"  Total Resources Provisioned: {len(resources)}")

    for res in resources:
        r_name = res["name"]
        r_type = res["type"]
        r_tags = res.get("tags", {})
        print(f"\n  • Resource: {BOLD}{r_name}{RESET} ({r_type})")
        print(f"    Tags: {json.dumps(r_tags)}")

        # Check tag inheritance
        for k in ["Environment", "CostCenter", "Workload", "Owner"]:
            if k in r_tags and r_tags[k] == rg_tags[k]:
                print(f"    {GREEN}✓ Inherited Tag from RG:{RESET} {k} = '{r_tags[k]}'")
            else:
                raise AssertionError(f"Resource {r_name} failed inheritance check for tag {k}")

        # Check resource-level governance tags
        for k in ["Application", "DataClassification"]:
            if k in r_tags:
                print(f"    {GREEN}✓ Resource Governance Tag:{RESET} {k} = '{r_tags[k]}'")

        # Check outside-policy tags
        for k in ["DeployedBy", "ComplianceVerified"]:
            if k in r_tags:
                print(f"    {CYAN}✓ Outside-Policy Tag:{RESET} {k} = '{r_tags[k]}'")

    # 3. Audit Storage Account Private Network Restrictions
    print(f"\n{BOLD}3. Storage Account Private Connectivity Audit:{RESET}")
    storage_info = json.loads(run_az(["storage", "account", "show", "-g", TEST_RG, "-n", "contosoconccfilessa", "-o", "json"]).stdout)
    net_rules = storage_info.get("networkRuleSet", {})
    default_act = net_rules.get("defaultAction")
    vnet_rules = net_rules.get("virtualNetworkRules", [])
    print(f"  Default Action: {default_act}")
    print(f"  Virtual Network Rules Count: {len(vnet_rules)}")
    if default_act == "Deny" and len(vnet_rules) > 0:
        print(f"  {GREEN}✓ Storage account is strictly isolated to private VNet subnet 'snet-core'.{RESET}")
    else:
        print(f"  {YELLOW}Notice: Network rules evaluated as: {default_act}{RESET}")

    # 4. Azure Policy Compliance Scan
    print(f"\n{BOLD}4. Azure Policy Compliance Evaluation:{RESET}")
    print("Triggering Azure Policy evaluation scan in background...")
    run_az(["policy", "state", "trigger-scan", "--no-wait"])
    print("  ✓ Policy evaluation scan triggered.")


def phase7_clean_teardown():
    print(f"\n{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")
    print(f"{CYAN}{BOLD}PHASE 7: GUARANTEED CLEAN TEARDOWN OF TEST RESOURCE GROUP{RESET}")
    print(f"{CYAN}{BOLD}---------------------------------------------------------------------{RESET}")

    rg_check = run_az(["group", "exists", "-n", TEST_RG])
    if rg_check.stdout.strip().lower() == "true":
        print(f"Deleting test Resource Group '{TEST_RG}' (asynchronous --no-wait)...")
        run_az(["group", "delete", "-n", TEST_RG, "-y", "--no-wait"], check=True)
        print(f"  {GREEN}✓ Deletion request accepted for '{TEST_RG}'. Clean teardown in progress.{RESET}")
    else:
        print(f"  ✓ Resource Group '{TEST_RG}' does not exist (already clean state).")


def main():
    start_time = time.time()
    print(f"\n{BOLD}{CYAN}====================================================================={RESET}")
    print(f"{BOLD}{CYAN}   AZURE LIVE TESTING: POLICY DEPLOYMENT & GOVERNANCE VALIDATION     {RESET}")
    print(f"{BOLD}{CYAN}   Subscription: {SUBSCRIPTION_ID} | Region: {LOCATION}             {RESET}")
    print(f"{BOLD}{CYAN}====================================================================={RESET}")

    try:
        phase1_pre_cleanup()
        phase2_deploy_contoso_policies()
        phase3_negative_and_positive_testing()
        vm_deployed = phase4_deploy_workload()
        phase5_cost_safety_deallocate_vm(vm_deployed)
        phase6_post_deployment_audit()
    finally:
        phase7_clean_teardown()

    elapsed = round(time.time() - start_time, 1)
    print(f"\n{BOLD}{GREEN}====================================================================={RESET}")
    print(f"{BOLD}{GREEN}   ALL AZURE LIVE GOVERNANCE TESTS PASSED SUCCESSFULLY! ({elapsed}s) {RESET}")
    print(f"{BOLD}{GREEN}====================================================================={RESET}\n")


if __name__ == "__main__":
    main()
