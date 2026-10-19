import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
GENERATED = ROOT / "generated"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_manifest():
    (GENERATED / "validation.json").unlink(missing_ok=True)
    manifest_path = GENERATED / "manifest.json"
    if not manifest_path.exists():
        raise ValueError("No successful generation. Run tools/generate.py first.")
    manifest = json.loads(manifest_path.read_text())
    config_path = pathlib.Path(manifest["config"])
    if not config_path.is_absolute():
        config_path = ROOT / config_path
    paths = {
        "config": config_path,
        "types": ROOT / "config/types.json",
        "generator": ROOT / "tools/generate.py",
        "policies": GENERATED / "policies.json",
        "template": GENERATED / "main.json",
        "parameters": GENERATED / "parameters.json",
    }
    for key, path in paths.items():
        if not path.exists() or digest(path) != manifest["hashes"][key]:
            raise ValueError(f"Stale or modified generated artifact: {key}")
    return json.loads(config_path.read_text())


def policy_match(value, pattern):
    expression = "".join(
        "[0-9]" if character == "#" else "[A-Za-z]" if character == "?" else "." if character == "." else re.escape(character)
        for character in pattern
    )
    return re.fullmatch(expression, value, re.IGNORECASE) is not None


def evaluate(condition, resource, member=None):
    if "allOf" in condition:
        return all(evaluate(item, resource, member) for item in condition["allOf"])
    if "anyOf" in condition:
        return any(evaluate(item, resource, member) for item in condition["anyOf"])
    if "not" in condition:
        return not evaluate(condition["not"], resource, member)
    if "count" in condition:
        values = resource.get("subnets", [])
        count = sum(evaluate(condition["count"]["where"], resource, item) for item in values)
        return count > condition["greater"]

    field = condition["field"]
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
    raise ValueError(f"Unsupported local test condition: {condition}")


def main():
    config = verify_manifest()
    template = json.loads((GENERATED / "main.json").read_text())
    policies = json.loads((GENERATED / "policies.json").read_text())
    definitions = {
        resource["name"]: resource
        for resource in template["resources"]
        if resource["type"] == "Microsoft.Authorization/policyDefinitions"
    }
    standard_items = [item for item in policies if item["key"] != "subnet"]
    assertion_count = 0

    def expect(item, name, location, noncompliant, resource_type=None):
        nonlocal assertion_count
        definition = definitions[f"{config['policyPrefix']}-{item['key']}"]
        rule = definition["properties"]["policyRule"]["if"]
        actual = evaluate(rule, {"name": name, "location": location, "type": resource_type or item["resourceType"]})
        assert actual == noncompliant, (item["key"], name, location, actual, noncompliant)
        assertion_count += 1

    for item in standard_items:
        for rule in item["rules"]:
            name = rule["pattern"].replace("##", "01")
            expect(item, name, rule["location"], False)
            expect(item, name + "-extra", rule["location"], True)
            expect(item, name, "eastus", True)
            expect(item, name, rule["location"], False, "Microsoft.Test/uncovered")
            expect(item, name.upper(), rule["location"], False)
            opposite = "canadaeast" if rule["location"] == "canadacentral" else "canadacentral"
            expect(item, name, opposite, True)
        for forbidden in item["forbiddenPatterns"]:
            location = "canadacentral" if "-cc-" in forbidden else "canadaeast"
            expect(item, forbidden, location, True)

    vm = next(item for item in standard_items if item["key"] == "vm")
    for rule in vm["rules"]:
        for number in range(1, 100):
            expect(vm, rule["pattern"].replace("##", str(number).zfill(2)), rule["location"], False)
        for number in ["00", "001", "a1", "1", "100"]:
            expect(vm, rule["pattern"].replace("##", number), rule["location"], True)

    subnet_definition = definitions[f"{config['policyPrefix']}-subnet"]
    subnet_rule = subnet_definition["properties"]["policyRule"]["if"]
    allowed_names = config["subnetNaming"]["allowedNames"]
    for name in allowed_names:
        assert not evaluate(subnet_rule, {"type": "Microsoft.Network/virtualNetworks/subnets", "name": name})
        assertion_count += 1
        assert not evaluate(subnet_rule, {"type": "Microsoft.Network/virtualNetworks", "name": "vnet", "subnets": [name]})
        assertion_count += 1
    assert evaluate(subnet_rule, {"type": "Microsoft.Network/virtualNetworks/subnets", "name": "invalid-subnet"})
    assertion_count += 1
    assert evaluate(subnet_rule, {"type": "Microsoft.Network/virtualNetworks", "name": "vnet", "subnets": [allowed_names[0], "invalid-subnet"]})
    assertion_count += 1
    assert not evaluate(subnet_rule, {"type": "Microsoft.Network/virtualNetworks", "name": "vnet", "subnets": []})
    assertion_count += 1
    assert not evaluate(subnet_rule, {"type": "Microsoft.Compute/virtualMachines", "name": "invalid-subnet"})
    assertion_count += 1

    initiative = next(resource for resource in template["resources"] if resource["type"] == "Microsoft.Authorization/policySetDefinitions")
    assignment = next(resource for resource in template["resources"] if resource["type"] == "Microsoft.Authorization/policyAssignments")
    subnet_reference = next(reference for reference in initiative["properties"]["policyDefinitions"] if reference["policyDefinitionReferenceId"] == "subnet")

    assert len(definitions) == len(policies) == 26
    assert len(template["resources"]) == 28
    assert len(initiative["properties"]["policyDefinitions"]) == 26
    assert subnet_reference["parameters"]["effect"]["value"] == "[[parameters('subnetEffect')]"
    assert assignment["properties"]["parameters"]["subnetEffect"]["value"] == "[parameters('subnetEffect')]"
    assert template["parameters"]["effect"]["defaultValue"] == "Audit"
    assert template["parameters"]["subnetEffect"]["defaultValue"] == "Audit"
    for definition in definitions.values():
        assert definition["properties"]["policyRule"]["then"]["effect"] == "[[parameters('effect')]"

    parameters = json.loads((GENERATED / "parameters.json").read_text())
    assert parameters["parameters"]["effect"]["value"] == config["effect"]
    assert parameters["parameters"]["subnetEffect"]["value"] == config["subnetNaming"]["effect"]

    report = {
        "localAssertions": assertion_count,
        "definitions": len(definitions),
        "deploymentResources": len(template["resources"]),
        "status": "passed",
        "configuration": {
            "displayName": config["displayName"],
            "organization": config["organization"],
            "effect": config["effect"],
            "subnetEffect": config["subnetNaming"]["effect"],
            "enforcementMode": config["enforcementMode"],
        },
        "bicepCompiled": False,
        "azureValidated": False,
        "azureDeployed": False,
        "note": "Local tests evaluate generated condition trees; Azure validation remains required.",
    }
    (GENERATED / "validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        (GENERATED / "validation.json").unlink(missing_ok=True)
        print("FAIL:", str(error), file=sys.stderr)
        sys.exit(1)
