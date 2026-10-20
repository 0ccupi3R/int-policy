// Dynamic Token Pattern Engine for Azure Policy Naming Conventions
import { AZURE_NAMING_CATALOG } from "../data/azureNamingCatalog.js";

export const DEFAULT_VM_WINDOWS_PATTERN = "vm-{org}{sub}{purpose}{instance}";
export const DEFAULT_VM_LINUX_PATTERN = "{Org}-{SUB}-{ResourceGroup}-vm";

export function toTitleCase(str) {
  if (!str) return "";
  return str
    .replace(/[_\s-]+/g, " ")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
    .replace(/\s+/g, "");
}

export function toKebabCase(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const AVAILABLE_TOKENS = [
  // Customer Abbreviation Tokens
  { token: "{Org}", description: "TitleCase Customer Abbr (e.g., Cust01, Nova)", example: "Nova" },
  { token: "{org}", description: "Lowercase Customer Abbr (e.g., cust01, nova)", example: "nova" },
  { token: "{ORG}", description: "UPPERCASE Customer Abbr (e.g., CUST01, NOVA)", example: "NOVA" },

  // Customer Full Name Tokens
  { token: "{OrgName}", description: "Full TitleCase Customer Name (e.g., NovaaiDynamics)", example: "NovaaiDynamics" },
  { token: "{orgname}", description: "Full Lowercase Customer Name (e.g., novaai-dynamics)", example: "novaai-dynamics" },
  { token: "{ORGNAME}", description: "Full UPPERCASE Customer Name (e.g., NOVAAI-DYNAMICS)", example: "NOVAAI-DYNAMICS" },

  // Subscription Code Tokens
  { token: "{SUB}", description: "UPPERCASE Subscription Code (e.g., CON, AIP)", example: "AIP" },
  { token: "{sub}", description: "Lowercase Subscription Code (e.g., con, aip)", example: "aip" },
  { token: "{Sub}", description: "TitleCase Subscription Code (e.g., Con, Aip)", example: "Aip" },

  // Subscription Full Name Tokens
  { token: "{SUBNAME}", description: "Full UPPERCASE Subscription Name (e.g., AI-FOUNDRY-PRODUCTION)", example: "AI-FOUNDRY-PRODUCTION" },
  { token: "{subname}", description: "Full Lowercase Subscription Name (e.g., ai-foundry-production)", example: "ai-foundry-production" },
  { token: "{SubName}", description: "Full TitleCase Subscription Name (e.g., AiFoundryProduction)", example: "AiFoundryProduction" },

  // Environment Code Tokens
  { token: "{ENV}", description: "UPPERCASE Environment Code (e.g., PRD, DEV)", example: "PRD" },
  { token: "{env}", description: "Lowercase Environment Code (e.g., prd, dev)", example: "prd" },
  { token: "{Env}", description: "TitleCase Environment Code (e.g., Prd, Dev)", example: "Prd" },

  // Environment Full Name Tokens
  { token: "{ENVNAME}", description: "Full UPPERCASE Environment Name (e.g., PRODUCTION)", example: "PRODUCTION" },
  { token: "{envname}", description: "Full Lowercase Environment Name (e.g., production)", example: "production" },
  { token: "{EnvName}", description: "Full TitleCase Environment Name (e.g., Production)", example: "Production" },

  // Resource Group Tokens
  { token: "{RG}", description: "Short Resource Group token (* in policy)", example: "core" },
  { token: "{rg}", description: "Lowercase Short RG token (* in policy)", example: "core" },
  { token: "{RGNAME}", description: "Full UPPERCASE RG Name (* in policy)", example: "CORERG" },
  { token: "{rgname}", description: "Full Lowercase RG Name (* in policy)", example: "corerg" },
  { token: "{ResourceGroup}", description: "Full Resource Group Name (* in policy)", example: "CoreRG" },

  // Regional Tokens
  { token: "{Region}", description: "Regional code (e.g., Cc, Eus)", example: "Cc" },
  { token: "{region}", description: "Lowercase region code (e.g., cc, eus)", example: "cc" },
  { token: "{REGION}", description: "UPPERCASE region code (e.g., CC, EUS)", example: "CC" },

  // Role, Service & Instance Tokens
  { token: "{Role}", description: "Server / Component role (e.g., web, dc, app)", example: "web" },
  { token: "{role}", description: "Lowercase Component role (e.g., web, dc)", example: "web" },
  { token: "{purpose}", description: "Lowercase workload/subnet purpose (e.g., core, hub, apps)", example: "core" },
  { token: "{Purpose}", description: "TitleCase purpose (e.g., Core, Hub, Apps)", example: "Core" },
  { token: "{PURPOSE}", description: "UPPERCASE purpose (e.g., CORE, HUB, APPS)", example: "CORE" },
  { token: "{abbreviation}", description: "Standard resource abbreviation (e.g., vm, oai, sa)", example: "vm" },
  { token: "{instance}", description: "Two-digit instance counter (e.g., 01, 02)", example: "01" },
  { token: "##", description: "Two-digit instance counter wildcard (01-99)", example: "01" }
];

export function resolveToken(tokenName, customer, resourceType, sampleContext = {}) {
  const orgName = customer.name || "Customer";
  const orgAbbr = customer.abbreviation || customer.name || "cust";
  const subCode = sampleContext.subCode || customer.subscriptionCode || "CON";
  const subName = sampleContext.subName || customer.subscriptionName || subCode || "Connectivity";
  const envRaw = sampleContext.environment || customer.environment || "prod";

  const envCode = (customer.environmentCode || envRaw).toLowerCase().startsWith("prod")
    ? "prd"
    : (customer.environmentCode || envRaw).toLowerCase().startsWith("dev")
    ? "dev"
    : (customer.environmentCode || envRaw).toLowerCase().startsWith("stag")
    ? "stg"
    : (customer.environmentCode || envRaw).toLowerCase().startsWith("test")
    ? "tst"
    : customer.environmentCode || envRaw || "prd";

  const envName = customer.environmentName || (
    envCode === "prd" ? "Production" :
    envCode === "dev" ? "Development" :
    envCode === "stg" ? "Staging" :
    envCode === "tst" ? "Testing" :
    envRaw || "Production"
  );

  const regionCode = sampleContext.region || (customer.regions ? Object.values(customer.regions)[0] : "cc");
  const abbr = resourceType.abbreviation || resourceType.key || "res";

  switch (tokenName) {
    // Customer Abbreviation Tokens ({Org}, {org}, {ORG})
    case "{Org}":
      return toTitleCase(orgAbbr);
    case "{org}":
      return orgAbbr.toLowerCase();
    case "{ORG}":
      return orgAbbr.toUpperCase();

    // Customer Full Name Tokens ({OrgName}, {orgname}, {ORGNAME})
    case "{OrgName}":
      return toTitleCase(orgName);
    case "{orgname}":
      return orgName.toLowerCase().replace(/\s+/g, "-");
    case "{ORGNAME}":
      return orgName.toUpperCase().replace(/\s+/g, "-");

    // Subscription Code Tokens ({SUB}, {sub}, {Sub})
    case "{SUB}":
      return subCode.toUpperCase();
    case "{sub}":
      return subCode.toLowerCase();
    case "{Sub}":
      return toTitleCase(subCode);

    // Subscription Full Name Tokens ({SUBNAME}, {subname}, {SubName})
    case "{SUBNAME}":
      return subName.toUpperCase().replace(/\s+/g, "-");
    case "{subname}":
      return subName.toLowerCase().replace(/\s+/g, "-");
    case "{SubName}":
      return toTitleCase(subName);

    // Environment Code Tokens ({ENV}, {env}, {Env})
    case "{ENV}":
      return envCode.toUpperCase();
    case "{env}":
      return envCode.toLowerCase();
    case "{Env}":
      return toTitleCase(envCode);

    // Environment Full Name Tokens ({ENVNAME}, {envname}, {EnvName})
    case "{ENVNAME}":
      return envName.toUpperCase().replace(/\s+/g, "-");
    case "{envname}":
      return envName.toLowerCase().replace(/\s+/g, "-");
    case "{EnvName}":
      return toTitleCase(envName);

    // Resource Group Tokens
    case "{RG}":
    case "{rg}":
    case "{Rg}":
      return sampleContext.forPolicy ? "*" : (sampleContext.rg || "core");
    case "{RGNAME}":
      return sampleContext.forPolicy ? "*" : (sampleContext.rg ? sampleContext.rg.toUpperCase() : "CORERG");
    case "{rgname}":
      return sampleContext.forPolicy ? "*" : (sampleContext.rg ? sampleContext.rg.toLowerCase() : "corerg");
    case "{RgName}":
    case "{ResourceGroup}":
      return sampleContext.forPolicy ? "*" : (sampleContext.rg || "CoreRG");

    // Region Tokens
    case "{Region}":
      return toTitleCase(regionCode);
    case "{region}":
      return regionCode.toLowerCase();
    case "{REGION}":
      return regionCode.toUpperCase();

    // Role
    case "{Role}":
    case "{role}":
      return sampleContext.forPolicy ? "*" : (sampleContext.role || "web");

    // Purpose Tokens
    case "{purpose}":
      return sampleContext.forPolicy
        ? "*"
        : (
            sampleContext.purpose ||
            customer?.purpose ||
            (customer?.purposes && customer.purposes[0]) ||
            "core"
          ).toLowerCase();
    case "{Purpose}":
      return sampleContext.forPolicy
        ? "*"
        : toTitleCase(
            sampleContext.purpose ||
            customer?.purpose ||
            (customer?.purposes && customer.purposes[0]) ||
            "core"
          );
    case "{PURPOSE}":
      return sampleContext.forPolicy
        ? "*"
        : (
            sampleContext.purpose ||
            customer?.purpose ||
            (customer?.purposes && customer.purposes[0]) ||
            "core"
          ).toUpperCase();

    // Abbreviation
    case "{abbreviation}":
    case "{abbr}":
    case "{type}":
    case "{Type}":
      return abbr;

    case "##":
    case "{instance}":
    case "{Instance}":
      return sampleContext.forPolicy ? "##" : (sampleContext.instance || "01");

    default:
      return tokenName;
  }
}

/**
 * Resolves a tokenized pattern into a concrete sample preview string.
 * Tokens are ordered from longest to shortest to prevent substring collision
 * (e.g., {ORGNAME} must be replaced before {ORG}).
 */
export function toSampleName(pattern, customer, resourceType, sampleContext = {}) {
  if (!pattern) return "";
  let result = pattern;

  const tokens = [
    // Long tokens first
    "{ORGNAME}", "{OrgName}", "{orgname}",
    "{SUBNAME}", "{SubName}", "{subname}",
    "{ENVNAME}", "{EnvName}", "{envname}",
    "{RGNAME}", "{RgName}", "{rgname}", "{ResourceGroup}",
    "{PURPOSE}", "{Purpose}", "{purpose}",
    "{instance}", "{Instance}",
    // Short tokens next
    "{ORG}", "{Org}", "{org}",
    "{SUB}", "{Sub}", "{sub}",
    "{ENV}", "{Env}", "{env}",
    "{RG}", "{Rg}", "{rg}",
    "{REGION}", "{Region}", "{region}",
    "{Role}", "{role}",
    "{abbreviation}", "{abbr}", "{type}", "{Type}"
  ];

  tokens.forEach((t) => {
    const val = resolveToken(t, customer, resourceType, { ...sampleContext, forPolicy: false });
    result = result.split(t).join(val);
  });

  result = result.replace(/\{instance\}|\{Instance\}|##/g, sampleContext.instance || "01");
  return result;
}

/**
 * Converts pattern into Azure Policy matchInsensitively pattern string (using * and #).
 * Long tokens replaced before short tokens; wildcard tokens converted to *.
 */
export function toAzurePolicyPattern(pattern, customer, resourceType, regionCode) {
  if (!pattern) return "*";
  let result = pattern;

  const tokens = [
    // Long tokens first
    "{ORGNAME}", "{OrgName}", "{orgname}",
    "{SUBNAME}", "{SubName}", "{subname}",
    "{ENVNAME}", "{EnvName}", "{envname}",
    "{PURPOSE}", "{Purpose}", "{purpose}",
    // Short tokens next
    "{ORG}", "{Org}", "{org}",
    "{SUB}", "{Sub}", "{sub}",
    "{ENV}", "{Env}", "{env}",
    "{REGION}", "{Region}", "{region}",
    "{abbreviation}", "{abbr}", "{type}", "{Type}"
  ];

  tokens.forEach((t) => {
    const val = resolveToken(t, customer, resourceType, { region: regionCode, forPolicy: true });
    result = result.split(t).join(val);
  });

  // ResourceGroup and wildcard tokens translate to * in Azure Policy
  result = result.replace(/\{ResourceGroup\}|\{RGNAME\}|\{rgname\}|\{RgName\}|\{RG\}|\{rg\}|\{Rg\}/g, "*");
  result = result.replace(/\{Role\}|\{role\}|\{purpose\}|\{Purpose\}|\{PURPOSE\}|\{workload\}/g, "*");
  result = result.replace(/\{instance\}|\{Instance\}|##/g, "##");

  return result;
}

/**
 * Resolves full Microsoft CAF & AirGate constraint metadata for any resource item.
 */
export function getEnrichedResourceMeta(item) {
  if (!item) {
    return {
      minLength: 1,
      maxLength: 64,
      allowedCharacters: "Alphanumerics and hyphens",
      pattern: "^[a-zA-Z0-9-_]{1,64}$",
      scope: "Resource group",
      category: "General"
    };
  }

  const resType = (item.resourceType || item.id || "").toLowerCase();
  const abbr = (item.abbreviation || item.key || "").toLowerCase();
  const key = (item.key || "").toLowerCase();

  // 1. Exact provider or id match
  let cafMeta = AZURE_NAMING_CATALOG.find((c) => {
    const prov = (c.provider || "").toLowerCase();
    const id = (c.id || "").toLowerCase();
    return resType && (prov === resType || id === resType);
  });

  // 2. Abbreviation match
  if (!cafMeta && abbr) {
    cafMeta = AZURE_NAMING_CATALOG.find((c) => {
      const cAirgate = (c.airgate_abbreviation || "").toLowerCase();
      const cCaf = (c.caf_abbreviation || "").toLowerCase();
      return cAirgate === abbr || cCaf === abbr;
    });
  }

  // 3. Fallback for storage
  if (!cafMeta && (key === "storage" || key === "sa" || key === "st")) {
    cafMeta = AZURE_NAMING_CATALOG.find((c) => c.id === "microsoft.storage/storageaccounts");
  }

  return {
    ...item,
    minLength: item.minLength || (cafMeta ? cafMeta.minLength : 1),
    maxLength: item.maxLength || (cafMeta ? cafMeta.maxLength : 64),
    allowedCharacters:
      item.allowedCharacters ||
      (cafMeta ? cafMeta.allowedCharacters : "Alphanumerics and hyphens"),
    pattern:
      item.pattern ||
      (cafMeta
        ? cafMeta.pattern
        : `^[a-zA-Z0-9-_]{${item.minLength || 1},${item.maxLength || 64}}$`),
    scope: item.scope || (cafMeta ? cafMeta.scope : "Resource group"),
    category: item.category || (cafMeta ? cafMeta.category : "General")
  };
}

/**
 * Validates candidate name or sample preview string against physical Azure ARM resource constraints.
 */
export function validateAzurePlatformConstraints(candidateName, resourceItem, context = {}) {
  const meta = getEnrichedResourceMeta(resourceItem);
  const errors = [];
  const warnings = [];

  if (!candidateName || !candidateName.trim()) {
    return {
      valid: false,
      errors: ["Candidate name cannot be empty."],
      warnings: [],
      length: 0,
      minLength: meta.minLength,
      maxLength: meta.maxLength,
      allowedCharacters: meta.allowedCharacters,
      pattern: meta.pattern
    };
  }

  const name = candidateName.trim();
  const len = name.length;
  const resType = (meta.resourceType || meta.id || "").toLowerCase();
  const key = (meta.key || meta.abbreviation || "").toLowerCase();

  const isVirtualMachine =
    resType.includes("microsoft.compute/virtualmachines") ||
    key === "vm" ||
    key === "vm_windows" ||
    key === "vm_linux";

  const effectiveOsType = context?.osType || resourceItem?.osType || meta?.osType || (key === "vm_linux" ? "Linux" : "Windows");
  const isWindowsVm = isVirtualMachine && (typeof effectiveOsType === "string" ? effectiveOsType.toLowerCase().includes("win") : true);

  // 1. Length validation
  const effectiveMaxLen = isWindowsVm ? 15 : (meta.maxLength || 64);
  if (meta.minLength && len < meta.minLength) {
    errors.push(
      `Name length (${len} chars) is below Azure minimum of ${meta.minLength} chars for ${meta.name || "this resource"}.`
    );
  }
  if (len > effectiveMaxLen) {
    if (isWindowsVm) {
      errors.push(
        `Windows computer names are strictly capped at 15 characters (Azure Active Directory / NetBIOS limit). Current: ${len} chars.`
      );
    } else {
      errors.push(
        `Name length (${len} chars) exceeds Azure maximum of ${effectiveMaxLen} chars for ${meta.name || "this resource"}.`
      );
    }
  }

  // 2. Resource-specific character type validation
  const isStorageAccount =
    resType.includes("microsoft.storage/storageaccounts") ||
    key === "storage" ||
    key === "sa" ||
    key === "st";

  const isContainerRegistry =
    resType.includes("microsoft.containerregistry/registries") || key === "cr";

  const isKeyVault =
    resType.includes("microsoft.keyvault/vaults") || key === "kv";

  const isCosmosDb =
    resType.includes("microsoft.documentdb/databaseaccounts") || key === "cosmos";

  const isSearchService =
    resType.includes("microsoft.search/searchservices") || key === "srch";

  const isResourceGroup =
    resType.includes("resourcegroups") || key === "rg";

  if (isStorageAccount) {
    // Storage account: strictly lowercase letters and numbers only, 3-24 chars, no hyphens, no underscores
    if (/[A-Z]/.test(name)) {
      errors.push("Storage account names cannot contain uppercase letters (Azure strictly requires lowercase).");
    }
    if (name.includes("-")) {
      errors.push("Storage account names cannot contain hyphens ('-').");
    }
    if (name.includes("_")) {
      errors.push("Storage account names cannot contain underscores ('_').");
    }
    if (/[^a-z0-9]/.test(name)) {
      errors.push("Storage account names may only contain lowercase letters (a-z) and numbers (0-9).");
    }
  } else if (isContainerRegistry) {
    // ACR: alphanumeric only, 5-50 chars, no hyphens, no underscores
    if (name.includes("-")) {
      errors.push("Container Registry (ACR) names cannot contain hyphens ('-').");
    }
    if (name.includes("_")) {
      errors.push("Container Registry (ACR) names cannot contain underscores ('_').");
    }
    if (/[^a-zA-Z0-9]/.test(name)) {
      errors.push("Container Registry names must be alphanumeric only (no symbols or hyphens).");
    }
  } else if (isKeyVault) {
    // Key Vault: 3-24 chars, alphanumerics and hyphens, no underscores, cannot start or end with hyphen
    if (name.includes("_")) {
      errors.push("Key Vault names cannot contain underscores ('_'). Only hyphens are allowed.");
    }
    if (name.startsWith("-") || name.endsWith("-")) {
      errors.push("Key Vault names cannot begin or end with a hyphen ('-').");
    }
    if (/[^a-zA-Z0-9-]/.test(name)) {
      errors.push("Key Vault names only permit alphanumeric characters and hyphens.");
    }
  } else if (isVirtualMachine) {
    if (isWindowsVm) {
      if (name.includes("_")) {
        errors.push("Windows computer names cannot contain underscores ('_').");
      }
      if (name.includes(".")) {
        errors.push("Windows computer names cannot contain periods ('.').");
      }
      if (name.startsWith("-") || name.endsWith("-")) {
        errors.push("Windows computer names cannot begin or end with a hyphen ('-').");
      }
      if (/^[0-9]+$/.test(name)) {
        errors.push("Windows computer names cannot be composed entirely of numbers.");
      }
      if (/[^a-zA-Z0-9-]/.test(name)) {
        errors.push("Windows computer names only allow alphanumeric characters and hyphens.");
      }
    } else {
      if (name.includes("_")) {
        errors.push("Linux hostnames cannot contain underscores ('_').");
      }
      if (name.startsWith("-") || name.endsWith("-")) {
        errors.push("Linux hostnames cannot begin or end with a hyphen ('-').");
      }
      if (/[^a-zA-Z0-9-]/.test(name)) {
        errors.push("Linux hostnames only allow alphanumeric characters and hyphens.");
      }
    }
  }
 else if (isCosmosDb || isSearchService) {
    // Lowercase alphanumeric and hyphens
    if (/[A-Z]/.test(name)) {
      errors.push(`${meta.name || "This resource"} strictly requires lowercase letters and numbers (no uppercase).`);
    }
    if (name.includes("_")) {
      errors.push("Underscores ('_') are not allowed.");
    }
  } else if (isResourceGroup) {
    if (name.endsWith(".")) {
      errors.push("Resource Group names cannot end with a period ('.').");
    }
  }

  // 3. Regex pattern match from catalogue if no specific errors captured yet
  if (meta.pattern && errors.length === 0) {
    try {
      const reg = new RegExp(meta.pattern);
      if (!reg.test(name)) {
        errors.push(`Name does not conform to Azure character specification: ${meta.allowedCharacters || meta.pattern}`);
      }
    } catch {
      // ignore invalid regex in catalog
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    length: len,
    minLength: meta.minLength,
    maxLength: effectiveMaxLen,
    allowedCharacters: isWindowsVm
      ? "Alphanumerics and hyphens (max 15 chars for Windows NetBIOS)"
      : (isVirtualMachine ? "Alphanumerics and hyphens (max 64 chars for Linux)" : meta.allowedCharacters),
    pattern: isWindowsVm ? "^[a-zA-Z0-9-]{1,15}$" : meta.pattern,
    osType: isVirtualMachine ? (isWindowsVm ? "Windows" : "Linux") : undefined
  };
}

/**
 * Validates the template pattern string structure itself against resource constraints.
 */
export function validatePatternStructure(pattern, resourceItem, context = {}) {
  if (!pattern) {
    return { valid: false, errors: ["Pattern cannot be empty."], warnings: [] };
  }

  const meta = getEnrichedResourceMeta(resourceItem);
  const errors = [];
  const warnings = [];

  const resType = (meta.resourceType || meta.id || "").toLowerCase();
  const key = (meta.key || meta.abbreviation || "").toLowerCase();

  const isVirtualMachine =
    resType.includes("microsoft.compute/virtualmachines") ||
    key === "vm" ||
    key === "vm_windows" ||
    key === "vm_linux";

  const effectiveOsType = context?.osType || resourceItem?.osType || meta?.osType || (key === "vm_linux" ? "Linux" : "Windows");
  const isWindowsVm = isVirtualMachine && (typeof effectiveOsType === "string" ? effectiveOsType.toLowerCase().includes("win") : true);

  const isStorageAccount =
    resType.includes("microsoft.storage/storageaccounts") ||
    key === "storage" ||
    key === "sa" ||
    key === "st";

  const isContainerRegistry =
    resType.includes("microsoft.containerregistry/registries") || key === "cr";

  const isKeyVault =
    resType.includes("microsoft.keyvault/vaults") || key === "kv";

  const isCosmosDb =
    resType.includes("microsoft.documentdb/databaseaccounts") || key === "cosmos";

  const isSearchService =
    resType.includes("microsoft.search/searchservices") || key === "srch";

  if (isStorageAccount) {
    if (pattern.includes("-")) {
      errors.push("Storage account patterns cannot contain hyphens ('-') as Azure strictly rejects them.");
    }
    if (pattern.includes("_")) {
      errors.push("Storage account patterns cannot contain underscores ('_').");
    }
    if (
      /\{ORG\}|\{Org\}|\{ORGNAME\}|\{OrgName\}|\{SUB\}|\{Sub\}|\{SUBNAME\}|\{SubName\}|\{ENV\}|\{Env\}|\{ENVNAME\}|\{EnvName\}|\{ResourceGroup\}|\{RGNAME\}|\{RgName\}|\{REGION\}|\{Region\}/.test(
        pattern
      )
    ) {
      errors.push(
        "Pattern uses TitleCase/UPPERCASE tokens (e.g., {Org}, {SUB}). Storage accounts strictly require lowercase tokens (e.g., {org}, {sub}, {rg}, {region})."
      );
    }
  } else if (isContainerRegistry) {
    if (pattern.includes("-")) {
      errors.push("Container Registry (ACR) patterns cannot contain hyphens ('-').");
    }
    if (pattern.includes("_")) {
      errors.push("Container Registry (ACR) patterns cannot contain underscores ('_').");
    }
  } else if (isKeyVault) {
    if (pattern.includes("_")) {
      errors.push("Key Vault patterns cannot contain underscores ('_'). Use hyphens ('-') instead.");
    }
  } else if (isCosmosDb || isSearchService) {
    if (/\{ORG\}|\{Org\}|\{SUB\}|\{ENV\}|\{ResourceGroup\}/.test(pattern)) {
      warnings.push("Resource requires lowercase letters. Consider using lowercase tokens (e.g., {org}, {sub}, {rg}).");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Automatically sanitizes an invalid pattern for a resource type.
 */
export function autoFixPatternForResource(pattern, resourceItem) {
  if (!pattern) return pattern;
  const meta = getEnrichedResourceMeta(resourceItem);
  const resType = (meta.resourceType || meta.id || "").toLowerCase();
  const key = (meta.key || meta.abbreviation || "").toLowerCase();

  const isStorageAccount =
    resType.includes("microsoft.storage/storageaccounts") ||
    key === "storage" ||
    key === "sa" ||
    key === "st";

  const isContainerRegistry =
    resType.includes("microsoft.containerregistry/registries") || key === "cr";

  const isKeyVault =
    resType.includes("microsoft.keyvault/vaults") || key === "kv";

  let fixed = pattern;

  if (isStorageAccount) {
    // Convert uppercase/TitleCase tokens to lowercase tokens
    fixed = fixed
      .replace(/\{ORGNAME\}|\{OrgName\}/g, "{orgname}")
      .replace(/\{SUBNAME\}|\{SubName\}/g, "{subname}")
      .replace(/\{ENVNAME\}|\{EnvName\}/g, "{envname}")
      .replace(/\{ResourceGroup\}|\{RGNAME\}|\{RgName\}|\{RG\}|\{Rg\}/g, "{rg}")
      .replace(/\{ORG\}|\{Org\}/g, "{org}")
      .replace(/\{SUB\}|\{Sub\}/g, "{sub}")
      .replace(/\{ENV\}|\{Env\}/g, "{env}")
      .replace(/\{REGION\}|\{Region\}/g, "{region}")
      .replace(/\{Role\}|\{role\}/g, "diag")
      .replace(/[-_]/g, "") // Remove hyphens and underscores
      .replace(/([^{}]+)/g, (m) => m.toLowerCase()); // Lowercase literal text outside {tokens}
  } else if (isContainerRegistry) {
    fixed = fixed
      .replace(/\{ResourceGroup\}|\{RGNAME\}|\{RgName\}/g, "{rg}")
      .replace(/[-_]/g, "");
  } else if (isKeyVault) {
    // Replace underscores with hyphens
    fixed = fixed.replace(/_/g, "-");
  }

  return fixed;
}

/**
 * Validates candidate name against both Azure Policy wildcard rule and Azure ARM platform limits.
 */
export function validateCandidateName(candidate, pattern, customer, resourceType, regionCode, purposeCode, options = {}) {
  if (!candidate || !candidate.trim()) {
    return {
      valid: false,
      matchesPolicy: false,
      platformValid: false,
      reason: "Please enter a name to test."
    };
  }

  const region = typeof regionCode === "object" ? regionCode.region : regionCode;
  const purpose =
    (typeof regionCode === "object" ? regionCode.purpose : purposeCode) ||
    customer?.purpose ||
    (customer?.purposes && customer.purposes[0]) ||
    "core";

  const opts = typeof regionCode === "object" ? regionCode : (typeof purposeCode === "object" ? purposeCode : options);
  const effectiveOsType = opts?.osType || options?.osType || resourceType?.osType;

  const name = candidate.trim();
  const policyPattern = toAzurePolicyPattern(pattern, customer, resourceType, region);

  // Convert policy pattern (* -> .*, # -> [0-9], ? -> [a-zA-Z]) into Regex
  const regexStr =
    "^" +
    policyPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/#/g, "[0-9]")
      .replace(/\?/g, "[A-Za-z]") +
    "$";

  const regex = new RegExp(regexStr, "i");
  const isMatch = regex.test(name);

  // Check physical Azure platform constraints
  const platformValidation = validateAzurePlatformConstraints(name, resourceType, { osType: effectiveOsType });

  if (!platformValidation.valid) {
    const errorMsg = platformValidation.errors.join("; ");
    return {
      valid: false,
      matchesPolicy: isMatch,
      platformValid: false,
      reason: `Azure platform constraint violation: ${errorMsg}`,
      pattern: policyPattern,
      errors: platformValidation.errors,
      warnings: platformValidation.warnings,
      length: platformValidation.length,
      maxLength: platformValidation.maxLength,
      minLength: platformValidation.minLength,
      allowedCharacters: platformValidation.allowedCharacters
    };
  }

  if (!isMatch) {
    return {
      valid: false,
      matchesPolicy: false,
      platformValid: true,
      reason: `Does not match expected pattern format: ${policyPattern}`,
      pattern: policyPattern,
      errors: [`Does not match pattern: ${policyPattern}`],
      warnings: platformValidation.warnings,
      length: platformValidation.length,
      maxLength: platformValidation.maxLength,
      minLength: platformValidation.minLength,
      allowedCharacters: platformValidation.allowedCharacters
    };
  }

  return {
    valid: true,
    matchesPolicy: true,
    platformValid: true,
    reason: `Valid! Matches pattern '${policyPattern}' and satisfies all Azure platform constraints (${name.length} chars).`,
    pattern: policyPattern,
    errors: [],
    warnings: platformValidation.warnings,
    length: platformValidation.length,
    maxLength: platformValidation.maxLength,
    minLength: platformValidation.minLength,
    allowedCharacters: platformValidation.allowedCharacters
  };
}

