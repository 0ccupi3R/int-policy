// Azure Bicep Generator for ALZ Naming Conventions and Granular Tag Governance

import { toAzurePolicyPattern } from "./tokenParser.js";

function escapeBicepString(val) {
  if (typeof val !== "string") return val;
  return val.replace(/'/g, "\\'");
}

function formatBicepArray(arr) {
  if (!arr || arr.length === 0) return "[]";
  const formatted = arr.map((item) => `'${escapeBicepString(item)}'`).join(", ");
  return `[${formatted}]`;
}

export function generateBicep(customer, catalog) {
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = customer.subscriptionCode || "CON";
  const prefix = `${orgAbbr.toLowerCase()}-${subCode.toLowerCase()}`;
  const version = customer.version || "1.0.0";
  const dateStr = new Date().toISOString().split("T")[0];

  const regions = customer.regions || { canadacentral: "cc", canadaeast: "ce" };
  const namingRules = customer.namingRules || {};
  const unrestrictedTypes = namingRules.unrestrictedTypes || [];
  const customPatterns = namingRules.customPatterns || {};
  const subnetAllowed = namingRules.subnetNaming?.allowedNames || [
    "snet-apps", "snet-core", "snet-management", "GatewaySubnet", "AzureBastionSubnet", "AzureFirewallSubnet"
  ];

  const subTags = customer.tags?.subscription || [];
  const rgTags = customer.tags?.resourceGroup || [];
  const resTags = customer.tags?.resource || [];

  let bicep = `// ==============================================================================
// Azure Landing Zone Policy Bundle: Naming Conventions & Tag Governance
// Customer: ${customer.name} (${customer.abbreviation})
// Subscription: ${customer.subscriptionName} (${subCode})
// Version: ${version} | Generated: ${dateStr}
// Microsoft Cloud Adoption Framework (CAF) Enterprise Scale Architecture
// ==============================================================================

targetScope = 'subscription'

metadata name = '${customer.name} ALZ Policy Bundle'
metadata description = 'Config-driven Azure policies for Resource Naming Conventions and Granular Tag Governance'
metadata version = '${version}'

@description('Enforcement effect for Resource Naming Conventions')
@allowed(['Audit', 'Deny', 'Disabled'])
param namingEffect string = '${customer.namingEffect || "Audit"}'

@description('Enforcement effect for Subnet Naming Allowlist')
@allowed(['Audit', 'Deny', 'Disabled'])
param subnetEffect string = '${customer.subnetEffect || "Audit"}'

@description('Enforcement effect for Tag Governance')
@allowed(['Audit', 'Deny', 'Disabled'])
param tagEffect string = '${customer.tagEffect || "Audit"}'

@description('Enforcement effect for Regional Geo-Restriction (Canada Central & Canada East)')
@allowed(['Audit', 'Deny', 'Disabled'])
param geoEffect string = '${customer.geoRestrictions?.effect || "Audit"}'

@description('Enforcement effect for Tag Inheritance & Automated Defaulting')
@allowed(['modify', 'audit', 'disabled'])
param tagInheritanceEffect string = '${customer.tagInheritance?.effect || "modify"}'

@description('Primary deployment location for Managed Identity assignment')
param location string = '${customer.defaultRegion || "canadacentral"}'

@description('Policy assignment enforcement mode')
@allowed(['Default', 'DoNotEnforce'])
param enforcementMode string = '${customer.enforcementMode || "Default"}'

@description('Excluded scopes (e.g., exempted resource groups)')
param notScopes array = []

// ==============================================================================
// 1. RESOURCE NAMING POLICY DEFINITIONS
// ==============================================================================
`;

  // Active naming items
  const activeItems = [];

  catalog.forEach((item) => {
    if (item.key === "snet") return; // Handled specially in subnet policy
    if (unrestrictedTypes.includes(item.key)) return; // Direct creation (unrestricted)

    const pattern = customPatterns[item.key] || namingRules.globalPattern || item.defaultPattern;
    const resourceDefName = `policyNaming_${item.key}`;
    activeItems.push({ item, resourceDefName, pattern });

    const regionBranches = Object.entries(regions).map(([locName, locCode]) => {
      const polPattern = toAzurePolicyPattern(pattern, customer, item, locCode);
      return `                  {
                    allOf: [
                      {
                        field: 'location'
                        equals: '${locName}'
                      }
                      {
                        field: 'name'
                        matchInsensitively: '${polPattern}'
                      }
                    ]
                  }`;
    }).join("\n");

    bicep += `
resource ${resourceDefName} 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${prefix}-naming-${item.key}'
  properties: {
    displayName: '${customer.name} Naming - ${item.name}'
    description: 'Enforces ${customer.name} naming convention for ${item.name} (${item.abbreviation}).'
    mode: 'All'
    metadata: {
      category: 'Naming'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: '${item.resourceType}'
          }
          {
            not: {
              anyOf: [
${regionBranches}
              ]
            }
          }
        ]
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
      }
    }
  }
}
`;
  });

  // Subnet Policy Definition
  bicep += `
// Subnet Naming Policy (Standalone & Inline array)
resource policyNaming_subnet 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${prefix}-naming-subnet'
  properties: {
    displayName: '${customer.name} Naming - Subnet'
    description: 'Enforces approved allowlist for standalone and inline Virtual Network subnets.'
    mode: 'All'
    metadata: {
      category: 'Naming'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
    }
    policyRule: {
      if: {
        anyOf: [
          {
            allOf: [
              {
                field: 'type'
                equals: 'Microsoft.Network/virtualNetworks/subnets'
              }
              {
                field: 'name'
                notIn: ${formatBicepArray(subnetAllowed)}
              }
            ]
          }
          {
            allOf: [
              {
                field: 'type'
                equals: 'Microsoft.Network/virtualNetworks'
              }
              {
                count: {
                  field: 'Microsoft.Network/virtualNetworks/subnets[*]'
                  where: {
                    field: 'Microsoft.Network/virtualNetworks/subnets[*].name'
                    notIn: ${formatBicepArray(subnetAllowed)}
                  }
                }
                greater: 0
              }
            ]
          }
        ]
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
      }
    }
  }
}

// ==============================================================================
// 2. TAG GOVERNANCE POLICY DEFINITIONS (SUBSCRIPTION -> RG -> RESOURCE)
// ==============================================================================
`;

  const tagDefRefs = [];

  // 2a. Subscription level tags (mode: All, type: Microsoft.Resources/subscriptions)
  subTags.forEach((tag, idx) => {
    const defVar = `policyTag_sub_${idx}`;
    const defName = `${prefix}-tag-sub-${tag.key.toLowerCase()}`;
    const allowed = [...tag.allowedValues];
    if (!tag.required && !allowed.includes("NA") && !allowed.includes("N/A")) {
      allowed.push("NA", "N/A");
    }

    tagDefRefs.push({
      idRef: `${defVar}.id`,
      refId: `tag-sub-${tag.key.toLowerCase()}`,
      msg: `Subscription must have tag '${tag.key}' with one of: ${tag.allowedValues.join(", ")}`
    });

    const conditionBlock = tag.required ? `        anyOf: [
          {
            field: 'tags[\\'${tag.key}\\']'
            exists: 'false'
          }
          {
            field: 'tags[\\'${tag.key}\\']'
            notIn: ${formatBicepArray(allowed)}
          }
        ]` : `        allOf: [
          {
            field: 'tags[\\'${tag.key}\\']'
            exists: 'true'
          }
          {
            field: 'tags[\\'${tag.key}\\']'
            notIn: ${formatBicepArray(allowed)}
          }
        ]`;

    bicep += `
resource ${defVar} 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${defName}'
  properties: {
    displayName: '${customer.name} Tag (Subscription) - ${tag.displayName || tag.key}'
    description: 'Enforces tag ${tag.key} on Subscription level. Required: ${tag.required ? "Yes" : "No (NA accepted)"}'
    mode: 'All'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.Resources/subscriptions'
          }
          {
${conditionBlock}
          }
        ]
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
      }
    }
  }
}
`;
  });

  // 2b. Resource Group level tags (mode: All, type: Microsoft.Resources/subscriptions/resourceGroups)
  rgTags.forEach((tag, idx) => {
    const defVar = `policyTag_rg_${idx}`;
    const defName = `${prefix}-tag-rg-${tag.key.toLowerCase()}`;
    const allowed = [...tag.allowedValues];
    if (!tag.required && !allowed.includes("NA") && !allowed.includes("N/A")) {
      allowed.push("NA", "N/A");
    }

    tagDefRefs.push({
      idRef: `${defVar}.id`,
      refId: `tag-rg-${tag.key.toLowerCase()}`,
      msg: `Resource Group must have tag '${tag.key}' with one of: ${tag.allowedValues.join(", ")}`
    });

    const conditionBlock = tag.required ? `        anyOf: [
          {
            field: 'tags[\\'${tag.key}\\']'
            exists: 'false'
          }
          {
            field: 'tags[\\'${tag.key}\\']'
            notIn: ${formatBicepArray(allowed)}
          }
        ]` : `        allOf: [
          {
            field: 'tags[\\'${tag.key}\\']'
            exists: 'true'
          }
          {
            field: 'tags[\\'${tag.key}\\']'
            notIn: ${formatBicepArray(allowed)}
          }
        ]`;

    bicep += `
resource ${defVar} 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${defName}'
  properties: {
    displayName: '${customer.name} Tag (Resource Group) - ${tag.displayName || tag.key}'
    description: 'Enforces tag ${tag.key} on Resource Groups. Required: ${tag.required ? "Yes" : "No (NA accepted)"}'
    mode: 'All'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.Resources/subscriptions/resourceGroups'
          }
          {
${conditionBlock}
          }
        ]
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
      }
    }
  }
}
`;
  });

  // 2c. Resource level tags (mode: Indexed)
  resTags.forEach((tag, idx) => {
    const defVar = `policyTag_res_${idx}`;
    const defName = `${prefix}-tag-res-${tag.key.toLowerCase()}`;
    const allowed = [...tag.allowedValues];
    if (!tag.required && !allowed.includes("NA") && !allowed.includes("N/A")) {
      allowed.push("NA", "N/A");
    }

    tagDefRefs.push({
      idRef: `${defVar}.id`,
      refId: `tag-res-${tag.key.toLowerCase()}`,
      msg: `Resource must have tag '${tag.key}' with one of: ${tag.allowedValues.join(", ")}`
    });

    const conditionBlock = tag.required ? `      anyOf: [
        {
          field: 'tags[\\'${tag.key}\\']'
          exists: 'false'
        }
        {
          field: 'tags[\\'${tag.key}\\']'
          notIn: ${formatBicepArray(allowed)}
        }
      ]` : `      allOf: [
        {
          field: 'tags[\\'${tag.key}\\']'
          exists: 'true'
        }
        {
          field: 'tags[\\'${tag.key}\\']'
          notIn: ${formatBicepArray(allowed)}
        }
      ]`;

    bicep += `
resource ${defVar} 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${defName}'
  properties: {
    displayName: '${customer.name} Tag (Resource) - ${tag.displayName || tag.key}'
    description: 'Enforces tag ${tag.key} on all taggable resources. Required: ${tag.required ? "Yes" : "No (NA accepted)"}'
    mode: 'Indexed'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
    }
    policyRule: {
      if: {
${conditionBlock}
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
      }
    }
  }
}
`;
  });

  // ==============================================================================
  // 2d. TAG INHERITANCE & DEFAULTING POLICY DEFINITIONS (modify effect)
  // ==============================================================================
  const geoRestrictions = customer.geoRestrictions || { enabled: true, allowedLocations: ["canadacentral", "canadaeast"], effect: "Audit" };
  const allowedLocations = geoRestrictions.allowedLocations || Object.keys(regions);

  const tagInheritance = customer.tagInheritance || {
    enabled: true,
    effect: "modify",
    subToRg: ["CostCenter", "Owner"],
    rgToResource: ["Environment", "CostCenter", "Workload", "Owner"],
    defaultResourceNA: ["DataClassification", "Criticality"]
  };

  const subToRgKeys = (tagInheritance.subToRg || []).map((k) => (typeof k === "string" ? k : k.key));
  const rgToResKeys = (tagInheritance.rgToResource || []).map((k) => (typeof k === "string" ? k : k.key));
  const defaultNAKeys = (tagInheritance.defaultResourceNA || []).map((k) => (typeof k === "string" ? k : k.key));

  const inheritanceDefRefs = [];

  bicep += `
// ==============================================================================
// 2d. TAG INHERITANCE & DEFAULTING POLICY DEFINITIONS (modify effect)
// ==============================================================================
`;

  // 2d-1. Inherit from Subscription to Resource Group
  subToRgKeys.forEach((key, idx) => {
    const defVar = `policyInherit_sub_rg_${idx}`;
    const defName = `${prefix}-inherit-sub-rg-${key.toLowerCase()}`;
    inheritanceDefRefs.push({
      idRef: `${defVar}.id`,
      refId: `inherit-sub-rg-${key.toLowerCase()}`
    });

    bicep += `
resource ${defVar} 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${defName}'
  properties: {
    displayName: '${customer.name} Inherit Tag (Sub to RG) - ${key}'
    description: 'Inherits tag ${key} from subscription to Resource Group if missing.'
    mode: 'All'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'modify'
        allowedValues: ['modify', 'audit', 'disabled']
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.Resources/subscriptions/resourceGroups'
          }
          {
            field: 'tags[\\'${key}\\']'
            exists: 'false'
          }
          {
            value: '[subscription().tags[\\'${key}\\']]'
            notEquals: ''
          }
        ]
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
        details: {
          roleDefinitionIds: [
            '/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c'
          ]
          operations: [
            {
              operation: 'add'
              field: 'tags[\\'${key}\\']'
              value: '[subscription().tags[\\'${key}\\']]'
            }
          ]
        }
      }
    }
  }
}
`;
  });

  // 2d-2. Inherit from Resource Group to Resources
  rgToResKeys.forEach((key, idx) => {
    const defVar = `policyInherit_rg_res_${idx}`;
    const defName = `${prefix}-inherit-rg-res-${key.toLowerCase()}`;
    inheritanceDefRefs.push({
      idRef: `${defVar}.id`,
      refId: `inherit-rg-res-${key.toLowerCase()}`
    });

    bicep += `
resource ${defVar} 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${defName}'
  properties: {
    displayName: '${customer.name} Inherit Tag (RG to Resource) - ${key}'
    description: 'Inherits tag ${key} from parent Resource Group to resource if missing.'
    mode: 'Indexed'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'modify'
        allowedValues: ['modify', 'audit', 'disabled']
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'tags[\\'${key}\\']'
            exists: 'false'
          }
          {
            value: '[resourceGroup().tags[\\'${key}\\']]'
            notEquals: ''
          }
        ]
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
        details: {
          roleDefinitionIds: [
            '/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c'
          ]
          operations: [
            {
              operation: 'add'
              field: 'tags[\\'${key}\\']'
              value: '[resourceGroup().tags[\\'${key}\\']]'
            }
          ]
        }
      }
    }
  }
}
`;
  });

  // 2d-3. Default empty/missing resource tags to "NA"
  defaultNAKeys.forEach((key, idx) => {
    const defVar = `policyDefault_res_na_${idx}`;
    const defName = `${prefix}-default-res-na-${key.toLowerCase()}`;
    inheritanceDefRefs.push({
      idRef: `${defVar}.id`,
      refId: `default-res-na-${key.toLowerCase()}`
    });

    bicep += `
resource ${defVar} 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: '${defName}'
  properties: {
    displayName: '${customer.name} Default Tag to NA on Resource - ${key}'
    description: 'Defaults empty or missing tag ${key} on resource to NA.'
    mode: 'Indexed'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'modify'
        allowedValues: ['modify', 'audit', 'disabled']
      }
    }
    policyRule: {
      if: {
        anyOf: [
          {
            field: 'tags[\\'${key}\\']'
            exists: 'false'
          }
          {
            field: 'tags[\\'${key}\\']'
            equals: ''
          }
        ]
      }
      then: {
        effect: '[parameters(\\'effect\\')]'
        details: {
          roleDefinitionIds: [
            '/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c'
          ]
          operations: [
            {
              operation: 'addOrReplace'
              field: 'tags[\\'${key}\\']'
              value: 'NA'
            }
          ]
        }
      }
    }
  }
}
`;
  });

  // ==============================================================================
  // 3. INITIATIVES (POLICY SETS)
  // ==============================================================================
  const namingInitiativeName = `${prefix}-naming-initiative`;
  const tagInitiativeName = `${prefix}-tag-governance-initiative`;
  const tagInheritanceInitiativeName = `${prefix}-tag-inheritance-initiative`;

  let namingPolicyDefs = activeItems.map(({ item, resourceDefName }) => `      {
        policyDefinitionId: ${resourceDefName}.id
        policyDefinitionReferenceId: 'naming-${item.key}'
        parameters: {
          effect: { value: '[parameters(\\'namingEffect\\')]' }
        }
      }`).concat([
    `      {
        policyDefinitionId: policyNaming_subnet.id
        policyDefinitionReferenceId: 'naming-subnet'
        parameters: {
          effect: { value: '[parameters(\\'subnetEffect\\')]' }
        }
      }`
  ]);

  if (geoRestrictions.enabled !== false) {
    namingPolicyDefs.push(`      {
        policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4c'
        policyDefinitionReferenceId: 'allowed-locations-resources'
        parameters: {
          listOfAllowedLocations: { value: ${formatBicepArray(allowedLocations)} }
          effect: { value: '[parameters(\\'geoEffect\\')]' }
        }
      }`);
    namingPolicyDefs.push(`      {
        policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/e765b5de-1225-4ba3-bd56-1ac6695af988'
        policyDefinitionReferenceId: 'allowed-locations-resource-groups'
        parameters: {
          listOfAllowedLocations: { value: ${formatBicepArray(allowedLocations)} }
          effect: { value: '[parameters(\\'geoEffect\\')]' }
        }
      }`);
  }

  const namingPolicyDefsStr = namingPolicyDefs.join("\n");

  const tagPolicyDefs = tagDefRefs.map((ref) => `      {
        policyDefinitionId: ${ref.idRef}
        policyDefinitionReferenceId: '${ref.refId}'
        parameters: {
          effect: { value: '[parameters(\\'tagEffect\\')]' }
        }
      }`).join("\n");

  const inheritancePolicyDefs = inheritanceDefRefs.map((ref) => `      {
        policyDefinitionId: ${ref.idRef}
        policyDefinitionReferenceId: '${ref.refId}'
        parameters: {
          effect: { value: '[parameters(\\'tagInheritanceEffect\\')]' }
        }
      }`).join("\n");

  bicep += `
// ==============================================================================
// 3. POLICY INITIATIVES (POLICY SET DEFINITIONS)
// ==============================================================================

resource namingInitiative 'Microsoft.Authorization/policySetDefinitions@2023-04-01' = {
  name: '${namingInitiativeName}'
  properties: {
    displayName: '${customer.name} Naming & Geo-Boundary Initiative'
    description: 'Enforces type-specific naming rules and regional geo-restrictions across ${customer.name} Azure resources.'
    metadata: {
      category: 'Naming'
      version: '${version}'
    }
    parameters: {
      namingEffect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
      subnetEffect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
      geoEffect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
    }
    policyDefinitions: [
${namingPolicyDefsStr}
    ]
  }
}

resource taggingInitiative 'Microsoft.Authorization/policySetDefinitions@2023-04-01' = {
  name: '${tagInitiativeName}'
  properties: {
    displayName: '${customer.name} Tag Governance Initiative'
    description: 'Enforces mandatory and allowed tags across Subscriptions, Resource Groups, and Resources.'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      tagEffect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: ['Audit', 'Deny', 'Disabled']
      }
    }
    policyDefinitions: [
${tagPolicyDefs}
    ]
  }
}

resource tagInheritanceInitiative 'Microsoft.Authorization/policySetDefinitions@2023-04-01' = {
  name: '${tagInheritanceInitiativeName}'
  properties: {
    displayName: '${customer.name} Tag Inheritance & Remediation Initiative'
    description: 'Automates one-way tag inheritance from Subscription to RG, RG to Resources, and defaults empty resource tags to NA.'
    metadata: {
      category: 'Tags'
      version: '${version}'
    }
    parameters: {
      tagInheritanceEffect: {
        type: 'String'
        defaultValue: 'modify'
        allowedValues: ['modify', 'audit', 'disabled']
      }
    }
    policyDefinitions: [
${inheritancePolicyDefs}
    ]
  }
}

// ==============================================================================
// 4. POLICY ASSIGNMENTS & MANAGED IDENTITY
// ==============================================================================

resource namingAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: '${prefix}-naming-assignment'
  properties: {
    displayName: '${customer.name} Naming & Geo-Boundary Assignment'
    description: 'Enforces type-specific naming rules and regional geo-restrictions for ${customer.name}.'
    policyDefinitionId: namingInitiative.id
    enforcementMode: enforcementMode
    notScopes: notScopes
    parameters: {
      namingEffect: { value: namingEffect }
      subnetEffect: { value: subnetEffect }
      geoEffect: { value: geoEffect }
    }
    nonComplianceMessages: [
      {
        message: 'Resource names must match the approved ${customer.name} naming convention.'
      }
      {
        message: 'Subnet names must be in the approved allowlist.'
        policyDefinitionReferenceId: 'naming-subnet'
      }
      {
        message: 'Resources must be deployed within approved regions (${allowedLocations.join(", ")}).'
        policyDefinitionReferenceId: 'allowed-locations-resources'
      }
      {
        message: 'Resource groups must be created within approved regions (${allowedLocations.join(", ")}).'
        policyDefinitionReferenceId: 'allowed-locations-resource-groups'
      }
    ]
  }
}

resource taggingAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: '${prefix}-tag-governance-assignment'
  properties: {
    displayName: '${customer.name} Tag Governance Assignment'
    description: 'Enforces tag keys and allowed values across Subscriptions, Resource Groups, and Resources.'
    policyDefinitionId: taggingInitiative.id
    enforcementMode: enforcementMode
    notScopes: notScopes
    parameters: {
      tagEffect: { value: tagEffect }
    }
    nonComplianceMessages: [
      {
        message: 'Entity must contain mandatory governance tags with approved values.'
      }
    ]
  }
}

resource tagInheritanceAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: '${prefix}-tag-inheritance-assignment'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: '${customer.name} Tag Inheritance & Remediation Assignment'
    description: 'Automates one-way tag inheritance from Subscription to RG, RG to Resources, and defaults empty resource tags to NA.'
    policyDefinitionId: tagInheritanceInitiative.id
    enforcementMode: enforcementMode
    notScopes: notScopes
    parameters: {
      tagInheritanceEffect: { value: tagInheritanceEffect }
    }
    nonComplianceMessages: [
      {
        message: 'Entity must inherit common tags or default empty tags to NA.'
      }
    ]
  }
}

resource tagContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, tagInheritanceAssignment.id, 'b24988ac-6180-42a0-ab88-20f7382dd24c')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: tagInheritanceAssignment.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ==============================================================================
// OUTPUTS
// ==============================================================================
output namingAssignmentId string = namingAssignment.id
output tagAssignmentId string = taggingAssignment.id
output tagInheritanceAssignmentId string = tagInheritanceAssignment.id
output namingInitiativeId string = namingInitiative.id
output tagInitiativeId string = taggingInitiative.id
output tagInheritanceInitiativeId string = tagInheritanceInitiative.id
`;

  return bicep;
}
