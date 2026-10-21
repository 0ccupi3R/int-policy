/**
 * Azure Naming Pattern Reverse-Engineering Engine
 * 
 * Analyzes discovered brownfield Azure resources, decomposes naming syntaxes across
 * delimiters, correlates against known organizational tokens, and infers candidate
 * naming patterns with match confidence scores.
 */

import { AZURE_RESOURCE_CATALOG } from "../data/azureResourceCatalog.js";

// Common environment tokens in brownfield tenants
const ENV_CANDIDATES = new Set([
  "prod", "production", "prd", "prda", "prdb",
  "nonprod", "np", "nprd", "stage", "stg", "staging",
  "dev", "development", "test", "tst", "qa", "uat",
  "corp", "core", "shared", "shd", "infra", "hub"
]);

/**
 * Normalizes an Azure resource provider type (e.g. "Microsoft.Network/virtualNetworks")
 * to our catalog key (e.g. "vnet").
 */
export function normalizeResourceTypeToKey(resourceType, catalog = AZURE_RESOURCE_CATALOG) {
  if (!resourceType) return "unknown";
  const lowerType = resourceType.toLowerCase();

  const match = catalog.find(
    (c) => (c.resourceType || "").toLowerCase() === lowerType || (c.key || "").toLowerCase() === lowerType
  );
  if (match) return match.key;

  if (lowerType.includes("virtualnetwork")) return "vnet";
  if (lowerType.includes("networksecuritygroup")) return "nsg";
  if (lowerType.includes("networkinterface")) return "nic";
  if (lowerType.includes("storageaccount")) return "storage";
  if (lowerType.includes("vault")) return "kv";
  if (lowerType.includes("virtualmachine")) return "vm";
  if (lowerType.includes("resourcegroup")) return "rg";
  if (lowerType.includes("publicipaddress")) return "pip";
  if (lowerType.includes("operationalinsights")) return "law";
  if (lowerType.includes("automationaccount")) return "aa";
  if (lowerType.includes("recovery")) return "rsv";
  if (lowerType.includes("appservice") || lowerType.includes("serverfarm")) return "asp";
  if (lowerType.includes("sites")) return "app";
  if (lowerType.includes("sql/servers")) return "sql";
  if (lowerType.includes("databases")) return "sqldb";

  return lowerType.split("/").pop() || "res";
}

/**
 * Analyzes a single resource name against customer metadata to infer a tokenized pattern.
 */
export function inferPatternFromSingleName(name, typeKey, customer = {}) {
  if (!name) return "";

  const orgAbbr = (customer.abbreviation || "corp").toLowerCase();
  const orgName = (customer.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const subCode = (customer.subscriptionCode || "sub").toLowerCase();

  // Detect delimiter: hyphen, underscore, or none
  let delimiter = "-";
  if (name.includes("-")) delimiter = "-";
  else if (name.includes("_")) delimiter = "_";
  else delimiter = "";

  if (delimiter) {
    const parts = name.split(delimiter);
    const tokenParts = parts.map((part, idx) => {
      const lower = part.toLowerCase();

      // 1. Check for numeric instance (01, 02, etc.)
      if (/^\d{2,3}$/.test(part)) {
        return "{instance}";
      }

      // 2. Check for Org token
      if (lower === orgAbbr) {
        return part === part.toUpperCase() ? "{Org}" : "{org}";
      }
      if (orgName && lower.includes(orgName)) {
        return "{OrgName}";
      }

      // 3. Check for Sub code
      if (lower === subCode || lower === "sub" || lower === "core" || lower === "hub") {
        return part === part.toUpperCase() ? "{SUB}" : "{sub}";
      }

      // 4. Check for Environment
      if (ENV_CANDIDATES.has(lower)) {
        return part === part.toUpperCase() ? "{ENV}" : "{env}";
      }

      // 5. Check for resource type abbreviation
      if (lower === typeKey || lower === "rg" || lower === "vnet" || lower === "vm" || lower === "sa" || lower === "kv") {
        return "{abbreviation}";
      }

      // 6. Positional heuristic: If last part and looks like type or suffix
      if (idx === parts.length - 1 && parts.length > 2) {
        return "{abbreviation}";
      }

      // 7. Middle segment is typically workload or RG context
      if (idx > 0 && idx < parts.length - 1) {
        return "{ResourceGroup}";
      }

      return part;
    });

    return tokenParts.join(delimiter);
  } else {
    // Non-delimited name (e.g. Storage Accounts: "corpproddatasa01")
    let pattern = name;
    if (orgAbbr && pattern.toLowerCase().startsWith(orgAbbr)) {
      pattern = "{org}" + pattern.slice(orgAbbr.length);
    }
    // Check end instance
    const instanceMatch = pattern.match(/(\d{2})$/);
    if (instanceMatch) {
      pattern = pattern.slice(0, -instanceMatch[1].length) + "{instance}";
    }
    if (pattern.toLowerCase().endsWith("sa{instance}")) {
      pattern = pattern.slice(0, -12) + "sa{instance}";
    }
    return pattern;
  }
}

/**
 * Evaluates a collection of brownfield resources and infers optimal naming patterns
 * per resource type with match confidence percentages.
 */
export function inferBrownfieldNamingPatterns(resources = [], customer = {}) {
  if (!resources || resources.length === 0) {
    return {
      inferredPatterns: {},
      summary: { totalAnalyzed: 0, distinctTypes: 0 }
    };
  }

  // 1. Group names by normalized typeKey
  const byType = {};
  resources.forEach((res) => {
    const rawType = res.type || res.resourceType || "unknown";
    const typeKey = normalizeResourceTypeToKey(rawType);
    const name = res.name || "";
    if (!name) return;

    if (!byType[typeKey]) byType[typeKey] = [];
    byType[typeKey].push(name);
  });

  const inferredPatterns = {};

  // 2. Infer candidate pattern per typeKey
  Object.entries(byType).forEach(([typeKey, names]) => {
    const candidateMap = {}; // pattern -> count

    names.forEach((name) => {
      const candidate = inferPatternFromSingleName(name, typeKey, customer);
      if (candidate) {
        candidateMap[candidate] = (candidateMap[candidate] || 0) + 1;
      }
    });

    // Pick candidate with highest frequency
    const sorted = Object.entries(candidateMap).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [bestPattern, count] = sorted[0];
      const matchPercentage = Math.round((count / names.length) * 100);

      inferredPatterns[typeKey] = {
        pattern: bestPattern,
        matchPercentage,
        sampleCount: names.length,
        matchedCount: count,
        samples: names.slice(0, 3),
        confidence: matchPercentage >= 80 ? "HIGH" : matchPercentage >= 50 ? "MEDIUM" : "LOW"
      };
    }
  });

  return {
    inferredPatterns,
    summary: {
      totalAnalyzed: resources.length,
      distinctTypes: Object.keys(byType).length
    }
  };
}
