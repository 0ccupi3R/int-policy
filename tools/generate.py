import argparse
import hashlib
import json
import os
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
GENERATED = ROOT / "generated"
OUTPUTS = ["policies.json", "main.json", "parameters.json", "manifest.json", "validation.json"]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    os.replace(temporary, path)


def validate_token_list(config, key):
    values = config[key]
    if not values or any(not re.fullmatch(r"[a-z][a-z0-9]*", item) for item in values):
        raise ValueError(f"Invalid controlled token list: {key}")


def build_patterns(config, resource_types):
    organization = config["organization"].lower()
    subscription_code = config["subscriptionCode"]
    policy_prefix = config["policyPrefix"]

    if not re.fullmatch(r"[a-z][a-z0-9]{1,11}", organization):
        raise ValueError("organization must be 2-12 alphanumeric characters and start with a letter")
    if subscription_code not in ["con", "mgt", "idn", "sec", "dapl", "prda", "efi", "efa", "aia"]:
        raise ValueError("Unknown subscriptionCode")
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", policy_prefix):
        raise ValueError("Invalid policyPrefix")
    if config["effect"] not in ["Audit", "Deny", "Disabled"]:
        raise ValueError("Invalid effect")
    if config["enforcementMode"] not in ["Default", "DoNotEnforce"]:
        raise ValueError("Invalid enforcementMode")
    if config["regions"] != {"canadacentral": "cc", "canadaeast": "ce"}:
        raise ValueError("Only the reviewed Canada Central/Canada East mapping is supported")

    for key in ["purposes", "vmRoles", "storageComponents", "serverNames"]:
        validate_token_list(config, key)

    output = []
    for item in resource_types:
        purposes = config.get("typePurposes", {}).get(item["key"], config["purposes"])
        if not purposes or any(not re.fullmatch(r"[a-z][a-z0-9]*", purpose) for purpose in purposes):
            raise ValueError(f"Invalid typePurposes for {item['key']}")

        rules = []
        forbidden = []
        for location, region in config["regions"].items():
            base = f"{organization}-{subscription_code}-{region}"
            style = item["style"]
            abbreviation = item["abbreviation"]

            if style == "vm":
                patterns = [f"{base}-{role}##-vm" for role in config["vmRoles"]]
                forbidden += [f"{base}-{role}00-vm" for role in config["vmRoles"]]
            elif style == "nsg":
                patterns = [f"{base}-hub-vnet-nsg-{purpose}" for purpose in purposes]
            elif style == "server":
                patterns = [f"{base}-{server}-{abbreviation}" for server in config["serverNames"]]
            elif style == "lb":
                patterns = [f"{base}-{server}-{variant}" for server in config["serverNames"] for variant in ["lbi", "lbe"]]
            elif style == "gateway":
                patterns = [f"{base}-hub-vng-{variant}" for variant in ["vpn", "er"]]
            elif style == "storage":
                patterns = [f"{organization}{subscription_code}{region}{component}sa" for component in config["storageComponents"]]
            elif style == "compact":
                patterns = [f"{organization}{subscription_code}{region}{purpose}{abbreviation}" for purpose in purposes]
            else:
                patterns = [f"{base}-{purpose}-{abbreviation}" for purpose in purposes]

            for pattern in patterns:
                sample = pattern.replace("##", "01")
                if not item["minLength"] <= len(sample) <= item["maxLength"]:
                    raise ValueError(
                        f"{item['key']}: {sample!r} has {len(sample)} characters; "
                        f"allowed {item['minLength']}-{item['maxLength']}. No automatic truncation."
                    )
                if style in ["storage", "compact"] and not re.fullmatch(r"[a-z0-9]+", sample):
                    raise ValueError(f"{item['key']}: compact name contains invalid characters")
                if item["key"] == "kv" and ("--" in sample or not re.fullmatch(r"[a-z][a-z0-9-]*[a-z0-9]", sample)):
                    raise ValueError("Key Vault character constraint failed")
                rules.append({"location": location, "pattern": pattern})

        output.append({**item, "rules": rules, "forbiddenPatterns": forbidden})
    return output


def standard_policy_rule(item):
    allowed = {
        "anyOf": [
            {
                "allOf": [
                    {"field": "location", "equals": rule["location"]},
                    {"field": "name", "matchInsensitively": rule["pattern"]},
                ]
            }
            for rule in item["rules"]
        ]
    }
    invalid = [{"not": allowed}]
    if item["forbiddenPatterns"]:
        invalid.append({"anyOf": [{"field": "name", "matchInsensitively": name} for name in item["forbiddenPatterns"]]})
    return {
        "if": {
            "allOf": [
                {"field": "type", "equals": item["resourceType"]},
                {"anyOf": invalid},
            ]
        },
        "then": {"effect": "[[parameters('effect')]"},
    }


def subnet_policy_rule(allowed_names):
    return {
        "if": {
            "anyOf": [
                {
                    "allOf": [
                        {"field": "type", "equals": "Microsoft.Network/virtualNetworks/subnets"},
                        {"field": "name", "notIn": allowed_names},
                    ]
                },
                {
                    "allOf": [
                        {"field": "type", "equals": "Microsoft.Network/virtualNetworks"},
                        {
                            "count": {
                                "field": "Microsoft.Network/virtualNetworks/subnets[*]",
                                "where": {
                                    "field": "Microsoft.Network/virtualNetworks/subnets[*].name",
                                    "notIn": allowed_names,
                                },
                            },
                            "greater": 0,
                        },
                    ]
                },
            ]
        },
        "then": {"effect": "[[parameters('effect')]"},
    }


def policy_definition(config, name, display_suffix, source, rule):
    return {
        "type": "Microsoft.Authorization/policyDefinitions",
        "apiVersion": "2023-04-01",
        "name": name,
        "properties": {
            "displayName": f"{config['displayName']} naming - {display_suffix}",
            "description": source,
            "mode": "All",
            "metadata": {"category": "Naming", "version": "2.1.0"},
            "parameters": {
                "effect": {
                    "type": "String",
                    "allowedValues": ["Audit", "Deny", "Disabled"],
                    "defaultValue": "Audit",
                }
            },
            "policyRule": rule,
        },
    }


def build_template(config, items):
    prefix = config["policyPrefix"]
    resources = []
    references = []

    for item in items:
        name = f"{prefix}-{item['key']}"
        definition_id = f"[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '{name}')]"
        resources.append(policy_definition(config, name, item["key"], item["source"], standard_policy_rule(item)))
        references.append(
            {
                "policyDefinitionId": definition_id,
                "policyDefinitionReferenceId": item["key"],
                "parameters": {"effect": {"value": "[[parameters('effect')]"}},
            }
        )

    subnet_config = config["subnetNaming"]
    subnet_names = subnet_config["allowedNames"]
    if not subnet_names or any(not isinstance(name, str) or not name or len(name) > 80 or "/" in name for name in subnet_names):
        raise ValueError("Invalid subnetNaming.allowedNames")
    if len({name.lower() for name in subnet_names}) != len(subnet_names):
        raise ValueError("Duplicate subnet names are not allowed")
    if subnet_config["effect"] not in ["Audit", "Deny", "Disabled"]:
        raise ValueError("Invalid subnetNaming.effect")

    subnet_name = f"{prefix}-subnet"
    subnet_id = f"[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '{subnet_name}')]"
    resources.append(
        policy_definition(
            config,
            subnet_name,
            "subnet",
            "Proposed allowlist for standalone and inline subnet names; includes Azure reserved subnet names.",
            subnet_policy_rule(subnet_names),
        )
    )
    references.append(
        {
            "policyDefinitionId": subnet_id,
            "policyDefinitionReferenceId": "subnet",
            "parameters": {"effect": {"value": "[[parameters('subnetEffect')]"}},
        }
    )

    initiative_name = f"{prefix}-initiative"
    initiative_id = f"[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '{initiative_name}')]"
    resources.append(
        {
            "type": "Microsoft.Authorization/policySetDefinitions",
            "apiVersion": "2023-04-01",
            "name": initiative_name,
            "dependsOn": [reference["policyDefinitionId"] for reference in references],
            "properties": {
                "displayName": f"{config['displayName']} naming initiative",
                "description": "Type-specific naming rules. Subnet has an independent effect for safe rollout.",
                "metadata": {"category": "Naming", "version": "2.1.0"},
                "parameters": {
                    "effect": {
                        "type": "String",
                        "allowedValues": ["Audit", "Deny", "Disabled"],
                        "defaultValue": "Audit",
                    },
                    "subnetEffect": {
                        "type": "String",
                        "allowedValues": ["Audit", "Deny", "Disabled"],
                        "defaultValue": "Audit",
                    },
                },
                "policyDefinitions": references,
            },
        }
    )

    assignment_name = f"{prefix}-test"
    resources.append(
        {
            "type": "Microsoft.Authorization/policyAssignments",
            "apiVersion": "2023-04-01",
            "name": assignment_name,
            "dependsOn": [initiative_id],
            "properties": {
                "displayName": f"{config['displayName']} naming assignment",
                "description": "Customer naming assignment with separately controlled subnet rollout.",
                "policyDefinitionId": initiative_id,
                "enforcementMode": "[parameters('enforcementMode')]",
                "notScopes": "[parameters('notScopes')]",
                "parameters": {
                    "effect": {"value": "[parameters('effect')]"},
                    "subnetEffect": {"value": "[parameters('subnetEffect')]"},
                },
                "nonComplianceMessages": [
                    {"message": "Resource names must match the approved type-specific naming convention."},
                    {"message": "Subnet names must be in the approved allowlist.", "policyDefinitionReferenceId": "subnet"},
                ],
            },
        }
    )

    return {
        "$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
        "contentVersion": "2.1.0.0",
        "parameters": {
            "effect": {"type": "string", "defaultValue": "Audit", "allowedValues": ["Audit", "Deny", "Disabled"]},
            "subnetEffect": {"type": "string", "defaultValue": "Audit", "allowedValues": ["Audit", "Deny", "Disabled"]},
            "enforcementMode": {"type": "string", "defaultValue": "Default", "allowedValues": ["Default", "DoNotEnforce"]},
            "notScopes": {"type": "array", "defaultValue": []},
        },
        "resources": resources,
        "outputs": {
            "assignmentId": {
                "type": "string",
                "value": f"[subscriptionResourceId('Microsoft.Authorization/policyAssignments', '{assignment_name}')]",
            }
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=str(ROOT / "config/customer.json"))
    arguments = parser.parse_args()
    config_path = pathlib.Path(arguments.config).resolve()
    type_path = ROOT / "config/types.json"
    GENERATED.mkdir(exist_ok=True)

    for filename in OUTPUTS:
        (GENERATED / filename).unlink(missing_ok=True)

    config = json.loads(config_path.read_text())
    item_types = json.loads(type_path.read_text())
    items = build_patterns(config, item_types)
    template = build_template(config, items)
    policies = items + [
        {
            "key": "subnet",
            "resourceType": "Microsoft.Network/virtualNetworks/subnets",
            "abbreviation": "snet",
            "style": "allowlist-and-inline-array",
            "source": "Proposed allowlist with Azure reserved subnet names",
            "allowedNames": config["subnetNaming"]["allowedNames"],
            "rules": [],
            "forbiddenPatterns": [],
        }
    ]

    parameters = {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        "contentVersion": "2.1.0.0",
        "parameters": {
            "effect": {"value": config["effect"]},
            "subnetEffect": {"value": config["subnetNaming"]["effect"]},
            "enforcementMode": {"value": config["enforcementMode"]},
            "notScopes": {"value": config.get("notScopes", [])},
        },
    }

    write_json(GENERATED / "policies.json", policies)
    write_json(GENERATED / "main.json", template)
    write_json(GENERATED / "parameters.json", parameters)

    manifest = {
        "config": str(config_path.relative_to(ROOT)) if config_path.is_relative_to(ROOT) else str(config_path),
        "hashes": {
            "config": digest(config_path),
            "types": digest(type_path),
            "generator": digest(pathlib.Path(__file__)),
            "policies": digest(GENERATED / "policies.json"),
            "template": digest(GENERATED / "main.json"),
            "parameters": digest(GENERATED / "parameters.json"),
        },
    }
    write_json(GENERATED / "manifest.json", manifest)
    print(
        f"Generated {len(policies)} definitions for {config['displayName']} / {config['organization']}; "
        f"effect={config['effect']}; subnetEffect={config['subnetNaming']['effect']}; "
        f"enforcement={config['enforcementMode']}"
    )


if __name__ == "__main__":
    main()
