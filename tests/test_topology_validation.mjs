import assert from "node:assert";
import {
  validateSubscriptionInput,
  validateResourceGroupInput,
  validateResourceInput,
  getNextAvailableInstance,
  getAirGateDefaultPlatformTopology
} from "../portal/src/engine/topologyGenerator.js";
import { AZURE_RESOURCE_CATALOG } from "../portal/src/data/azureResourceCatalog.js";
import { DEFAULT_CUSTOMERS } from "../portal/src/data/defaultCustomers.js";

const sampleCustomer = JSON.parse(JSON.stringify(DEFAULT_CUSTOMERS[0]));
sampleCustomer.topology = getAirGateDefaultPlatformTopology(sampleCustomer);

console.log("🧪 Testing Topology Validation & Duplicate Prevention Suite...");

// -----------------------------------------------------------------------------
// Test 1: Subscription Validation & Duplicate Checks
// -----------------------------------------------------------------------------
{
  const existingSubs = sampleCustomer.topology.subscriptions;

  // 1.1 Valid Subscription
  const validRes = validateSubscriptionInput(
    { name: "Workload-Analytics", code: "WLA", environment: "prod", location: "canadacentral" },
    existingSubs
  );
  assert.strictEqual(validRes.valid, true, "Valid subscription should pass");
  assert.strictEqual(validRes.isDuplicate, false);
  assert.strictEqual(validRes.sanitized.code, "WLA");

  // 1.2 Duplicate Name
  const dupNameRes = validateSubscriptionInput(
    { name: "Connectivity", code: "NEW", environment: "prod", location: "canadacentral" },
    existingSubs
  );
  assert.strictEqual(dupNameRes.valid, false, "Duplicate subscription name should fail");
  assert.strictEqual(dupNameRes.isDuplicate, true);
  assert.ok(dupNameRes.duplicateError.includes("Connectivity"));

  // 1.3 Duplicate Code
  const dupCodeRes = validateSubscriptionInput(
    { name: "New Sub", code: "CON", environment: "prod", location: "canadacentral" },
    existingSubs
  );
  assert.strictEqual(dupCodeRes.valid, false, "Duplicate subscription code should fail");
  assert.strictEqual(dupCodeRes.isDuplicate, true);
  assert.ok(dupCodeRes.duplicateError.includes("CON"));

  // 1.4 Invalid Characters & Length
  const invalidNameRes = validateSubscriptionInput(
    { name: ".Invalid#Name.", code: "C", environment: "prod", location: "canadacentral" },
    existingSubs
  );
  assert.strictEqual(invalidNameRes.valid, false);
  assert.ok(invalidNameRes.errors.length >= 2, "Should report name and code errors");

  console.log("  ✅ Test 1: Subscription validation & duplicate checks passed.");
}

// -----------------------------------------------------------------------------
// Test 2: Resource Group Validation & Duplicate Checks
// -----------------------------------------------------------------------------
{
  const activeSub = sampleCustomer.topology.subscriptions[0]; // Connectivity (CON)

  // 2.1 Valid Unique RG
  const validRgRes = validateResourceGroupInput(
    { purpose: "monitoring", location: "canadacentral" },
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(validRgRes.valid, true, "Unique RG should be valid");
  assert.strictEqual(validRgRes.isDuplicate, false);
  assert.ok(validRgRes.evaluatedName.includes("monitoring"));

  // 2.2 Duplicate RG in Same Subscription
  // activeSub already has 'hub' RG
  const dupRgRes = validateResourceGroupInput(
    { purpose: "hub", location: "canadacentral" },
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(dupRgRes.valid, false, "Duplicate RG in same subscription must fail");
  assert.strictEqual(dupRgRes.isDuplicate, true);
  assert.ok(dupRgRes.duplicateError.includes("already exists in subscription"));

  // 2.3 Invalid RG Name Constraints (e.g. trailing period)
  const invalidRgRes = validateResourceGroupInput(
    { purpose: "core", name: "invalid-rg-ending-with-dot." },
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(invalidRgRes.valid, false);
  assert.ok(invalidRgRes.errors.some((e) => e.includes("period")));

  console.log("  ✅ Test 2: Resource Group validation & duplicate checks passed.");
}

// -----------------------------------------------------------------------------
// Test 3: Resource Validation, Constraints & Duplicate Checks
// -----------------------------------------------------------------------------
{
  const activeSub = sampleCustomer.topology.subscriptions[0]; // Connectivity
  const hubRg = activeSub.resourceGroups[0]; // rg-hub has vnet, nsg, fw, gw, bas

  // 3.1 Next Available Instance
  const nextVnetInst = getNextAvailableInstance(hubRg, "vnet", "hub");
  // hubRg has instance "01" for vnet
  assert.strictEqual(nextVnetInst, "02", "Next available instance for vnet should be '02'");

  // 3.2 Duplicate Resource in same RG
  const dupRes = validateResourceInput(
    { resourceTypeKey: "vnet", purpose: "hub", instance: "01" },
    hubRg,
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(dupRes.valid, false, "Duplicate resource in same RG should fail");
  assert.strictEqual(dupRes.isDuplicate, true);
  assert.ok(dupRes.duplicateError.includes("already exists in Resource Group"));
  assert.strictEqual(dupRes.nextSuggestedInstance, "02", "Should suggest 02 as next instance");

  // 3.3 Unique Resource type not currently in hubRg
  const validPipRes = validateResourceInput(
    { resourceTypeKey: "pip", purpose: "hub", instance: "01" },
    hubRg,
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(validPipRes.valid, true, "New resource type 'pip' should pass");
  assert.strictEqual(validPipRes.isDuplicate, false);

  // 3.4 VM Instance uniqueness (vm pattern includes {instance})
  // First add a VM to hubRg
  const hubWithVm = {
    ...hubRg,
    resources: [
      ...hubRg.resources,
      { id: "res-vm-01", resourceTypeKey: "vm", purpose: "hub", instance: "01", osType: "Windows" }
    ]
  };
  const dupVmRes = validateResourceInput(
    { resourceTypeKey: "vm", purpose: "hub", instance: "01", osType: "Windows" },
    hubWithVm,
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(dupVmRes.valid, false, "Duplicate VM instance should fail");
  assert.strictEqual(dupVmRes.isDuplicate, true);
  assert.strictEqual(dupVmRes.nextSuggestedInstance, "02");

  const validVmRes = validateResourceInput(
    { resourceTypeKey: "vm", purpose: "hub", instance: "02", osType: "Windows" },
    hubWithVm,
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(validVmRes.valid, true, "VM with instance '02' should pass");
  assert.strictEqual(validVmRes.isDuplicate, false);

  // 3.4 Storage Account Platform Constraints (No hyphens, lowercase only)
  // Let's test a storage account evaluation
  const saRes = validateResourceInput(
    { resourceTypeKey: "storage", purpose: "hub", instance: "01" },
    hubRg,
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(saRes.validation.valid, true, "Storage account standard evaluation should pass");
  assert.strictEqual(/^[a-z0-9]+$/.test(saRes.evaluatedName), true, "Storage account must be lowercase alphanumeric");

  // 3.5 Windows VM Computer Name 15-char NetBIOS limit
  const winVmRes = validateResourceInput(
    { resourceTypeKey: "vm", purpose: "hub", instance: "01", osType: "Windows" },
    hubRg,
    activeSub,
    sampleCustomer,
    AZURE_RESOURCE_CATALOG
  );
  assert.ok(winVmRes.evaluatedName.length <= 15, "Windows computer name must be <= 15 characters");

  // 3.6 Global Duplicate Detection for Storage Account
  // Create an RG that already has a storage account
  const customerWithGlobalSa = JSON.parse(JSON.stringify(sampleCustomer));
  customerWithGlobalSa.topology.subscriptions[0].resourceGroups[0].resources.push({
    id: "res-sa-global-01",
    resourceTypeKey: "storage",
    purpose: "hub",
    instance: "01"
  });
  // Now attempt to add another storage account in a different RG (rg-dns) with the same evaluated name
  const dnsRg = customerWithGlobalSa.topology.subscriptions[0].resourceGroups[1];
  const dupGlobalRes = validateResourceInput(
    { resourceTypeKey: "storage", purpose: "hub", instance: "01" },
    dnsRg,
    activeSub,
    customerWithGlobalSa,
    AZURE_RESOURCE_CATALOG
  );
  assert.strictEqual(dupGlobalRes.valid, false, "Global duplicate storage account must fail");
  assert.strictEqual(dupGlobalRes.isDuplicate, true);
  assert.ok(dupGlobalRes.duplicateError.includes("globally unique"), "Should mention globally unique requirement");

  console.log("  ✅ Test 3: Resource validation, constraints & duplicate checks passed.");
}

console.log("🎉 All Topology Validation & Duplicate Prevention tests passed 100%!");
