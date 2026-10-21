#!/usr/bin/env python3
"""
Azure Multi-Format Infrastructure-as-Code (IaC) Exporter
=========================================================
Extracts deployed Azure resources into ARM, Bicep, and Terraform templates
with dependency preservation, parameter files, state tracking, and 
hierarchical folder structure.

Supported Formats:
  1. ARM Templates (template.json + parameters.json)
  2. Bicep Templates (main.bicep + main.bicepparam)
  3. Terraform (main.tf + providers.tf + terraform.tfvars)

Modes:
  --scan       : Discover subscriptions, resource groups, and resource counts.
  --configure  : Interactive wizard with numbered selection (1, 2, 5...).
  --all        : Batch automated export across all subscriptions and RGs.
  Direct flags : --subscription, --resource-group, --format
"""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

from sanitizer import SanitizationEngine
import time

# ANSI color codes
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def log_info(msg):
    print(f"{CYAN}[INFO]{RESET} {msg}")


def log_success(msg):
    print(f"{GREEN}[SUCCESS]{RESET} {msg}")


def log_warn(msg):
    print(f"{YELLOW}[WARN]{RESET} {msg}")


def log_error(msg):
    print(f"{RED}[ERROR]{RESET} {msg}")


def log_section(title):
    print(f"\n{BOLD}{MAGENTA}{'='*60}{RESET}")
    print(f"{BOLD}{MAGENTA}{title.center(60)}{RESET}")
    print(f"{BOLD}{MAGENTA}{'='*60}{RESET}\n")


def run_az_command(cmd_args, capture_output=True, timeout=300):
    """Executes an Azure CLI command and returns parsed JSON or raw output."""
    full_cmd = ["az"] + cmd_args
    try:
        res = subprocess.run(
            full_cmd,
            stdout=subprocess.PIPE if capture_output else None,
            stderr=subprocess.PIPE if capture_output else None,
            text=True,
            timeout=timeout,
            check=False
        )
        if res.returncode != 0:
            err_msg = res.stderr.strip() if res.stderr else f"Exit code {res.returncode}"
            return False, err_msg
        
        output = res.stdout.strip() if res.stdout else ""
        return True, output
    except subprocess.TimeoutExpired:
        return False, f"Command timed out after {timeout} seconds."
    except Exception as ex:
        return False, str(ex)


def run_az_json(cmd_args, timeout=120):
    """Executes an Azure CLI command with JSON output and returns parsed dict/list."""
    args = cmd_args + ["-o", "json"]
    success, output = run_az_command(args, timeout=timeout)
    if not success:
        return None, output
    try:
        data = json.loads(output)
        return data, None
    except json.JSONDecodeError as err:
        return None, f"JSON parse error: {err}. Raw output: {output[:200]}"


class AzureAuthManager:
    """Manages Azure authentication using active CLI session or .env fallback."""

    def __init__(self, script_dir):
        self.script_dir = Path(script_dir)
        self.env_path = self.locate_env_file()

    def locate_env_file(self):
        """Locates .env in script directory or parent directories."""
        candidates = [
            self.script_dir / ".env",
            self.script_dir.parent / ".env",
            Path.cwd() / ".env"
        ]
        for p in candidates:
            if p.exists() and p.is_file():
                return p
        return None

    def load_env_variables(self):
        """Parses KEY=VALUE pairs from .env file."""
        env_vars = {}
        if not self.env_path:
            return env_vars
        with open(self.env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip("\"'")
        return env_vars

    def ensure_authenticated(self):
        """Ensures Azure CLI is logged in. Falls back to service principal in .env."""
        log_info("Checking Azure CLI authentication status...")
        data, err = run_az_json(["account", "show"])
        if data and "id" in data:
            user_info = data.get("user", {}).get("name", "Unknown")
            tenant_id = data.get("tenantId", "Unknown")
            sub_name = data.get("name", "Unknown")
            log_success(f"Authenticated as {BOLD}{user_info}{RESET}")
            log_info(f"Active Tenant: {tenant_id}")
            log_info(f"Default Subscription: {sub_name} ({data.get('id')})")
            return True, data

        log_warn("No active Azure CLI session found. Attempting .env service principal login...")
        env_vars = self.load_env_variables()
        app_id = env_vars.get("AZURE_APP_ID")
        secret = env_vars.get("AZURE_SECRET_ID")
        tenant = env_vars.get("AZURE_TENANT_ID")

        if not (app_id and secret and tenant):
            log_error("Could not authenticate. No active Azure session and .env is missing AZURE_APP_ID/AZURE_SECRET_ID/AZURE_TENANT_ID.")
            log_info("Please run 'az login' manually or provide credentials in .env.")
            return False, None

        log_info(f"Logging in with Service Principal {app_id} (Tenant: {tenant})...")
        success, out = run_az_command([
            "login", "--service-principal",
            "-u", app_id,
            "-p", secret,
            "--tenant", tenant
        ])
        if not success:
            log_error(f"Service principal login failed: {out}")
            return False, None

        data, _ = run_az_json(["account", "show"])
        log_success("Service Principal login successful!")
        return True, data


class StateManager:
    """Tracks state and checksums of exported resource groups to skip redundant exports."""

    def __init__(self, state_file_path):
        self.state_file = Path(state_file_path)
        self.state = self.load_state()

    def load_state(self):
        if self.state_file.exists():
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save_state(self):
        try:
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(self.state, f, indent=2)
        except Exception as ex:
            log_warn(f"Failed to persist state file: {ex}")

    def compute_rg_hash(self, resources):
        """Computes a deterministic hash of all resources in a resource group incorporating id, type, changedTime, tags, and etag."""
        fingerprints = []
        for r in sorted(resources, key=lambda x: x.get("id", "")):
            r_id = r.get("id", "")
            r_type = r.get("type", "")
            r_etag = r.get("etag", "")
            r_changed = r.get("changedTime", "")
            r_tags = json.dumps(r.get("tags") or {}, sort_keys=True)
            fingerprints.append(f"{r_id}:{r_type}:{r_changed}:{r_tags}:{r_etag}")
        combined = "|".join(fingerprints).encode("utf-8")
        return hashlib.sha256(combined).hexdigest()

    def is_rg_unchanged(self, sub_id, rg_name, current_hash):
        key = f"{sub_id}/{rg_name}"
        record = self.state.get(key)
        if not record:
            return False
        return record.get("hash") == current_hash

    def update_rg_state(self, sub_id, rg_name, current_hash, formats_exported, resource_count):
        key = f"{sub_id}/{rg_name}"
        self.state[key] = {
            "last_exported": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "hash": current_hash,
            "resource_count": resource_count,
            "formats": formats_exported
        }
        self.save_state()


class AzureIaCExporter:
    """Orchestrates scanning, user selection, and multi-format IaC exports."""

    def __init__(self, output_root="./exports", state_file="./.export_state.json", customer_name=None, rules_path=None):
        self.output_root = Path(output_root).resolve()
        self.state_mgr = StateManager(state_file)
        self.customer_name = customer_name
        self.sanitizer = SanitizationEngine(rules_path=rules_path)
        self.ensure_prerequisites()

    def ensure_prerequisites(self):
        """Validates required CLI tools and extensions."""
        # Check Bicep
        success, out = run_az_command(["bicep", "version"])
        if not success:
            log_warn("Azure CLI Bicep component missing. Installing...")
            run_az_command(["bicep", "install"])
        
        # Check Terraform extension
        success, out = run_az_command(["terraform", "--help"])
        if not success:
            log_warn("Azure CLI Terraform extension missing. Installing preview extension...")
            run_az_command(["extension", "add", "--name", "terraform", "-y"])

    def get_subscriptions(self):
        """Retrieves all accessible Azure subscriptions, placing current default first."""
        data, err = run_az_json(["account", "list"])
        if not data:
            log_error(f"Failed to fetch subscriptions: {err}")
            return []
        # Filter enabled subscriptions and sort default subscription first
        enabled = [s for s in data if s.get("state", "").lower() == "enabled"]
        return sorted(enabled, key=lambda s: not s.get("isDefault", False))

    def get_resource_groups(self, subscription_id):
        """Retrieves all resource groups for a subscription."""
        data, err = run_az_json(["group", "list", "--subscription", subscription_id])
        if not data:
            return []
        return sorted(data, key=lambda x: x.get("name", ""))

    def get_resources_in_rg(self, subscription_id, rg_name):
        """Retrieves resources within a resource group."""
        data, err = run_az_json([
            "resource", "list",
            "--subscription", subscription_id,
            "--resource-group", rg_name
        ])
        return data or []

    def sanitize_name(self, name):
        """Sanitizes strings for safe directory naming."""
        clean = re.sub(r'[\/\\:*?"<>|]', '_', name)
        return clean.strip()

    def resolve_customer_name(self, account_info):
        """Resolves the root customer/tenant directory name."""
        if self.customer_name:
            return self.sanitize_name(self.customer_name)
        
        tenant_display = account_info.get("tenantDisplayName")
        if tenant_display and tenant_display.strip():
            return self.sanitize_name(tenant_display)
        
        tenant_domain = account_info.get("tenantDefaultDomain")
        if tenant_domain and tenant_domain.strip():
            return self.sanitize_name(tenant_domain.split(".")[0])
        
        tenant_id = account_info.get("tenantId") or account_info.get("homeTenantId")
        if tenant_id:
            return f"Tenant_{tenant_id[:8]}"
        
        return "Customer_Default"

    # -------------------------------------------------------------------------
    # Mode: SCAN
    # -------------------------------------------------------------------------
    def run_scan(self):
        """Scans all subscriptions, RGs, and resources, producing an inventory report."""
        log_section("Azure Infrastructure Discovery Scan")
        subs = self.get_subscriptions()
        if not subs:
            log_error("No accessible subscriptions found.")
            return

        total_rgs = 0
        total_resources = 0
        inventory = {
            "scanned_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "subscriptions": []
        }

        print(f"{BOLD}Found {len(subs)} accessible subscription(s):{RESET}\n")

        for s_idx, sub in enumerate(subs, 1):
            sub_id = sub.get("id")
            sub_name = sub.get("name")
            log_info(f"[{s_idx}/{len(subs)}] Scanning Subscription: {BOLD}{sub_name}{RESET} ({sub_id})")
            
            rgs = self.get_resource_groups(sub_id)
            sub_entry = {
                "id": sub_id,
                "name": sub_name,
                "tenantId": sub.get("tenantId"),
                "resourceGroups": []
            }

            for rg in rgs:
                rg_name = rg.get("name")
                resources = self.get_resources_in_rg(sub_id, rg_name)
                res_count = len(resources)
                total_resources += res_count
                total_rgs += 1

                # Group by resource type
                types_summary = {}
                for r in resources:
                    t = r.get("type", "Unknown")
                    types_summary[t] = types_summary.get(t, 0) + 1

                sub_entry["resourceGroups"].append({
                    "name": rg_name,
                    "location": rg.get("location"),
                    "resourceCount": res_count,
                    "resourceTypes": types_summary
                })

                status_color = GREEN if res_count > 0 else DIM
                print(f"    - RG: {BOLD}{rg_name:<30}{RESET} [{status_color}{res_count:>3} resource(s){RESET}] ({rg.get('location')})")
                if res_count > 0 and len(types_summary) <= 4:
                    types_str = ", ".join(f"{k.split('/')[-1]}: {v}" for k, v in types_summary.items())
                    print(f"      {DIM}Types: {types_str}{RESET}")

            inventory["subscriptions"].append(sub_entry)

        inventory_file = Path("scan_inventory.json")
        with open(inventory_file, "w", encoding="utf-8") as f:
            json.dump(inventory, f, indent=2)

        log_section("Scan Complete")
        print(f"Total Subscriptions Scanned: {BOLD}{len(subs)}{RESET}")
        print(f"Total Resource Groups:       {BOLD}{total_rgs}{RESET}")
        print(f"Total Resources Discovered:  {BOLD}{total_resources}{RESET}")
        log_success(f"Inventory saved to {BOLD}{inventory_file.resolve()}{RESET}")

    # -------------------------------------------------------------------------
    # Mode: CONFIGURE (Interactive Wizard)
    # -------------------------------------------------------------------------
    def run_interactive_configure(self):
        """Interactive numbered selection wizard."""
        log_section("Azure IaC Exporter - Interactive Configuration")

        subs = self.get_subscriptions()
        if not subs:
            log_error("No subscriptions accessible.")
            return

        # 1. Select Subscriptions
        print(f"{BOLD}Select Subscriptions to Export:{RESET}")
        for idx, sub in enumerate(subs, 1):
            print(f"  [{BOLD}{idx}{RESET}] {sub.get('name')} {DIM}({sub.get('id')}){RESET}")
        print(f"  [{BOLD}A{RESET}] All Subscriptions")

        sub_choice = input(f"\nEnter choice (e.g. 1, 2 or A) [Default: 1]: ").strip()
        selected_subs = []
        if not sub_choice or sub_choice == "1":
            selected_subs = [subs[0]]
        elif sub_choice.upper() == "A":
            selected_subs = subs
        else:
            try:
                indices = [int(x.strip()) for x in sub_choice.split(",") if x.strip()]
                for i in indices:
                    if 1 <= i <= len(subs):
                        selected_subs.append(subs[i - 1])
            except ValueError:
                log_error("Invalid selection. Defaulting to first subscription.")
                selected_subs = [subs[0]]

        # 2. Select Resource Groups per Subscription
        targets = []
        for sub in selected_subs:
            sub_id = sub.get("id")
            sub_name = sub.get("name")
            print(f"\n{BOLD}Fetching Resource Groups for:{RESET} {CYAN}{sub_name}{RESET}...")
            rgs = self.get_resource_groups(sub_id)
            if not rgs:
                log_warn(f"No resource groups found in {sub_name}.")
                continue

            print(f"\nSelect Resource Groups in {BOLD}{sub_name}{RESET}:")
            for idx, rg in enumerate(rgs, 1):
                print(f"  [{BOLD}{idx}{RESET}] {rg.get('name')} {DIM}({rg.get('location')}){RESET}")
            print(f"  [{BOLD}A{RESET}] All Resource Groups in this subscription")

            rg_choice = input(f"\nEnter choice (e.g. 1, 2 or A) [Default: A]: ").strip()
            if not rg_choice or rg_choice.upper() == "A":
                for rg in rgs:
                    targets.append((sub, rg.get("name")))
            else:
                try:
                    indices = [int(x.strip()) for x in rg_choice.split(",") if x.strip()]
                    for i in indices:
                        if 1 <= i <= len(rgs):
                            targets.append((sub, rgs[i - 1].get("name")))
                except ValueError:
                    log_warn("Invalid RG selection. Selecting all.")
                    for rg in rgs:
                        targets.append((sub, rg.get("name")))

        if not targets:
            log_error("No target Resource Groups selected.")
            return

        # 3. Select Export Formats
        print(f"\n{BOLD}Select Export Format(s):{RESET}")
        print(f"  [{BOLD}1{RESET}] ARM Template (template.json + parameters.json)")
        print(f"  [{BOLD}2{RESET}] Bicep Template (main.bicep + main.bicepparam)")
        print(f"  [{BOLD}3{RESET}] Terraform (main.tf + providers.tf + terraform.tfvars)")
        print(f"  [{BOLD}4{RESET}] All Formats (ARM, Bicep, Terraform)")

        fmt_choice = input(f"\nEnter choice [Default: 4]: ").strip()
        format_map = {
            "1": ["arm"],
            "2": ["bicep"],
            "3": ["terraform"],
            "4": ["arm", "bicep", "terraform"]
        }
        chosen_formats = format_map.get(fmt_choice, ["arm", "bicep", "terraform"])

        # 4. Confirmation
        print(f"\n{BOLD}Export Summary:{RESET}")
        print(f"  Target RGs: {len(targets)}")
        print(f"  Formats:    {', '.join(f.upper() for f in chosen_formats)}")
        print(f"  Output Dir: {self.output_root}")
        
        confirm = input(f"\nProceed with export? (Y/n): ").strip()
        if confirm and confirm.lower() != "y":
            log_info("Export aborted by user.")
            return

        # Execute Export
        self.export_targets(targets, chosen_formats)

    # -------------------------------------------------------------------------
    # Core Exporter Engine
    # -------------------------------------------------------------------------
    def export_targets(self, targets, formats, skip_unchanged=False, force=False):
        """Exports a list of (subscription_dict, rg_name) tuples for selected formats."""
        log_section(f"Starting Export of {len(targets)} Resource Group(s)")
        
        success_count = 0
        skipped_count = 0
        error_count = 0

        for idx, (sub, rg_name) in enumerate(targets, 1):
            sub_id = sub.get("id")
            sub_name = sub.get("name")
            customer_dir_name = self.resolve_customer_name(sub)
            sub_dir_name = self.sanitize_name(sub_name)
            rg_dir_name = self.sanitize_name(rg_name)

            dest_dir = self.output_root / customer_dir_name / sub_dir_name / rg_dir_name
            log_info(f"[{idx}/{len(targets)}] Processing: {BOLD}{rg_name}{RESET} in {sub_name}")

            # Check resources and hash for state tracking
            resources = self.get_resources_in_rg(sub_id, rg_name)
            current_hash = self.state_mgr.compute_rg_hash(resources)

            if skip_unchanged and not force and self.state_mgr.is_rg_unchanged(sub_id, rg_name, current_hash):
                log_info(f"Skipping {rg_name}: Unchanged since last export (hash match).")
                skipped_count += 1
                continue

            dest_dir.mkdir(parents=True, exist_ok=True)
            exported_formats = []

            # 1. Export ARM
            if "arm" in formats:
                arm_ok = self.export_arm(sub_id, rg_name, dest_dir / "arm")
                if arm_ok:
                    exported_formats.append("arm")

            # 2. Export Bicep
            if "bicep" in formats:
                bicep_ok = self.export_bicep(sub_id, rg_name, dest_dir / "bicep")
                if bicep_ok:
                    exported_formats.append("bicep")

            # 3. Export Terraform
            if "terraform" in formats:
                tf_ok = self.export_terraform(sub_id, rg_name, dest_dir / "terraform")
                if tf_ok:
                    exported_formats.append("terraform")

            # 4. Generate Metadata & Dependency Summary
            self.generate_rg_metadata(dest_dir, sub, rg_name, resources, exported_formats)

            if exported_formats:
                success_count += 1
                self.state_mgr.update_rg_state(sub_id, rg_name, current_hash, exported_formats, len(resources))
                log_success(f"Saved {rg_name} -> {dest_dir} [{', '.join(exported_formats)}]")
            else:
                error_count += 1
                log_error(f"Failed to export templates for {rg_name}")

        log_section("Export Completed")
        print(f"Successfully Exported: {BOLD}{success_count}{RESET}")
        print(f"Skipped (Unchanged):   {BOLD}{skipped_count}{RESET}")
        print(f"Failed / Errors:       {BOLD}{error_count}{RESET}")
        print(f"Output Directory:      {BOLD}{self.output_root.resolve()}{RESET}\n")

    def export_arm(self, sub_id, rg_name, target_dir):
        """Exports ARM JSON template and generates parameter file."""
        target_dir.mkdir(parents=True, exist_ok=True)
        template_file = target_dir / "template.json"
        params_file = target_dir / "parameters.json"

        cmd = [
            "group", "export",
            "--subscription", sub_id,
            "--name", rg_name,
            "--export-format", "json",
            "--include-parameter-default-value"
        ]
        success, out = run_az_command(cmd, timeout=300)
        if not success:
            log_error(f"ARM export failed for {rg_name}: {out[:150]}")
            return False

        try:
            arm_data = json.loads(out)
            arm_data = self.sanitize_arm_template(arm_data)

            # Pretty print ARM template
            with open(template_file, "w", encoding="utf-8") as f:
                json.dump(arm_data, f, indent=2)

            # Generate parameters.json
            params_spec = arm_data.get("parameters", {})
            param_values = {}
            for p_name, p_meta in params_spec.items():
                val = p_meta.get("defaultValue", "")
                param_values[p_name] = {"value": val}

            deployment_parameters = {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": param_values
            }
            with open(params_file, "w", encoding="utf-8") as f:
                json.dump(deployment_parameters, f, indent=2)

            return True
        except Exception as ex:
            log_error(f"Failed to process ARM template for {rg_name}: {ex}")
            return False

    def sanitize_arm_template(self, arm_data: dict) -> dict:
        """Sanitizes ARM template JSON using declarative SanitizationEngine."""
        return self.sanitizer.sanitize_arm(arm_data)

    def export_bicep(self, sub_id, rg_name, target_dir):
        """Exports Bicep file and generates .bicepparam file."""
        target_dir.mkdir(parents=True, exist_ok=True)
        bicep_file = target_dir / "main.bicep"
        param_file = target_dir / "main.bicepparam"

        cmd = [
            "group", "export",
            "--subscription", sub_id,
            "--name", rg_name,
            "--export-format", "bicep",
            "--include-parameter-default-value"
        ]
        success, out = run_az_command(cmd, timeout=300)
        if not success:
            log_error(f"Bicep export failed for {rg_name}: {out[:150]}")
            return False

        try:
            bicep_code = out.strip()
            # az group export returns a JSON-encoded string in stdout
            if bicep_code.startswith('"') and bicep_code.endswith('"'):
                try:
                    bicep_code = json.loads(bicep_code)
                except Exception:
                    pass

            bicep_code = self.sanitize_bicep_config(bicep_code)

            with open(bicep_file, "w", encoding="utf-8") as f:
                f.write(bicep_code)

            # Try generating main.bicepparam using native az bicep generate-params
            gen_cmd = [
                "bicep", "generate-params",
                "--file", str(bicep_file),
                "--output-format", "bicepparam",
                "--outfile", str(param_file),
                "--include-params", "all"
            ]
            gen_ok, _ = run_az_command(gen_cmd, timeout=60)

            # If CLI generation failed (e.g. 800 resource linter limit), parse params directly
            if not param_file.exists() or param_file.stat().st_size == 0:
                param_lines = [f"using 'main.bicep'\n"]
                param_regex = re.compile(r"^param\s+([A-Za-z0-9_]+)\s+[A-Za-z0-9_\[\]]+\s*(?:=\s*(.+))?")
                for line in bicep_code.splitlines():
                    match = param_regex.match(line.strip())
                    if match:
                        p_name = match.group(1)
                        p_default = match.group(2) or "''"
                        param_lines.append(f"param {p_name} = {p_default}")
                with open(param_file, "w", encoding="utf-8") as f:
                    f.write("\n".join(param_lines) + "\n")

            return True
        except Exception as ex:
            log_error(f"Failed to write Bicep files for {rg_name}: {ex}")
            return False

    def sanitize_bicep_config(self, bicep_code: str) -> str:
        """Sanitizes Bicep template code using declarative SanitizationEngine."""
        return self.sanitizer.sanitize_bicep(bicep_code)

    def sanitize_terraform_config(self, config_text: str) -> str:
        """Sanitizes Terraform HCL configuration using declarative SanitizationEngine."""
        return self.sanitizer.sanitize_terraform(config_text)

    def export_terraform(self, sub_id, rg_name, target_dir):
        """Exports Terraform configuration using az terraform extension."""
        target_dir.mkdir(parents=True, exist_ok=True)
        main_tf = target_dir / "main.tf"
        providers_tf = target_dir / "providers.tf"
        tfvars_file = target_dir / "terraform.tfvars"

        cmd = [
            "terraform", "export-terraform",
            "--subscription", sub_id,
            "--export-resource-group", f"{{resource-group-name:{rg_name}}}",
            "--target-provider", "azurerm",
            "-o", "json"
        ]
        success, out = run_az_command(cmd, timeout=300)
        if not success:
            log_error(f"Terraform export failed for {rg_name}: {out[:150]}")
            return False

        try:
            data = json.loads(out)
            config_text = data.get("properties", {}).get("configuration", "")
            if not config_text:
                log_warn(f"No Terraform configuration returned for {rg_name}.")
                return False

            # Sanitize exported configuration to fix incomplete schema blocks
            sanitized_config = self.sanitize_terraform_config(config_text)

            # Write exported configuration
            with open(main_tf, "w", encoding="utf-8") as f:
                f.write(sanitized_config)

            # Create default providers.tf
            with open(providers_tf, "w", encoding="utf-8") as f:
                f.write('terraform {\n  required_providers {\n    azurerm = {\n      source  = "hashicorp/azurerm"\n      version = "~> 4.0"\n    }\n  }\n}\n\nprovider "azurerm" {\n  features {}\n}\n')

            # Create sample terraform.tfvars
            with open(tfvars_file, "w", encoding="utf-8") as f:
                f.write(f'# Terraform Variables for {rg_name}\n# Generated: {datetime.datetime.now(datetime.timezone.utc).isoformat()}\nresource_group_name = "{rg_name}"\n')

            return True
        except Exception as ex:
            log_error(f"Failed to parse Terraform output for {rg_name}: {ex}")
            return False

    def generate_rg_metadata(self, dest_dir, sub, rg_name, resources, formats):
        """Generates metadata.json summarizing the RG, resources, dependencies, and redeployment notes."""
        metadata_file = dest_dir / "metadata.json"
        
        # Analyze dependency roles
        categories = {
            "observability": [],
            "networking": [],
            "compute": [],
            "security": [],
            "other": []
        }
        for r in resources:
            r_type = r.get("type", "").lower()
            name = r.get("name")
            if "operationalinsights" in r_type or "insights" in r_type:
                categories["observability"].append(name)
            elif "virtualnetworks" in r_type or "subnets" in r_type or "publicip" in r_type:
                categories["networking"].append(name)
            elif "virtualmachines" in r_type or "disks" in r_type or "networkinterfaces" in r_type:
                categories["compute"].append(name)
            elif "networksecuritygroups" in r_type or "vaults" in r_type:
                categories["security"].append(name)
            else:
                categories["other"].append(name)

        meta = {
            "resourceGroup": rg_name,
            "subscription": {
                "id": sub.get("id"),
                "name": sub.get("name"),
                "tenantId": sub.get("tenantId")
            },
            "exportedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "formatsExported": formats,
            "totalResources": len(resources),
            "dependencyCategorization": categories,
            "redeploymentSequencing": [
                "1. Foundations / Observability (Log Analytics, Key Vaults)",
                "2. Network Infrastructure (NSGs, VNet, Subnets, Public IPs)",
                "3. Workload Compute (NICs, Disks, Virtual Machines)",
                "4. Extensions & Diagnostics (AMA, Monitoring extensions)"
            ],
            "resources": [
                {
                    "name": r.get("name"),
                    "type": r.get("type"),
                    "location": r.get("location"),
                    "id": r.get("id")
                }
                for r in resources
            ]
        }
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Azure Multi-Format IaC Exporter (ARM, Bicep, Terraform)",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--scan", action="store_true", help="Scan and list all accessible subscriptions, RGs, and resources.")
    parser.add_argument("--configure", action="store_true", help="Launch interactive numbered selection wizard.")
    parser.add_argument("--all", action="store_true", help="Export all resource groups across all accessible subscriptions.")
    parser.add_argument("--subscription", type=str, help="Specific subscription ID or name to target.")
    parser.add_argument("--resource-group", "-g", type=str, help="Specific resource group name to target.")
    parser.add_argument("--format", choices=["arm", "bicep", "terraform", "all"], default="all", help="IaC format to export (default: all).")
    parser.add_argument("--output-dir", "-o", type=str, default="./exports", help="Root directory for exported templates.")
    parser.add_argument("--customer-name", type=str, help="Custom top-level folder name (defaults to Tenant Name or ID).")
    parser.add_argument("--state-file", type=str, default="./.export_state.json", help="Path to state tracking JSON file.")
    parser.add_argument("--skip-unchanged", action="store_true", help="Skip export if resource group resources have not changed.")
    parser.add_argument("--force", action="store_true", help="Force export and overwrite state cache.")
    parser.add_argument("--rules", type=str, default=None, help="Path to declarative sanitizer rules JSON file.")

    args = parser.parse_args()

    # Authenticate
    script_dir = Path(__file__).resolve().parent
    auth_mgr = AzureAuthManager(script_dir)
    auth_ok, active_account = auth_mgr.ensure_authenticated()
    if not auth_ok:
        sys.exit(1)

    exporter = AzureIaCExporter(
        output_root=args.output_dir,
        state_file=args.state_file,
        customer_name=args.customer_name,
        rules_path=args.rules
    )

    # 1. SCAN MODE
    if args.scan:
        exporter.run_scan()
        return

    # 2. CONFIGURE MODE
    if args.configure:
        exporter.run_interactive_configure()
        return

    # 3. DIRECT OR ALL MODE
    formats = ["arm", "bicep", "terraform"] if args.format == "all" else [args.format]

    subs = exporter.get_subscriptions()
    if not subs:
        log_error("No subscriptions found.")
        sys.exit(1)

    # Filter subscription if specified
    if args.subscription:
        sub_query = args.subscription.lower()
        matched_subs = [s for s in subs if s.get("id").lower() == sub_query or s.get("name", "").lower() == sub_query]
        if not matched_subs:
            log_error(f"Subscription '{args.subscription}' not found.")
            sys.exit(1)
        target_subs = matched_subs
    elif args.all:
        target_subs = subs
    elif args.resource_group:
        # Auto-discover which subscription contains the requested resource group
        found_sub = None
        for s in subs:
            rgs = exporter.get_resource_groups(s.get("id"))
            if any(rg.get("name", "").lower() == args.resource_group.lower() for rg in rgs):
                found_sub = s
                break
        if not found_sub:
            log_error(f"Resource group '{args.resource_group}' was not found in any accessible subscription.")
            sys.exit(1)
        target_subs = [found_sub]
    else:
        target_subs = [subs[0]]

    targets = []
    for s in target_subs:
        s_id = s.get("id")
        rgs = exporter.get_resource_groups(s_id)
        if args.resource_group:
            matching_rg = next((rg.get("name") for rg in rgs if rg.get("name", "").lower() == args.resource_group.lower()), None)
            if not matching_rg:
                log_error(f"Resource group '{args.resource_group}' does not exist in subscription '{s.get('name')}'.")
                sys.exit(1)
            targets.append((s, matching_rg))
        else:
            for rg in rgs:
                targets.append((s, rg.get("name")))

    if not targets:
        log_warn("No resource groups to export.")
        return

    exporter.export_targets(targets, formats, skip_unchanged=args.skip_unchanged, force=args.force)


if __name__ == "__main__":
    main()
