import json
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
checks = 0


def run(package, script, expected_success):
    global checks
    result = subprocess.run(["python3", str(package / script)], capture_output=True, text=True)
    assert (result.returncode == 0) == expected_success, (script, result.stdout, result.stderr)
    checks += 1


def change(package, mutator):
    path = package / "config/customer.json"
    config = json.loads(path.read_text())
    mutator(config)
    path.write_text(json.dumps(config, indent=2) + "\n")


with tempfile.TemporaryDirectory() as directory:
    package = pathlib.Path(directory) / "package"
    shutil.copytree(ROOT, package)

    run(package, "tools/generate.py", True)
    run(package, "tests/offline.py", True)

    change(package, lambda config: config["typePurposes"].pop("kv"))
    run(package, "tools/generate.py", False)
    run(package, "tests/offline.py", False)
    assert not (package / "generated/main.json").exists()
    checks += 1

    change(package, lambda config: config["typePurposes"].update(kv=["core", "apps"]))
    run(package, "tools/generate.py", True)
    run(package, "tests/offline.py", True)

    change(package, lambda config: config["subnetNaming"].update(allowedNames=[]))
    run(package, "tools/generate.py", False)
    run(package, "tests/offline.py", False)

    change(package, lambda config: config["subnetNaming"].update(allowedNames=["snet-apps", "GatewaySubnet"]))
    run(package, "tools/generate.py", True)
    run(package, "tests/offline.py", True)

    change(package, lambda config: config["subnetNaming"].update(allowedNames=["snet-apps", "SNET-APPS"]))
    run(package, "tools/generate.py", False)
    run(package, "tests/offline.py", False)

    change(package, lambda config: config["subnetNaming"].update(allowedNames=["snet-apps"], effect="Deny"))
    run(package, "tools/generate.py", True)
    run(package, "tests/offline.py", True)

    change(package, lambda config: config.update(displayName="CustomerName Updated"))
    run(package, "tests/offline.py", False)
    run(package, "tools/generate.py", True)
    run(package, "tests/offline.py", True)

    change(package, lambda config: config.update(organization="bad#prefix"))
    run(package, "tools/generate.py", False)
    run(package, "tests/offline.py", False)

    change(package, lambda config: config.update(organization="cust02", subscriptionCode="prda"))
    run(package, "tools/generate.py", True)
    run(package, "tests/offline.py", True)

    generated_template = package / "generated/main.json"
    generated_template.write_text(generated_template.read_text() + " ")
    run(package, "tests/offline.py", False)

print("PASS:", checks, "regression checks covering invalidation, stale artifacts, customer changes, and subnet configuration.")
