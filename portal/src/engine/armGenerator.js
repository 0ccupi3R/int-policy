// Azure Resource Manager (ARM) JSON Generator

import { toAzurePolicyPattern } from "./tokenParser.js";

export function generateArmTemplate(customer, catalog) {
  const orgAbbr = customer.abbreviation || customer.name || "cust01";
  const subCode = customer.subscriptionCode || "CON";
  const prefix = `${orgAbbr.toLowerCase()}-${subCode.toLowerCase()}`;
  const version = customer.version || "1.0.0";

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

  const resources = [];
  const namingInitiativeRefs = [];
  const tagInitiativeRefs = [];

  // Naming Definitions
  catalog.forEach((item) => {
    if (item.key === "snet") return;
    if (unrestrictedTypes.includes(item.key)) return;

    const pattern = customPatterns[item.key] || namingRules.globalPattern || item.defaultPattern;
    const defName = `${prefix}-naming-${item.key}`;

    const allowedAnyOf = Object.entries(regions).map(([locName, locCode]) => {
      const polPattern = toAzurePolicyPattern(pattern, customer, item, locCode);
      return {
        allOf: [
          { field: "location", equals: locName },
          { field: "name", matchInsensitively: polPattern }
        ]
      };
    });

    resources.push({
      type: "Microsoft.Authorization/policyDefinitions",
      apiVersion: "2023-04-01",
      name: defName,
      properties: {
        displayName: `${customer.name} Naming - ${item.name}`,
        description: `Enforces ${customer.name} naming convention for ${item.name}.`,
        mode: "All",
        metadata: { category: "Naming", version },
        parameters: {
          effect: {
            type: "String",
            allowedValues: ["Audit", "Deny", "Disabled"],
            defaultValue: "Audit"
          }
        },
        policyRule: {
          if: {
            allOf: [
              { field: "type", equals: item.resourceType },
              { not: { anyOf: allowedAnyOf } }
            ]
          },
          then: { effect: "[[parameters('effect')]" }
        }
      }
    });

    namingInitiativeRefs.push({
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${defName}')]`,
      policyDefinitionReferenceId: `naming-${item.key}`,
      parameters: { effect: { value: "[[parameters('namingEffect')]" } }
    });
  });

  // Subnet definition
  const subnetDefName = `${prefix}-naming-subnet`;
  resources.push({
    type: "Microsoft.Authorization/policyDefinitions",
    apiVersion: "2023-04-01",
    name: subnetDefName,
    properties: {
      displayName: `${customer.name} Naming - Subnet`,
      description: "Enforces approved allowlist for standalone and inline Virtual Network subnets.",
      mode: "All",
      metadata: { category: "Naming", version },
      parameters: {
        effect: {
          type: "String",
          allowedValues: ["Audit", "Deny", "Disabled"],
          defaultValue: "Audit"
        }
      },
      policyRule: {
        if: {
          anyOf: [
            {
              allOf: [
                { field: "type", equals: "Microsoft.Network/virtualNetworks/subnets" },
                { field: "name", notIn: subnetAllowed }
              ]
            },
            {
              allOf: [
                { field: "type", equals: "Microsoft.Network/virtualNetworks" },
                {
                  count: {
                    field: "Microsoft.Network/virtualNetworks/subnets[*]",
                    where: {
                      field: "Microsoft.Network/virtualNetworks/subnets[*].name",
                      notIn: subnetAllowed
                    }
                  },
                  greater: 0
                }
              ]
            }
          ]
        },
        then: { effect: "[[parameters('effect')]" }
      }
    }
  });

  namingInitiativeRefs.push({
    policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${subnetDefName}')]`,
    policyDefinitionReferenceId: "naming-subnet",
    parameters: { effect: { value: "[[parameters('subnetEffect')]" } }
  });

  // Tag Definitions
  // Subscription
  subTags.forEach((tag) => {
    const defName = `${prefix}-tag-sub-${tag.key.toLowerCase()}`;
    const allowed = [...tag.allowedValues];
    if (!tag.required && !allowed.includes("NA") && !allowed.includes("N/A")) {
      allowed.push("NA", "N/A");
    }

    const tagCondition = tag.required
      ? { anyOf: [{ field: `tags['${tag.key}']`, exists: "false" }, { field: `tags['${tag.key}']`, notIn: allowed }] }
      : { allOf: [{ field: `tags['${tag.key}']`, exists: "true" }, { field: `tags['${tag.key}']`, notIn: allowed }] };

    resources.push({
      type: "Microsoft.Authorization/policyDefinitions",
      apiVersion: "2023-04-01",
      name: defName,
      properties: {
        displayName: `${customer.name} Tag (Subscription) - ${tag.displayName || tag.key}`,
        description: `Enforces tag ${tag.key} on Subscription level.`,
        mode: "All",
        metadata: { category: "Tags", version },
        parameters: {
          effect: { type: "String", allowedValues: ["Audit", "Deny", "Disabled"], defaultValue: "Audit" }
        },
        policyRule: {
          if: {
            allOf: [
              { field: "type", equals: "Microsoft.Resources/subscriptions" },
              tagCondition
            ]
          },
          then: { effect: "[[parameters('effect')]" }
        }
      }
    });

    tagInitiativeRefs.push({
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${defName}')]`,
      policyDefinitionReferenceId: `tag-sub-${tag.key.toLowerCase()}`,
      parameters: { effect: { value: "[[parameters('tagEffect')]" } }
    });
  });

  // Resource Group
  rgTags.forEach((tag) => {
    const defName = `${prefix}-tag-rg-${tag.key.toLowerCase()}`;
    const allowed = [...tag.allowedValues];
    if (!tag.required && !allowed.includes("NA") && !allowed.includes("N/A")) {
      allowed.push("NA", "N/A");
    }

    const tagCondition = tag.required
      ? { anyOf: [{ field: `tags['${tag.key}']`, exists: "false" }, { field: `tags['${tag.key}']`, notIn: allowed }] }
      : { allOf: [{ field: `tags['${tag.key}']`, exists: "true" }, { field: `tags['${tag.key}']`, notIn: allowed }] };

    resources.push({
      type: "Microsoft.Authorization/policyDefinitions",
      apiVersion: "2023-04-01",
      name: defName,
      properties: {
        displayName: `${customer.name} Tag (Resource Group) - ${tag.displayName || tag.key}`,
        description: `Enforces tag ${tag.key} on Resource Groups.`,
        mode: "All",
        metadata: { category: "Tags", version },
        parameters: {
          effect: { type: "String", allowedValues: ["Audit", "Deny", "Disabled"], defaultValue: "Audit" }
        },
        policyRule: {
          if: {
            allOf: [
              { field: "type", equals: "Microsoft.Resources/subscriptions/resourceGroups" },
              tagCondition
            ]
          },
          then: { effect: "[[parameters('effect')]" }
        }
      }
    });

    tagInitiativeRefs.push({
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${defName}')]`,
      policyDefinitionReferenceId: `tag-rg-${tag.key.toLowerCase()}`,
      parameters: { effect: { value: "[[parameters('tagEffect')]" } }
    });
  });

  // Resource
  resTags.forEach((tag) => {
    const defName = `${prefix}-tag-res-${tag.key.toLowerCase()}`;
    const allowed = [...tag.allowedValues];
    if (!tag.required && !allowed.includes("NA") && !allowed.includes("N/A")) {
      allowed.push("NA", "N/A");
    }

    const tagCondition = tag.required
      ? { anyOf: [{ field: `tags['${tag.key}']`, exists: "false" }, { field: `tags['${tag.key}']`, notIn: allowed }] }
      : { allOf: [{ field: `tags['${tag.key}']`, exists: "true" }, { field: `tags['${tag.key}']`, notIn: allowed }] };

    resources.push({
      type: "Microsoft.Authorization/policyDefinitions",
      apiVersion: "2023-04-01",
      name: defName,
      properties: {
        displayName: `${customer.name} Tag (Resource) - ${tag.displayName || tag.key}`,
        description: `Enforces tag ${tag.key} on taggable resources.`,
        mode: "Indexed",
        metadata: { category: "Tags", version },
        parameters: {
          effect: { type: "String", allowedValues: ["Audit", "Deny", "Disabled"], defaultValue: "Audit" }
        },
        policyRule: {
          if: tagCondition,
          then: { effect: "[[parameters('effect')]" }
        }
      }
    });

    tagInitiativeRefs.push({
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${defName}')]`,
      policyDefinitionReferenceId: `tag-res-${tag.key.toLowerCase()}`,
      parameters: { effect: { value: "[[parameters('tagEffect')]" } }
    });
  });

  // 2d. Tag Inheritance and Defaulting (mode: All for RG, mode: Indexed for Resource, effect: modify)
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

  const inheritanceInitiativeRefs = [];

  // 2d-1. Inherit from Subscription to RG
  subToRgKeys.forEach((key) => {
    const defName = `${prefix}-inherit-sub-rg-${key.toLowerCase()}`;
    resources.push({
      type: "Microsoft.Authorization/policyDefinitions",
      apiVersion: "2023-04-01",
      name: defName,
      properties: {
        displayName: `${customer.name} Inherit Tag (Sub to RG) - ${key}`,
        description: `Inherits tag ${key} from subscription to Resource Group if missing.`,
        mode: "All",
        metadata: { category: "Tags", version },
        parameters: {
          effect: { type: "String", allowedValues: ["modify", "audit", "disabled"], defaultValue: "modify" }
        },
        policyRule: {
          if: {
            allOf: [
              { field: "type", equals: "Microsoft.Resources/subscriptions/resourceGroups" },
              { field: `tags['${key}']`, exists: "false" },
              { value: `[subscription().tags['${key}']]`, notEquals: "" }
            ]
          },
          then: {
            effect: "[[parameters('effect')]",
            details: {
              roleDefinitionIds: ["/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c"],
              operations: [
                { operation: "add", field: `tags['${key}']`, value: `[subscription().tags['${key}']]` }
              ]
            }
          }
        }
      }
    });

    inheritanceInitiativeRefs.push({
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${defName}')]`,
      policyDefinitionReferenceId: `inherit-sub-rg-${key.toLowerCase()}`,
      parameters: { effect: { value: "[[parameters('tagInheritanceEffect')]" } }
    });
  });

  // 2d-2. Inherit from RG to Resources
  rgToResKeys.forEach((key) => {
    const defName = `${prefix}-inherit-rg-res-${key.toLowerCase()}`;
    resources.push({
      type: "Microsoft.Authorization/policyDefinitions",
      apiVersion: "2023-04-01",
      name: defName,
      properties: {
        displayName: `${customer.name} Inherit Tag (RG to Resource) - ${key}`,
        description: `Inherits tag ${key} from parent Resource Group to resource if missing.`,
        mode: "Indexed",
        metadata: { category: "Tags", version },
        parameters: {
          effect: { type: "String", allowedValues: ["modify", "audit", "disabled"], defaultValue: "modify" }
        },
        policyRule: {
          if: {
            allOf: [
              { field: `tags['${key}']`, exists: "false" },
              { value: `[resourceGroup().tags['${key}']]`, notEquals: "" }
            ]
          },
          then: {
            effect: "[[parameters('effect')]",
            details: {
              roleDefinitionIds: ["/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c"],
              operations: [
                { operation: "add", field: `tags['${key}']`, value: `[resourceGroup().tags['${key}']]` }
              ]
            }
          }
        }
      }
    });

    inheritanceInitiativeRefs.push({
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${defName}')]`,
      policyDefinitionReferenceId: `inherit-rg-res-${key.toLowerCase()}`,
      parameters: { effect: { value: "[[parameters('tagInheritanceEffect')]" } }
    });
  });

  // 2d-3. Default empty/missing resource tags to NA
  defaultNAKeys.forEach((key) => {
    const defName = `${prefix}-default-res-na-${key.toLowerCase()}`;
    resources.push({
      type: "Microsoft.Authorization/policyDefinitions",
      apiVersion: "2023-04-01",
      name: defName,
      properties: {
        displayName: `${customer.name} Default Tag to NA on Resource - ${key}`,
        description: `Defaults empty or missing tag ${key} on resource to NA.`,
        mode: "Indexed",
        metadata: { category: "Tags", version },
        parameters: {
          effect: { type: "String", allowedValues: ["modify", "audit", "disabled"], defaultValue: "modify" }
        },
        policyRule: {
          if: {
            anyOf: [
              { field: `tags['${key}']`, exists: "false" },
              { field: `tags['${key}']`, equals: "" }
            ]
          },
          then: {
            effect: "[[parameters('effect')]",
            details: {
              roleDefinitionIds: ["/providers/microsoft.authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c"],
              operations: [
                { operation: "addOrReplace", field: `tags['${key}']`, value: "NA" }
              ]
            }
          }
        }
      }
    });

    inheritanceInitiativeRefs.push({
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policyDefinitions', '${defName}')]`,
      policyDefinitionReferenceId: `default-res-na-${key.toLowerCase()}`,
      parameters: { effect: { value: "[[parameters('tagInheritanceEffect')]" } }
    });
  });

  // Geo-restriction built-ins into namingInitiativeRefs
  if (geoRestrictions.enabled !== false) {
    namingInitiativeRefs.push({
      policyDefinitionId: "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4c",
      policyDefinitionReferenceId: "allowed-locations-resources",
      parameters: {
        listOfAllowedLocations: { value: allowedLocations },
        effect: { value: "[[parameters('geoEffect')]" }
      }
    });
    namingInitiativeRefs.push({
      policyDefinitionId: "/providers/Microsoft.Authorization/policyDefinitions/e765b5de-1225-4ba3-bd56-1ac6695af988",
      policyDefinitionReferenceId: "allowed-locations-resource-groups",
      parameters: {
        listOfAllowedLocations: { value: allowedLocations },
        effect: { value: "[[parameters('geoEffect')]" }
      }
    });
  }

  // Initiatives
  const namingInitiativeName = `${prefix}-naming-initiative`;
  const tagInitiativeName = `${prefix}-tag-governance-initiative`;
  const tagInheritanceInitiativeName = `${prefix}-tag-inheritance-initiative`;

  resources.push({
    type: "Microsoft.Authorization/policySetDefinitions",
    apiVersion: "2023-04-01",
    name: namingInitiativeName,
    dependsOn: namingInitiativeRefs.filter(r => r.policyDefinitionId.includes('subscriptionResourceId')).map((r) => r.policyDefinitionId),
    properties: {
      displayName: `${customer.name} Naming & Geo-Boundary Initiative`,
      description: `Enforces type-specific naming rules and regional geo-restrictions across ${customer.name} Azure resources.`,
      metadata: { category: "Naming", version },
      parameters: {
        namingEffect: { type: "String", allowedValues: ["Audit", "Deny", "Disabled"], defaultValue: "Audit" },
        subnetEffect: { type: "String", allowedValues: ["Audit", "Deny", "Disabled"], defaultValue: "Audit" },
        geoEffect: { type: "String", allowedValues: ["Audit", "Deny", "Disabled"], defaultValue: "Audit" }
      },
      policyDefinitions: namingInitiativeRefs
    }
  });

  resources.push({
    type: "Microsoft.Authorization/policySetDefinitions",
    apiVersion: "2023-04-01",
    name: tagInitiativeName,
    dependsOn: tagInitiativeRefs.map((r) => r.policyDefinitionId),
    properties: {
      displayName: `${customer.name} Tag Governance Initiative`,
      description: "Enforces mandatory and allowed tags across Subscriptions, Resource Groups, and Resources.",
      metadata: { category: "Tags", version },
      parameters: {
        tagEffect: { type: "String", allowedValues: ["Audit", "Deny", "Disabled"], defaultValue: "Audit" }
      },
      policyDefinitions: tagInitiativeRefs
    }
  });

  resources.push({
    type: "Microsoft.Authorization/policySetDefinitions",
    apiVersion: "2023-04-01",
    name: tagInheritanceInitiativeName,
    dependsOn: inheritanceInitiativeRefs.map((r) => r.policyDefinitionId),
    properties: {
      displayName: `${customer.name} Tag Inheritance & Remediation Initiative`,
      description: "Automates one-way tag inheritance from Subscription to RG, RG to Resources, and defaults empty resource tags to NA.",
      metadata: { category: "Tags", version },
      parameters: {
        tagInheritanceEffect: { type: "String", allowedValues: ["modify", "audit", "disabled"], defaultValue: "modify" }
      },
      policyDefinitions: inheritanceInitiativeRefs
    }
  });

  // Assignments
  const namingAssignmentName = `${prefix}-naming-assignment`;
  const tagAssignmentName = `${prefix}-tag-governance-assignment`;
  const tagInheritanceAssignmentName = `${prefix}-tag-inheritance-assignment`;

  resources.push({
    type: "Microsoft.Authorization/policyAssignments",
    apiVersion: "2023-04-01",
    name: namingAssignmentName,
    dependsOn: [
      `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${namingInitiativeName}')]`
    ],
    properties: {
      displayName: `${customer.name} Naming & Geo-Boundary Assignment`,
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${namingInitiativeName}')]`,
      enforcementMode: "[parameters('enforcementMode')]",
      notScopes: "[parameters('notScopes')]",
      parameters: {
        namingEffect: { value: "[parameters('namingEffect')]" },
        subnetEffect: { value: "[parameters('subnetEffect')]" },
        geoEffect: { value: "[parameters('geoEffect')]" }
      },
      nonComplianceMessages: [
        { message: `Resource names must match the approved ${customer.name} naming convention.` },
        { message: "Subnet names must be in the approved allowlist.", policyDefinitionReferenceId: "naming-subnet" },
        { message: `Resources must be deployed within approved regions (${allowedLocations.join(", ")}).`, policyDefinitionReferenceId: "allowed-locations-resources" },
        { message: `Resource groups must be created within approved regions (${allowedLocations.join(", ")}).`, policyDefinitionReferenceId: "allowed-locations-resource-groups" }
      ]
    }
  });

  resources.push({
    type: "Microsoft.Authorization/policyAssignments",
    apiVersion: "2023-04-01",
    name: tagAssignmentName,
    dependsOn: [
      `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${tagInitiativeName}')]`
    ],
    properties: {
      displayName: `${customer.name} Tag Governance Assignment`,
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${tagInitiativeName}')]`,
      enforcementMode: "[parameters('enforcementMode')]",
      notScopes: "[parameters('notScopes')]",
      parameters: {
        tagEffect: { value: "[parameters('tagEffect')]" }
      },
      nonComplianceMessages: [
        { message: "Entity must contain mandatory governance tags with approved values." }
      ]
    }
  });

  resources.push({
    type: "Microsoft.Authorization/policyAssignments",
    apiVersion: "2023-04-01",
    name: tagInheritanceAssignmentName,
    location: "[parameters('location')]",
    identity: {
      type: "SystemAssigned"
    },
    dependsOn: [
      `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${tagInheritanceInitiativeName}')]`
    ],
    properties: {
      displayName: `${customer.name} Tag Inheritance & Remediation Assignment`,
      policyDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${tagInheritanceInitiativeName}')]`,
      enforcementMode: "[parameters('enforcementMode')]",
      notScopes: "[parameters('notScopes')]",
      parameters: {
        tagInheritanceEffect: { value: "[parameters('tagInheritanceEffect')]" }
      },
      nonComplianceMessages: [
        { message: "Entity must inherit common tags or default empty tags to NA." }
      ]
    }
  });

  resources.push({
    type: "Microsoft.Authorization/roleAssignments",
    apiVersion: "2022-04-01",
    name: `[guid(subscription().id, subscriptionResourceId('Microsoft.Authorization/policyAssignments', '${tagInheritanceAssignmentName}'), 'b24988ac-6180-42a0-ab88-20f7382dd24c')]`,
    dependsOn: [
      `[subscriptionResourceId('Microsoft.Authorization/policyAssignments', '${tagInheritanceAssignmentName}')]`
    ],
    properties: {
      roleDefinitionId: "[subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')]",
      principalId: `[reference(subscriptionResourceId('Microsoft.Authorization/policyAssignments', '${tagInheritanceAssignmentName}'), '2023-04-01', 'Full').identity.principalId]`,
      principalType: "ServicePrincipal"
    }
  });

  const template = {
    $schema: "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
    contentVersion: `${version}.0`,
    parameters: {
      namingEffect: { type: "string", defaultValue: customer.namingEffect || "Audit", allowedValues: ["Audit", "Deny", "Disabled"] },
      subnetEffect: { type: "string", defaultValue: customer.subnetEffect || "Audit", allowedValues: ["Audit", "Deny", "Disabled"] },
      tagEffect: { type: "string", defaultValue: customer.tagEffect || "Audit", allowedValues: ["Audit", "Deny", "Disabled"] },
      geoEffect: { type: "string", defaultValue: customer.geoRestrictions?.effect || "Audit", allowedValues: ["Audit", "Deny", "Disabled"] },
      tagInheritanceEffect: { type: "string", defaultValue: customer.tagInheritance?.effect || "modify", allowedValues: ["modify", "audit", "disabled"] },
      location: { type: "string", defaultValue: customer.defaultRegion || "canadacentral" },
      enforcementMode: { type: "string", defaultValue: customer.enforcementMode || "Default", allowedValues: ["Default", "DoNotEnforce"] },
      notScopes: { type: "array", defaultValue: customer.notScopes || [] }
    },
    resources,
    outputs: {
      namingAssignmentId: {
        type: "string",
        value: `[subscriptionResourceId('Microsoft.Authorization/policyAssignments', '${namingAssignmentName}')]`
      },
      tagAssignmentId: {
        type: "string",
        value: `[subscriptionResourceId('Microsoft.Authorization/policyAssignments', '${tagAssignmentName}')]`
      },
      tagInheritanceAssignmentId: {
        type: "string",
        value: `[subscriptionResourceId('Microsoft.Authorization/policyAssignments', '${tagInheritanceAssignmentName}')]`
      },
      namingInitiativeId: {
        type: "string",
        value: `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${namingInitiativeName}')]`
      },
      tagInitiativeId: {
        type: "string",
        value: `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${tagInitiativeName}')]`
      },
      tagInheritanceInitiativeId: {
        type: "string",
        value: `[subscriptionResourceId('Microsoft.Authorization/policySetDefinitions', '${tagInheritanceInitiativeName}')]`
      }
    }
  };

  const parameters = {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    contentVersion: `${version}.0`,
    parameters: {
      namingEffect: { value: customer.namingEffect || "Audit" },
      subnetEffect: { value: customer.subnetEffect || "Audit" },
      tagEffect: { value: customer.tagEffect || "Audit" },
      geoEffect: { value: customer.geoRestrictions?.effect || "Audit" },
      tagInheritanceEffect: { value: customer.tagInheritance?.effect || "modify" },
      location: { value: customer.defaultRegion || "canadacentral" },
      enforcementMode: { value: customer.enforcementMode || "Default" },
      notScopes: { value: customer.notScopes || [] }
    }
  };

  return { template, parameters };
}
