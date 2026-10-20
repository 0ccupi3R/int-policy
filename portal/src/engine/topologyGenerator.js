// Resource Topology & Bicep/ARM Parameter Generator (Unified Governance Engine)
// Automatically resolves canonical compliant resource names and 3-tier tag inheritance

import {
  toSampleName,
  validateAzurePlatformConstraints,
  getEnrichedResourceMeta,
  toTitleCase,
  DEFAULT_VM_WINDOWS_PATTERN,
  DEFAULT_VM_LINUX_PATTERN
} from "./tokenParser.js";
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
export function computeEffectiveResourceTags(customer, subscription, rg, resource, _resourceMeta) {
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
      if (t.key === "Owner") val = t.allowedValues?.[0] || "cloudops@contoso.com";
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
  const isVm = resKey === "vm" || (resourceMeta.resourceType || "").toLowerCase().includes("virtualmachines");
  const osType = resource.osType || (isVm ? "Windows" : undefined);

  let pattern = "";
  if (isVm) {
    if (osType === "Windows") {
      pattern = customPatterns.vm_windows || DEFAULT_VM_WINDOWS_PATTERN;
    } else {
      pattern = customPatterns.vm_linux || customPatterns.vm || DEFAULT_VM_LINUX_PATTERN;
    }
  } else {
    pattern =
      customPatterns[resKey] ||
      customPatterns[resourceMeta.abbreviation] ||
      customer.namingRules?.globalPattern ||
      "{Org}-{SUB}-{ResourceGroup}-{abbreviation}";
  }

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
  } catch {
    evaluatedName = `${customer.abbreviation || "cust"}-${subscription.code}-${rg.purpose}-${resourceMeta.abbreviation || "res"}`;
  }

  // 2. Validate Platform Constraints
  const validation = validateAzurePlatformConstraints(evaluatedName, enrichedMeta, { osType });

  // 3. Compute Effective Tags
  const { tags, tagOrigins } = computeEffectiveResourceTags(customer, subscription, rg, resource, enrichedMeta);

  return {
    id: resource.id,
    resourceTypeKey: resource.resourceTypeKey,
    resourceMeta: enrichedMeta,
    osType: isVm ? osType : undefined,
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
  } catch {
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
 * Computes the next available two-digit instance string (e.g. "01", "02")
 * for a given resource type and purpose in a Resource Group.
 */
export function getNextAvailableInstance(rg, resourceTypeKey, purpose = "") {
  const existingInstances = new Set();
  const targetKey = (resourceTypeKey || "").toLowerCase();
  const targetPurpose = (purpose || "").toLowerCase();

  (rg?.resources || []).forEach((r) => {
    const rKey = (r.resourceTypeKey || r.resourceType || "").toLowerCase();
    const rPurpose = (r.purpose || rg?.purpose || "").toLowerCase();
    if (rKey === targetKey && (!targetPurpose || rPurpose === targetPurpose)) {
      const num = parseInt(r.instance, 10);
      if (!isNaN(num)) {
        existingInstances.add(num);
      }
    }
  });

  for (let i = 1; i <= 99; i++) {
    if (!existingInstances.has(i)) {
      return i.toString().padStart(2, "0");
    }
  }
  return "01";
}

/**
 * Validates a Subscription candidate against Azure naming rules and duplicate conflicts.
 */
export function validateSubscriptionInput(subData, existingSubscriptions = [], currentSubId = null) {
  const errors = [];
  const warnings = [];

  const name = (subData?.name || "").trim();
  const code = (subData?.code || "").trim();
  const environment = (subData?.environment || "").trim();
  const location = (subData?.location || "").trim();

  // 1. Subscription Name Constraints
  if (!name) {
    errors.push("Subscription Name is required.");
  } else {
    if (name.length < 1 || name.length > 64) {
      errors.push(`Subscription Name must be between 1 and 64 characters (current: ${name.length}).`);
    }
    if (/^[.\s]/.test(name) || /[.\s]$/.test(name)) {
      errors.push("Subscription Name cannot begin or end with a space or period.");
    }
    // Allowed characters: alphanumeric, spaces, hyphens, underscores, periods, parentheses
    if (!/^[a-zA-Z0-9_\-\.\s\(\)]+$/.test(name)) {
      errors.push("Subscription Name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, periods, and parentheses are allowed.");
    }
  }

  // 2. Subscription Code Constraints (used in tokens like {SUB})
  if (!code) {
    errors.push("Subscription Code is required.");
  } else {
    if (code.length < 2 || code.length > 10) {
      errors.push(`Subscription Code must be between 2 and 10 characters (current: ${code.length}).`);
    }
    if (!/^[a-zA-Z0-9]+$/.test(code)) {
      errors.push("Subscription Code must be alphanumeric only (no spaces or special characters).");
    }
  }

  // 3. Duplicate checks across existing subscriptions
  const otherSubs = (existingSubscriptions || []).filter((s) => s && s.id !== currentSubId);
  const duplicateNameSub = otherSubs.find((s) => (s.name || "").trim().toLowerCase() === name.toLowerCase());
  const duplicateCodeSub = otherSubs.find((s) => (s.code || "").trim().toLowerCase() === code.toLowerCase());

  let isDuplicate = false;
  let duplicateError = null;

  if (name && duplicateNameSub) {
    isDuplicate = true;
    duplicateError = `A Subscription with name '${name}' already exists in the topology.`;
    errors.push(duplicateError);
  } else if (code && duplicateCodeSub) {
    isDuplicate = true;
    duplicateError = `Subscription code '${code}' is already used by Subscription '${duplicateCodeSub.name}'.`;
    errors.push(duplicateError);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    isDuplicate,
    duplicateError,
    sanitized: {
      name,
      code: code.toUpperCase(),
      environment: environment || "prod",
      location: location || "canadacentral"
    }
  };
}

/**
 * Validates a Resource Group candidate against Azure ARM constraints and duplicate conflicts.
 */
export function validateResourceGroupInput(rgData, subscription, customer, catalog, currentRgId = null) {
  const errors = [];
  const warnings = [];

  const purpose = (rgData?.purpose || "").trim().toLowerCase();
  const nameOverride = (rgData?.name || "").trim();
  const location = rgData?.location || subscription?.location || customer?.defaultRegion || "canadacentral";

  if (!purpose && !nameOverride) {
    errors.push("Resource Group purpose or custom name is required.");
  }

  // Evaluate candidate name
  const rgMeta = findResourceInCatalog(catalog, "rg") || {
    key: "rg",
    name: "Resource Group",
    abbreviation: "rg",
    resourceType: "Microsoft.Resources/resourceGroups",
    minLength: 1,
    maxLength: 90
  };

  let candidateName = "";
  if (nameOverride) {
    candidateName = nameOverride;
  } else {
    const pattern = customer?.namingRules?.customPatterns?.rg || "{Org}-{SUB}-{ResourceGroup}-rg";
    const sampleContext = {
      subCode: subscription?.code || "SUB",
      subName: subscription?.name || "Subscription",
      environment: subscription?.environment || "prod",
      rg: purpose || "core",
      region: (customer?.regions && customer.regions[location]) || "cc",
      purpose: purpose || "core"
    };

    try {
      candidateName = toSampleName(pattern, customer, rgMeta, sampleContext);
    } catch {
      candidateName = `${customer?.abbreviation || "cust"}-${subscription?.code || "sub"}-${purpose || "core"}-rg`;
    }
  }

  // Azure Platform Constraints for RG
  const platformValidation = validateAzurePlatformConstraints(candidateName, rgMeta);
  if (!platformValidation.valid) {
    platformValidation.errors.forEach((e) => errors.push(e));
  }

  // Duplicate check within subscription
  const otherRgs = (subscription?.resourceGroups || []).filter((r) => r && r.id !== currentRgId);
  const duplicateRg = otherRgs.find((other) => {
    const evalOther = evaluateRgNode(customer, catalog, subscription, other);
    return (evalOther.evaluatedName || "").trim().toLowerCase() === candidateName.toLowerCase();
  });

  let isDuplicate = false;
  let duplicateError = null;

  if (duplicateRg) {
    isDuplicate = true;
    duplicateError = `A Resource Group with name '${candidateName}' already exists in subscription '${subscription?.name || "this subscription"}'.`;
    errors.push(duplicateError);
  }

  return {
    valid: errors.length === 0,
    evaluatedName: candidateName,
    validation: platformValidation,
    isDuplicate,
    duplicateError,
    errors,
    warnings: [...warnings, ...(platformValidation.warnings || [])]
  };
}

/**
 * Validates a Resource candidate against Azure ARM constraints and duplicate conflicts.
 */
export function validateResourceInput(resData, rg, subscription, customer, catalog, currentResId = null) {
  const errors = [];
  const warnings = [];

  const resourceTypeKey = resData?.resourceTypeKey || resData?.resourceType || "storage";
  const purpose = (resData?.purpose || rg?.purpose || "core").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const instance = (resData?.instance || "01").replace(/[^0-9]/g, "").slice(0, 2).padStart(2, "0");
  const osType = resData?.osType || "Windows";

  // Evaluate candidate resource node
  const tempResource = {
    id: currentResId || "temp-eval-id",
    resourceTypeKey,
    purpose,
    instance,
    osType,
    tags: resData?.tags || {}
  };

  const evalRes = evaluateResourceNode(customer, catalog, subscription, rg, tempResource);
  const candidateName = evalRes.evaluatedName;

  // Azure Platform Constraints
  if (!evalRes.validation.valid) {
    evalRes.validation.errors.forEach((e) => errors.push(e));
  }

  // 1. Duplicate check within same RG
  const otherResInRg = (rg?.resources || []).filter((r) => r && r.id !== currentResId);
  const duplicateInRg = otherResInRg.find((other) => {
    const evalOther = evaluateResourceNode(customer, catalog, subscription, rg, other);
    return (evalOther.evaluatedName || "").trim().toLowerCase() === candidateName.toLowerCase();
  });

  // 2. Duplicate check across entire topology for globally or subscription-wide unique services
  const isGlobalUnique =
    resourceTypeKey === "storage" ||
    resourceTypeKey === "sa" ||
    resourceTypeKey === "st" ||
    resourceTypeKey === "kv" ||
    resourceTypeKey === "cr" ||
    resourceTypeKey === "cosmos";

  let duplicateGlobal = null;
  if (isGlobalUnique && customer?.topology?.subscriptions) {
    for (const sub of customer.topology.subscriptions) {
      for (const group of sub.resourceGroups || []) {
        for (const res of group.resources || []) {
          if (res.id === currentResId) continue;
          if (group.id === rg?.id && res.id === currentResId) continue;
          const evalOther = evaluateResourceNode(customer, catalog, sub, group, res);
          if ((evalOther.evaluatedName || "").trim().toLowerCase() === candidateName.toLowerCase()) {
            duplicateGlobal = { subName: sub.name, rgName: group.purpose || group.name };
            break;
          }
        }
        if (duplicateGlobal) break;
      }
      if (duplicateGlobal) break;
    }
  }

  let isDuplicate = false;
  let duplicateError = null;

  if (duplicateInRg) {
    isDuplicate = true;
    duplicateError = `A resource with name '${candidateName}' already exists in Resource Group '${rg?.purpose || rg?.name || "current group"}'.`;
    errors.push(duplicateError);
  } else if (duplicateGlobal) {
    isDuplicate = true;
    duplicateError = `Azure requires globally unique names for ${evalRes.resourceMeta?.name || resourceTypeKey}. Name '${candidateName}' is already used in ${duplicateGlobal.subName} / ${duplicateGlobal.rgName}.`;
    errors.push(duplicateError);
  }

  const nextSuggestedInstance = getNextAvailableInstance(rg, resourceTypeKey, purpose);

  return {
    valid: errors.length === 0,
    evaluatedName: candidateName,
    validation: evalRes.validation,
    isDuplicate,
    duplicateError,
    errors,
    warnings: [...warnings, ...(evalRes.validation.warnings || [])],
    nextSuggestedInstance,
    resourceMeta: evalRes.resourceMeta
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
        if (evalRes.osType) {
          out += `            osType: '${evalRes.osType}'\n`;
        }
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
              ...(evalRes.osType ? { osType: evalRes.osType } : {}),
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
