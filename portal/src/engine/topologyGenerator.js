// Resource Topology & Bicep/ARM Parameter Generator ("1 Bullet, Two Kills")
// Automatically resolves canonical compliant resource names and 3-tier tag inheritance

import { toSampleName, validateAzurePlatformConstraints, getEnrichedResourceMeta, toTitleCase } from "./tokenParser.js";
import { AZURE_RESOURCE_CATALOG } from "../data/azureResourceCatalog.js";

/**
 * Returns a baseline topology if none exists for the customer.
 */
export function getBaselineTopology(customer) {
  const subName = customer.subscriptionName || "Connectivity";
  const subCode = customer.subscriptionCode || "CON";
  const env = customer.environment || "prod";
  const region = customer.defaultRegion || Object.keys(customer.regions || {})[0] || "canadacentral";
  const purposes = customer.purposes && customer.purposes.length > 0 ? customer.purposes : ["hub", "core", "monitoring"];

  return {
    subscriptions: [
      {
        id: `sub-${subCode.toLowerCase()}`,
        name: subName,
        code: subCode,
        environment: env,
        location: region,
        resourceGroups: [
          {
            id: `rg-${purposes[0] || "hub"}`,
            purpose: purposes[0] || "hub",
            name: "", // Evaluated dynamically
            location: region,
            resources: [
              { id: "res-vnet-01", resourceTypeKey: "vnet", purpose: purposes[0] || "hub", instance: "01" },
              { id: "res-nsg-01", resourceTypeKey: "nsg", purpose: purposes[0] || "hub", instance: "01" },
              { id: "res-nic-01", resourceTypeKey: "nic", purpose: purposes[0] || "hub", instance: "01" }
            ]
          },
          {
            id: `rg-${purposes[1] || "core"}`,
            purpose: purposes[1] || "core",
            name: "", // Evaluated dynamically
            location: region,
            resources: [
              { id: "res-sa-01", resourceTypeKey: "storage", purpose: purposes[1] || "core", instance: "01" },
              { id: "res-kv-01", resourceTypeKey: "kv", purpose: purposes[1] || "core", instance: "01" },
              { id: "res-vm-01", resourceTypeKey: "vm", purpose: purposes[1] || "core", instance: "01" }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Finds the resource type definition in the catalog.
 */
export function findResourceInCatalog(catalog, keyOrType) {
  if (!keyOrType) return null;
  const lower = keyOrType.toLowerCase();
  const cat = catalog || AZURE_RESOURCE_CATALOG;

  // 1. Match by key or abbreviation
  let found = cat.find((r) => (r.key || "").toLowerCase() === lower || (r.abbreviation || "").toLowerCase() === lower);
  if (found) return found;

  // 2. Match by resourceType provider string
  found = cat.find((r) => (r.resourceType || "").toLowerCase() === lower);
  if (found) return found;

  // 3. Fallback matching
  if (lower === "storage" || lower === "sa" || lower === "st") {
    found = cat.find((r) => r.key === "storage" || r.abbreviation === "sa");
  } else if (lower === "kv" || lower === "keyvault") {
    found = cat.find((r) => r.key === "kv" || r.abbreviation === "kv");
  } else if (lower === "vm") {
    found = cat.find((r) => r.key === "vm" || r.abbreviation === "vm");
  } else if (lower === "rg") {
    found = cat.find((r) => r.key === "rg" || r.abbreviation === "rg");
  }

  return found || {
    key: keyOrType,
    name: keyOrType,
    abbreviation: keyOrType.slice(0, 4).toLowerCase(),
    resourceType: `Microsoft.Resources/${keyOrType}`
  };
}

/**
 * Returns the official 5-subscription AirGate Enterprise Platform Landing Zone topology.
 */
export function getAirGateDefaultPlatformTopology(customer) {
  const env = customer.environment || "prod";
  const region = customer.defaultRegion || Object.keys(customer.regions || {})[0] || "canadacentral";

  return {
    subscriptions: [
      {
        id: "sub-connectivity",
        name: "Connectivity",
        code: "CON",
        environment: env,
        location: region,
        resourceGroups: [
          {
            id: "rg-hub",
            purpose: "hub",
            name: "",
            location: region,
            resources: [
              { id: "res-vnet-hub", resourceTypeKey: "vnet", purpose: "hub", instance: "01" },
              { id: "res-nsg-hub", resourceTypeKey: "nsg", purpose: "hub", instance: "01" },
              { id: "res-fw-hub", resourceTypeKey: "fw", purpose: "hub", instance: "01" },
              { id: "res-gw-hub", resourceTypeKey: "gw", purpose: "hub", instance: "01" },
              { id: "res-bas-hub", resourceTypeKey: "bas", purpose: "hub", instance: "01" }
            ]
          },
          {
            id: "rg-dns",
            purpose: "dns",
            name: "",
            location: region,
            resources: [
              { id: "res-dnspr-dns", resourceTypeKey: "dnspr", purpose: "dns", instance: "01" },
              { id: "res-pip-dns", resourceTypeKey: "pip", purpose: "dns", instance: "01" }
            ]
          }
        ]
      },
      {
        id: "sub-identity",
        name: "Identity",
        code: "IDN",
        environment: env,
        location: region,
        resourceGroups: [
          {
            id: "rg-identity",
            purpose: "adds",
            name: "",
            location: region,
            resources: [
              { id: "res-vm-dc01", resourceTypeKey: "vm", purpose: "adds", instance: "01" },
              { id: "res-nic-dc01", resourceTypeKey: "nic", purpose: "adds", instance: "01" },
              { id: "res-nsg-dc01", resourceTypeKey: "nsg", purpose: "adds", instance: "01" },
              { id: "res-kv-dc", resourceTypeKey: "kv", purpose: "adds", instance: "01" }
            ]
          }
        ]
      },
      {
        id: "sub-management",
        name: "Management",
        code: "MGT",
        environment: env,
        location: region,
        resourceGroups: [
          {
            id: "rg-monitoring",
            purpose: "mon",
            name: "",
            location: region,
            resources: [
              { id: "res-law-mon", resourceTypeKey: "law", purpose: "mon", instance: "01" },
              { id: "res-aa-mon", resourceTypeKey: "aa", purpose: "mon", instance: "01" }
            ]
          },
          {
            id: "rg-recovery",
            purpose: "rec",
            name: "",
            location: region,
            resources: [
              { id: "res-rsv-rec", resourceTypeKey: "rsv", purpose: "rec", instance: "01" }
            ]
          }
        ]
      },
      {
        id: "sub-security",
        name: "Security",
        code: "SEC",
        environment: env,
        location: region,
        resourceGroups: [
          {
            id: "rg-security",
            purpose: "sec",
            name: "",
            location: region,
            resources: [
              { id: "res-kv-sec", resourceTypeKey: "kv", purpose: "sec", instance: "01" },
              { id: "res-sa-sec", resourceTypeKey: "storage", purpose: "sec", instance: "01" }
            ]
          }
        ]
      },
      {
        id: "sub-apps",
        name: "Workload-Apps",
        code: "APP",
        environment: env,
        location: region,
        resourceGroups: [
          {
            id: "rg-apps",
            purpose: "apps",
            name: "",
            location: region,
            resources: [
              { id: "res-asp-apps", resourceTypeKey: "asp", purpose: "apps", instance: "01" },
              { id: "res-app-apps", resourceTypeKey: "app", purpose: "apps", instance: "01" },
              { id: "res-sqldb-apps", resourceTypeKey: "sqldb", purpose: "apps", instance: "01" },
              { id: "res-sa-apps", resourceTypeKey: "storage", purpose: "apps", instance: "01" }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Computes unified tags across all 3 tiers with override support:
 * Tier 1: Subscription tags (default or subscription.tags override)
 * Tier 2: Resource Group tags (Subscription inherited or rg.tags override)
 * Tier 3: Resource tags (RG inherited or resource.tags override + NA defaulted)
 */
export function computeEffectiveResourceTags(customer, subscription, rg, resource, resourceMeta) {
  const resultTags = {};
  const tagOrigins = {}; // key -> { value, source, description }

  const subTagDefs = customer.tags?.subscription || [];
  const rgTagDefs = customer.tags?.resourceGroup || [];
  const resTagDefs = customer.tags?.resource || [];
  const inheritance = customer.tagInheritance || {
    subToRg: ["CostCenter", "Owner"],
    rgToResource: ["Environment", "CostCenter", "Workload", "Owner"],
    defaultResourceNA: ["DataClassification", "Criticality", "DisasterRecovery"]
  };

  // 1. Subscription Level Tags
  subTagDefs.forEach((t) => {
    let val = subscription.tags?.[t.key] || "";
    let source = "subscription";
    if (val) {
      source = "subscription-override";
    } else {
      val = t.allowedValues?.[0] || "NA";
      if (t.key === "CostCenter") val = t.allowedValues?.[0] || "1000";
      if (t.key === "Owner") val = t.allowedValues?.[0] || "cloudops@customer.com";
      if (t.key === "BusinessUnit") val = t.allowedValues?.[0] || "EnterpriseIT";
    }
    resultTags[t.key] = val;
    tagOrigins[t.key] = { value: val, source: source, description: t.description };
  });

  // 2. Resource Group Level Tags
  const subToRgKeys = inheritance.subToRg || [];
  rgTagDefs.forEach((t) => {
    let val = rg.tags?.[t.key] || "";
    let source = "resourceGroup";

    if (val) {
      source = "rg-override";
    } else {
      if (subToRgKeys.includes(t.key) && resultTags[t.key]) {
        val = resultTags[t.key];
        source = tagOrigins[t.key]?.source === "subscription-override" ? "subscription-override" : "subscription";
      } else {
        if (t.key === "Environment") val = toTitleCase(subscription.environment || customer.environment || "Prod");
        else if (t.key === "Workload") val = toTitleCase(rg.purpose || "Connectivity");
        else val = t.allowedValues?.[0] || "NA";
      }
    }

    resultTags[t.key] = val;
    tagOrigins[t.key] = {
      value: val,
      source: source,
      description: t.description
    };
  });

  // 3. Resource Level Tags
  const rgToResourceKeys = inheritance.rgToResource || [];
  const defaultNaKeys = inheritance.defaultResourceNA || [];

  resTagDefs.forEach((t) => {
    let val = resource.tags?.[t.key] || "";
    let source = "resource";

    if (val) {
      source = "resource-override";
    } else {
      if (rgToResourceKeys.includes(t.key) && resultTags[t.key]) {
        val = resultTags[t.key];
        source = tagOrigins[t.key]?.source?.includes("override") ? "rg-override" : "resourceGroup";
      } else if (t.key === "Application") {
        val = toTitleCase(resource.purpose || rg.purpose || "CoreWorkload");
        source = "resource";
      } else if (defaultNaKeys.includes(t.key)) {
        val = "NA";
        source = "default-na";
      } else {
        val = t.allowedValues?.[0] || "NA";
      }
    }

    resultTags[t.key] = val;
    tagOrigins[t.key] = {
      value: val,
      source: source,
      description: t.description
    };
  });

  // 4. Fallback NA Defaulting for any remaining defaultResourceNA keys
  defaultNaKeys.forEach((key) => {
    if (!resultTags[key] || resultTags[key] === "") {
      resultTags[key] = "NA";
      tagOrigins[key] = {
        value: "NA",
        source: "default-na",
        description: `Auto-defaulted to 'NA' by Tag Inheritance Initiative for ${key}`
      };
    }
  });

  return { tags: resultTags, tagOrigins };
}

/**
 * Evaluates an individual Resource Node: calculates canonical name, validates constraints, and computes tags.
 */
export function evaluateResourceNode(customer, catalog, subscription, rg, resource) {
  const resourceMeta = findResourceInCatalog(catalog, resource.resourceTypeKey || resource.resourceType);
  const enrichedMeta = getEnrichedResourceMeta(resourceMeta);

  // Pattern resolution
  const customPatterns = customer.namingRules?.customPatterns || {};
  const resKey = (resourceMeta.key || resourceMeta.abbreviation || "").toLowerCase();
  const pattern =
    customPatterns[resKey] ||
    customPatterns[resourceMeta.abbreviation] ||
    customer.namingRules?.globalPattern ||
    "{Org}-{SUB}-{ResourceGroup}-{abbreviation}";

  // Context for token parser
  const sampleContext = {
    subCode: subscription.code,
    subName: subscription.name,
    environment: subscription.environment,
    rg: rg.purpose || rg.name,
    region: (customer.regions && customer.regions[rg.location]) || "cc",
    purpose: resource.purpose || rg.purpose || "core",
    instance: resource.instance || "01"
  };

  // 1. Calculate Name
  let evaluatedName = "";
  try {
    evaluatedName = toSampleName(pattern, customer, enrichedMeta, sampleContext);
  } catch (e) {
    evaluatedName = `${customer.abbreviation || "cust"}-${subscription.code}-${rg.purpose}-${resourceMeta.abbreviation || "res"}`;
  }

  // 2. Validate Platform Constraints
  const validation = validateAzurePlatformConstraints(evaluatedName, enrichedMeta);

  // 3. Compute Effective Tags
  const { tags, tagOrigins } = computeEffectiveResourceTags(customer, subscription, rg, resource, enrichedMeta);

  return {
    id: resource.id,
    resourceTypeKey: resource.resourceTypeKey,
    resourceMeta: enrichedMeta,
    evaluatedName,
    pattern,
    validation,
    tags,
    tagOrigins,
    location: rg.location || subscription.location || "canadacentral"
  };
}

/**
 * Evaluates an individual Resource Group Node.
 */
export function evaluateRgNode(customer, catalog, subscription, rg) {
  const rgMeta = findResourceInCatalog(catalog, "rg") || {
    key: "rg",
    name: "Resource Group",
    abbreviation: "rg",
    resourceType: "Microsoft.Resources/resourceGroups",
    minLength: 1,
    maxLength: 90
  };

  const pattern = customer.namingRules?.customPatterns?.rg || "{Org}-{SUB}-{ResourceGroup}-rg";
  const sampleContext = {
    subCode: subscription.code,
    subName: subscription.name,
    environment: subscription.environment,
    rg: rg.purpose || rg.name || "core",
    region: (customer.regions && customer.regions[rg.location]) || "cc",
    purpose: rg.purpose || "core"
  };

  let evaluatedName = "";
  try {
    evaluatedName = toSampleName(pattern, customer, rgMeta, sampleContext);
  } catch (e) {
    evaluatedName = `${customer.abbreviation || "cust"}-${subscription.code}-${rg.purpose || "core"}-rg`;
  }

  const validation = validateAzurePlatformConstraints(evaluatedName, rgMeta);

  // Effective RG Tags
  const rgTags = {};
  const rgTagOrigins = {};
  const subTagDefs = customer.tags?.subscription || [];
  const rgTagDefs = customer.tags?.resourceGroup || [];
  const subToRgKeys = customer.tagInheritance?.subToRg || ["CostCenter", "Owner"];

  subTagDefs.forEach((t) => {
    if (subToRgKeys.includes(t.key)) {
      const isOverridden = Boolean(subscription.tags?.[t.key]);
      const val = subscription.tags?.[t.key] || t.allowedValues?.[0] || "1000";
      rgTags[t.key] = val;
      rgTagOrigins[t.key] = { value: val, source: isOverridden ? "subscription-override" : "subscription" };
    }
  });

  rgTagDefs.forEach((t) => {
    let val = rg.tags?.[t.key] || "";
    let source = "resourceGroup";
    if (val) {
      source = "rg-override";
    } else {
      if (t.key === "Environment") val = toTitleCase(subscription.environment || customer.environment || "Prod");
      else if (t.key === "Workload") val = toTitleCase(rg.purpose || "Connectivity");
      else if (subToRgKeys.includes(t.key) && rgTags[t.key]) {
        val = rgTags[t.key];
        source = rgTagOrigins[t.key]?.source || "subscription";
      } else {
        val = t.allowedValues?.[0] || "NA";
      }
    }
    rgTags[t.key] = val;
    rgTagOrigins[t.key] = { value: val, source: source };
  });

  return {
    id: rg.id,
    purpose: rg.purpose,
    evaluatedName,
    pattern,
    validation,
    tags: rgTags,
    tagOrigins: rgTagOrigins,
    location: rg.location || subscription.location || "canadacentral"
  };
}

/**
 * Generates modern Bicep Parameters (.bicepparam)
 */
export function generateBicepParameters(customer, topology, catalog) {
  const activeSub = topology.subscriptions?.[0] || {};
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = activeSub.code || customer.subscriptionCode || "CON";
  const version = customer.version || "1.0.0";

  let out = `// ==============================================================================\n`;
  out += `// Azure Landing Zone Resource Topology & Parameters (.bicepparam)\n`;
  out += `// Customer: ${customer.name} (${orgAbbr}) | Subscription: ${activeSub.name} (${subCode})\n`;
  out += `// Generated: ${new Date().toISOString()} | Version: ${version}\n`;
  out += `// ==============================================================================\n\n`;
  out += `using './resources.bicep'\n\n`;

  out += `param customerId = '${orgAbbr}'\n`;
  out += `param subscriptionCode = '${subCode}'\n`;
  out += `param environment = '${activeSub.environment || customer.environment || "prod"}'\n`;
  out += `param primaryRegion = '${activeSub.location || customer.defaultRegion || "canadacentral"}'\n\n`;

  out += `param topology = [\n`;

  (topology.subscriptions || []).forEach((sub) => {
    out += `  {\n`;
    out += `    subscriptionName: '${sub.name}'\n`;
    out += `    subscriptionCode: '${sub.code}'\n`;
    out += `    environment: '${sub.environment}'\n`;
    out += `    location: '${sub.location}'\n`;
    out += `    resourceGroups: [\n`;

    (sub.resourceGroups || []).forEach((rg) => {
      const evalRg = evaluateRgNode(customer, catalog, sub, rg);
      out += `      {\n`;
      out += `        name: '${evalRg.evaluatedName}'\n`;
      out += `        purpose: '${rg.purpose}'\n`;
      out += `        location: '${evalRg.location}'\n`;
      out += `        tags: {\n`;
      Object.entries(evalRg.tags).forEach(([k, v]) => {
        out += `          ${k}: '${v}'\n`;
      });
      out += `        }\n`;
      out += `        resources: [\n`;

      (rg.resources || []).forEach((res) => {
        const evalRes = evaluateResourceNode(customer, catalog, sub, rg, res);
        out += `          {\n`;
        out += `            name: '${evalRes.evaluatedName}'\n`;
        out += `            type: '${evalRes.resourceMeta.resourceType || "Microsoft.Resources/unknown"}'\n`;
        out += `            purpose: '${res.purpose}'\n`;
        out += `            instance: '${res.instance || "01"}'\n`;
        out += `            location: '${evalRes.location}'\n`;
        out += `            tags: {\n`;
        Object.entries(evalRes.tags).forEach(([k, v]) => {
          out += `              ${k}: '${v}'\n`;
        });
        out += `            }\n`;
        out += `          }\n`;
      });

      out += `        ]\n`;
      out += `      }\n`;
    });

    out += `    ]\n`;
    out += `  }\n`;
  });

  out += `]\n`;
  return out;
}

/**
 * Generates ARM JSON Parameters (parameters.json)
 */
export function generateArmParameters(customer, topology, catalog) {
  const activeSub = topology.subscriptions?.[0] || {};
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = activeSub.code || customer.subscriptionCode || "CON";

  const evaluatedTopology = (topology.subscriptions || []).map((sub) => {
    return {
      subscriptionName: sub.name,
      subscriptionCode: sub.code,
      environment: sub.environment,
      location: sub.location,
      resourceGroups: (sub.resourceGroups || []).map((rg) => {
        const evalRg = evaluateRgNode(customer, catalog, sub, rg);
        return {
          name: evalRg.evaluatedName,
          purpose: rg.purpose,
          location: evalRg.location,
          tags: evalRg.tags,
          resources: (rg.resources || []).map((res) => {
            const evalRes = evaluateResourceNode(customer, catalog, sub, rg, res);
            return {
              name: evalRes.evaluatedName,
              type: evalRes.resourceMeta.resourceType,
              purpose: res.purpose,
              instance: res.instance || "01",
              location: evalRes.location,
              tags: evalRes.tags
            };
          })
        };
      })
    };
  });

  return {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    contentVersion: "1.0.0.0",
    parameters: {
      customerId: { value: orgAbbr },
      subscriptionCode: { value: subCode },
      environment: { value: activeSub.environment || customer.environment || "prod" },
      primaryRegion: { value: activeSub.location || customer.defaultRegion || "canadacentral" },
      topology: { value: evaluatedTopology }
    }
  };
}

/**
 * Generates the Companion Bicep Deployment Module (resources.bicep)
 */
export function generateCompanionResourcesBicep(customer, topology) {
  const activeSub = topology.subscriptions?.[0] || {};
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = activeSub.code || customer.subscriptionCode || "CON";
  const version = customer.version || "1.0.0";

  return `// ==============================================================================
// Azure Landing Zone Companion Deployment Module (resources.bicep)
// Provisions Resource Groups and Resources generated from the Topology Studio
// Customer: ${customer.name} (${orgAbbr}) | Subscription: ${activeSub.name} (${subCode})
// Version: ${version}
// ==============================================================================
targetScope = 'subscription'

@description('Customer short identifier')
param customerId string = '${orgAbbr}'

@description('Subscription workload code')
param subscriptionCode string = '${subCode}'

@description('Target environment tier')
param environment string = '${activeSub.environment || "prod"}'

@description('Primary deployment Azure region')
param primaryRegion string = '${activeSub.location || "canadacentral"}'

@description('Structured hierarchy of subscriptions, resource groups, and leaf resources')
param topology array

// ------------------------------------------------------------------------------
// 1. Resource Groups Provisioning
// ------------------------------------------------------------------------------
resource rgs 'Microsoft.Resources/resourceGroups@2021-04-01' = [for (rg, index) in topology[0].resourceGroups: {
  name: rg.name
  location: rg.location
  tags: rg.tags
}]

// ------------------------------------------------------------------------------
// 2. Resource Group Scoped Module Invocation
// ------------------------------------------------------------------------------
module rgResources './modules/rg-resources.bicep' = [for (rg, index) in topology[0].resourceGroups: {
  name: 'deploy-\${rg.name}'
  scope: resourceGroup(rg.name)
  dependsOn: [
    rgs[index]
  ]
  params: {
    resources: rg.resources
    location: rg.location
  }
}]

output deployedResourceGroups array = [for (rg, index) in topology[0].resourceGroups: {
  name: rg.name
  location: rg.location
  resourceCount: length(rg.resources)
}]

output deploymentMetadata object = {
  customerId: customerId
  subscriptionCode: subscriptionCode
  environment: environment
  primaryRegion: primaryRegion
}
`;
}
