"""
Sanitizer Engine for Azure Multi-Format IaC Exporter.

Loads declarative filtering and pruning rules from sanitizer_rules.json
and applies them across ARM templates, Bicep code, and Terraform configurations.
"""

import json
import logging
import re
from pathlib import Path

# Logger setup
logger = logging.getLogger("azure_iac_sanitizer")


class SanitizationEngine:
    """Evaluates declarative filtering rules against exported IaC templates."""

    DEFAULT_RULES = {
        "rules": [
            {
                "id": "law-prebuilt-tables",
                "enabled": True,
                "arm": {
                    "resourceType": "Microsoft.OperationalInsights/workspaces/tables",
                    "action": "prune",
                    "condition": {
                        "unless": {
                            "hasProperties": ["properties.schema.columns"],
                            "nameEndsWith": ["_CL", "_SRCH", "_RST"]
                        }
                    }
                },
                "bicep": {
                    "resourceType": "Microsoft.OperationalInsights/workspaces/tables",
                    "action": "prune",
                    "condition": {
                        "unless": {
                            "containsAny": ["columns:"],
                            "nameEndsWith": ["_CL", "_SRCH", "_RST"]
                        }
                    }
                },
                "terraform": {
                    "resourceType": "azurerm_log_analytics_workspace_table_custom_log",
                    "action": "prune",
                    "condition": {
                        "unless": {
                            "containsAny": ["column {", "column{"],
                            "nameEndsWith": ["_CL", "_SRCH", "_RST"]
                        }
                    }
                }
            },
            {
                "id": "terraform-duplicate-provider-blocks",
                "enabled": True,
                "terraform": {
                    "action": "strip_block_types",
                    "blockTypes": ["terraform", "provider"]
                }
            }
        ]
    }

    def __init__(self, rules_path=None):
        self.rules_path = Path(rules_path) if rules_path else Path(__file__).parent / "sanitizer_rules.json"
        self.rules = self._load_rules()

    def _load_rules(self):
        """Loads rules from JSON file with graceful fallback to default rules."""
        if self.rules_path.exists():
            try:
                with open(self.rules_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    rules = data.get("rules", [])
                    return [r for r in rules if r.get("enabled", True)]
            except Exception as ex:
                logger.warning(f"Failed to load sanitizer rules from {self.rules_path}: {ex}. Using built-in defaults.")
        else:
            logger.info(f"Rules file {self.rules_path} not found. Using built-in default rules.")
        
        return [r for r in self.DEFAULT_RULES["rules"] if r.get("enabled", True)]

    # -------------------------------------------------------------------------
    # Helper Functions
    # -------------------------------------------------------------------------
    @staticmethod
    def _get_nested(obj, path):
        """Retrieves a nested value from a dictionary using dot notation."""
        parts = path.split(".")
        current = obj
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return None
        return current

    @staticmethod
    def _extract_name_from_arm_name(name_expr):
        """Extracts simple name from ARM expressions like [concat(..., '/TableName')]."""
        s = str(name_expr).strip()
        if "/" in s:
            s = s.split("/")[-1]
        return s.rstrip("')]\" ")

    # -------------------------------------------------------------------------
    # ARM Template Sanitization
    # -------------------------------------------------------------------------
    def sanitize_arm(self, arm_data: dict) -> dict:
        """Sanitizes ARM template dictionary according to configured rules."""
        if not isinstance(arm_data, dict):
            return arm_data

        resources = arm_data.get("resources", [])
        clean_resources = []

        arm_rules = [r["arm"] for r in self.rules if "arm" in r]

        for res in resources:
            r_type = res.get("type", "")
            r_name = self._extract_name_from_arm_name(res.get("name", ""))
            should_prune = False

            for rule in arm_rules:
                target_type = rule.get("resourceType", "")
                if target_type and r_type.lower() != target_type.lower():
                    continue

                action = rule.get("action", "prune")
                condition = rule.get("condition", {})

                # Check "unless" conditions (if any is met, do NOT prune)
                unless_cond = condition.get("unless", {})
                escaped = False

                if "hasProperties" in unless_cond:
                    for prop_path in unless_cond["hasProperties"]:
                        val = self._get_nested(res, prop_path)
                        if val:  # exists and non-empty
                            escaped = True
                            break

                if not escaped and "nameEndsWith" in unless_cond:
                    for suffix in unless_cond["nameEndsWith"]:
                        if r_name.upper().endswith(suffix.upper()):
                            escaped = True
                            break

                if escaped:
                    continue

                # Check positive match conditions (if defined, must match)
                if "nameMatches" in condition:
                    patterns = condition["nameMatches"]
                    if not any(re.search(pat, r_name, re.IGNORECASE) for pat in patterns):
                        continue

                if action == "prune":
                    should_prune = True
                    break

            if not should_prune:
                clean_resources.append(res)

        arm_data["resources"] = clean_resources
        return arm_data

    # -------------------------------------------------------------------------
    # Bicep Code Sanitization
    # -------------------------------------------------------------------------
    def sanitize_bicep(self, bicep_code: str) -> str:
        """Sanitizes Bicep code according to configured rules."""
        if not bicep_code:
            return bicep_code

        bicep_rules = [r["bicep"] for r in self.rules if "bicep" in r]
        lines = bicep_code.splitlines()
        output_lines = []
        i = 0
        n = len(lines)

        res_pattern = re.compile(r"^\s*resource\s+[A-Za-z0-9_]+\s+'([^@']+)(?:@[^']+)?'\s*=\s*\{")

        while i < n:
            line = lines[i]
            match = res_pattern.match(line)

            if match:
                r_type = match.group(1)
                # Capture entire resource block
                block_lines = [line]
                brace_count = line.count("{") - line.count("}")
                i += 1
                while i < n and brace_count > 0:
                    b_line = lines[i]
                    brace_count += b_line.count("{") - b_line.count("}")
                    block_lines.append(b_line)
                    i += 1

                block_str = "\n".join(block_lines)
                name_match = re.search(r"name:\s*'([^']+)'", block_str)
                r_name = name_match.group(1) if name_match else ""

                should_prune = False
                for rule in bicep_rules:
                    target_type = rule.get("resourceType", "")
                    if target_type and r_type.lower() != target_type.lower():
                        continue

                    action = rule.get("action", "prune")
                    condition = rule.get("condition", {})
                    unless_cond = condition.get("unless", {})
                    escaped = False

                    if "containsAny" in unless_cond:
                        for token in unless_cond["containsAny"]:
                            if token in block_str:
                                escaped = True
                                break

                    if not escaped and "nameEndsWith" in unless_cond:
                        for suffix in unless_cond["nameEndsWith"]:
                            if r_name.upper().endswith(suffix.upper()):
                                escaped = True
                                break

                    if escaped:
                        continue

                    if "nameMatches" in condition:
                        patterns = condition["nameMatches"]
                        if not any(re.search(pat, r_name, re.IGNORECASE) for pat in patterns):
                            continue

                    if action == "prune":
                        should_prune = True
                        break

                if not should_prune:
                    output_lines.extend(block_lines)
                else:
                    # Skip trailing empty line if present
                    if i < n and lines[i].strip() == "":
                        i += 1
            else:
                output_lines.append(line)
                i += 1

        return "\n".join(output_lines)

    # -------------------------------------------------------------------------
    # Terraform HCL Sanitization
    # -------------------------------------------------------------------------
    def sanitize_terraform(self, terraform_code: str) -> str:
        """Sanitizes Terraform HCL code according to configured rules."""
        if not terraform_code:
            return terraform_code

        tf_rules = [r["terraform"] for r in self.rules if "terraform" in r]
        
        # Check for strip_block_types rules
        strip_types = set()
        for rule in tf_rules:
            if rule.get("action") == "strip_block_types":
                for b_type in rule.get("blockTypes", []):
                    strip_types.add(b_type)

        lines = terraform_code.splitlines()
        output_lines = []
        i = 0
        n = len(lines)

        res_pattern = re.compile(r'^\s*resource\s+"([^"]+)"\s+"([^"]+)"\s*\{')
        strip_pattern = re.compile(r'^\s*(?:' + "|".join(strip_types) + r')(?:|\s+"[^"]+")\s*\{') if strip_types else None

        while i < n:
            line = lines[i]

            # 1. Strip configured block types (e.g. top-level terraform {} or provider {})
            if strip_pattern and strip_pattern.match(line):
                brace_count = line.count("{") - line.count("}")
                i += 1
                while i < n and brace_count > 0:
                    b_line = lines[i]
                    brace_count += b_line.count("{") - b_line.count("}")
                    i += 1
                continue

            # 2. Check resource blocks
            res_match = res_pattern.match(line)
            if res_match:
                r_type = res_match.group(1)
                block_lines = [line]
                brace_count = line.count("{") - line.count("}")
                i += 1
                while i < n and brace_count > 0:
                    b_line = lines[i]
                    brace_count += b_line.count("{") - b_line.count("}")
                    block_lines.append(b_line)
                    i += 1

                block_str = "\n".join(block_lines)
                name_match = re.search(r'name\s*=\s*"([^"]+)"', block_str)
                r_name = name_match.group(1) if name_match else ""

                should_prune = False
                for rule in tf_rules:
                    target_type = rule.get("resourceType", "")
                    if target_type and r_type.lower() != target_type.lower():
                        continue

                    action = rule.get("action", "prune")
                    condition = rule.get("condition", {})
                    unless_cond = condition.get("unless", {})
                    escaped = False

                    if "containsAny" in unless_cond:
                        for token in unless_cond["containsAny"]:
                            if token in block_str:
                                escaped = True
                                break

                    if not escaped and "nameEndsWith" in unless_cond:
                        for suffix in unless_cond["nameEndsWith"]:
                            if r_name.upper().endswith(suffix.upper()):
                                escaped = True
                                break

                    if escaped:
                        continue

                    if "nameMatches" in condition:
                        patterns = condition["nameMatches"]
                        if not any(re.search(pat, r_name, re.IGNORECASE) for pat in patterns):
                            continue

                    if action == "prune":
                        should_prune = True
                        break

                if not should_prune:
                    output_lines.extend(block_lines)
                else:
                    if i < n and lines[i].strip() == "":
                        i += 1
            else:
                output_lines.append(line)
                i += 1

        return "\n".join(output_lines)
