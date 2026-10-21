// Default Customer Workspaces for Azure Landing Zone Policy Studio

export const DEFAULT_CUSTOMERS = [
  {
    id: "contoso",
    name: "Contoso Enterprise",
    abbreviation: "con",
    environmentParadigm: "greenfield",
    scaffoldingPreset: "4-sub-core",
    policyModules: { naming: true, tags: true, geoRestrictions: true },
    subscriptionName: "Connectivity",
    subscriptionCode: "CON",
    environment: "prod",
    version: "2.1.0",
    description: "Standard enterprise landing zone for Contoso core workloads and platform governance.",
    regions: {
      canadacentral: "cc",
      canadaeast: "ce"
    },
    defaultRegion: "canadacentral",
    purposes: ["hub", "core", "monitoring", "infrafw", "apps"],
    purpose: "core",
    namingEffect: "Audit",
    subnetEffect: "Audit",
    tagEffect: "Audit",
    enforcementMode: "Default",
    notScopes: [],
    namingRules: {
      defaultBehavior: "enforce", // "enforce", "caf-standard", "unrestricted"
      globalPattern: "{Org}-{SUB}-{ResourceGroup}-{abbreviation}",
      unrestrictedTypes: [],
      customPatterns: {
        vm_windows: "vm-{org}{sub}{purpose}{instance}",
        vm_linux: "{Org}-{SUB}-{ResourceGroup}-vm",
        vm: "vm-{org}{sub}{purpose}{instance}",
        rg: "{Org}-{SUB}-{ResourceGroup}-rg",
        vnet: "{Org}-{SUB}-{ResourceGroup}-vnet",
        nsg: "{Org}-{SUB}-{ResourceGroup}-nsg",
        nic: "{Org}-{SUB}-{ResourceGroup}-nic",
        storage: "{org}{sub}{region}sa",
        kv: "{org}-{sub}-{region}-kv"
      },
      subnetNaming: {
        effect: "Audit",
        allowedNames: [
          "snet-apps",
          "snet-core",
          "snet-management",
          "GatewaySubnet",
          "AzureBastionSubnet",
          "AzureFirewallSubnet",
          "AzureFirewallManagementSubnet"
        ]
      }
    },
    tags: {
      subscription: [
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["1000", "2000", "3000", "IT-Platform", "CloudOps", "Finance"],
          description: "Financial cost center identifier for subscription showback."
        },
        {
          key: "Owner",
          displayName: "Owner",
          required: true,
          caseSensitive: false,
          allowedValues: ["cloudops@contoso.com", "platform-team@contoso.com", "security@contoso.com"],
          description: "Operational owner contact or team email."
        },
        {
          key: "BusinessUnit",
          displayName: "Business Unit",
          required: false,
          caseSensitive: false,
          allowedValues: ["EnterpriseIT", "Retail", "Commercial", "Corporate", "NA"],
          description: "High level business division."
        }
      ],
      resourceGroup: [
        {
          key: "Environment",
          displayName: "Environment",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "NonProd", "Dev", "Stage", "Test", "Shared"],
          description: "Target deployment tier."
        },
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["1000", "2000", "3000", "IT-Platform", "CloudOps", "Finance"],
          description: "Financial cost center identifier."
        },
        {
          key: "Workload",
          displayName: "Workload / Project",
          required: true,
          caseSensitive: false,
          allowedValues: ["Connectivity", "Identity", "Management", "CoreInfra", "SharedApps"],
          description: "Name of the workload or solution."
        },
        {
          key: "Owner",
          displayName: "Owner",
          required: true,
          caseSensitive: false,
          allowedValues: ["cloudops@contoso.com", "platform-team@contoso.com", "security@contoso.com"],
          description: "Operational team accountable for this RG."
        }
      ],
      resource: [
        {
          key: "Environment",
          displayName: "Environment",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "NonProd", "Dev", "Stage", "Test", "Shared"],
          description: "Resource lifecycle environment."
        },
        {
          key: "Application",
          displayName: "Application Name",
          required: true,
          caseSensitive: false,
          allowedValues: ["ActiveDirectory", "Firewall", "Bastion", "Monitoring", "PaymentGateway", "Portal"],
          description: "Application or service component."
        },
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["1000", "2000", "3000", "IT-Platform", "CloudOps", "Finance"],
          description: "Cost tracking code."
        },
        {
          key: "DataClassification",
          displayName: "Data Classification",
          required: false,
          caseSensitive: false,
          allowedValues: ["Public", "Internal", "Confidential", "Restricted", "NA"],
          description: "Information security classification level."
        },
        {
          key: "Criticality",
          displayName: "Criticality Tier",
          required: false,
          caseSensitive: false,
          allowedValues: ["Mission-Critical", "Business-Critical", "Standard", "Low", "NA"],
          description: "Business continuity and SLA priority."
        },
        {
          key: "DisasterRecovery",
          displayName: "DR Tier",
          required: false,
          caseSensitive: false,
          allowedValues: ["PilotLight", "WarmStandby", "MultiRegion", "None", "NA"],
          description: "Disaster recovery resilience tier."
        }
      ]
    },
    geoRestrictions: {
      enabled: true,
      allowedLocations: ["canadacentral", "canadaeast"],
      effect: "Audit"
    },
    tagInheritance: {
      enabled: true,
      effect: "modify",
      subToRg: ["CostCenter", "Owner"],
      rgToResource: ["Environment", "CostCenter", "Workload", "Owner"],
      defaultResourceNA: ["DataClassification", "Criticality", "DisasterRecovery"]
    }
  },
  {
    id: "contoso-health",
    name: "Contoso Health",
    abbreviation: "conhealth",
    environmentParadigm: "greenfield",
    scaffoldingPreset: "4-sub-core",
    policyModules: { naming: true, tags: true, geoRestrictions: true },
    subscriptionName: "Production-Core",
    subscriptionCode: "PRDA",
    environment: "prod",
    version: "1.0.0",
    description: "Healthcare customer landing zone profile with strict HIPAA tagging and East US / Central US.",
    regions: {
      eastus: "eus",
      centralus: "cus"
    },
    defaultRegion: "eastus",
    purposes: ["hub", "core", "monitoring", "clinical", "apps"],
    purpose: "core",
    namingEffect: "Audit",
    subnetEffect: "Audit",
    tagEffect: "Audit",
    enforcementMode: "Default",
    notScopes: [],
    namingRules: {
      defaultBehavior: "enforce",
      globalPattern: "{Org}-{SUB}-{ResourceGroup}-{abbreviation}",
      unrestrictedTypes: ["nw"], // Network Watcher unrestricted
      customPatterns: {
        vm_windows: "vm-{org}{sub}{purpose}{instance}",
        vm_linux: "{Org}-{SUB}-{ResourceGroup}-vm",
        vm: "vm-{org}{sub}{purpose}{instance}",
        rg: "{Org}-{SUB}-{ResourceGroup}-rg",
        vnet: "{Org}-{SUB}-{ResourceGroup}-vnet",
        storage: "{org}{sub}{region}sa",
        kv: "{org}-{sub}-{region}-kv"
      },
      subnetNaming: {
        effect: "Audit",
        allowedNames: [
          "snet-ehr",
          "snet-database",
          "snet-dmz",
          "GatewaySubnet",
          "AzureBastionSubnet",
          "AzureFirewallSubnet"
        ]
      }
    },
    tags: {
      subscription: [
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["HEALTH-101", "HEALTH-102", "PLATFORM"],
          description: "Health IT cost code"
        },
        {
          key: "Owner",
          displayName: "Owner",
          required: true,
          caseSensitive: false,
          allowedValues: ["lead-architect@contoso.com", "hipaa-compliance@contoso.com"],
          description: "Designated subscription custodian"
        }
      ],
      resourceGroup: [
        {
          key: "Environment",
          displayName: "Environment",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "Dev", "Stage"],
          description: "Healthcare environment"
        },
        {
          key: "ComplianceScope",
          displayName: "Compliance Scope",
          required: true,
          caseSensitive: false,
          allowedValues: ["HIPAA", "HITRUST", "PCI-DSS", "Standard"],
          description: "Regulatory compliance regime"
        }
      ],
      resource: [
        {
          key: "Environment",
          displayName: "Environment",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "Dev", "Stage"],
          description: "Resource environment"
        },
        {
          key: "DataSensitivity",
          displayName: "Data Sensitivity",
          required: true,
          caseSensitive: false,
          allowedValues: ["PHI", "PII", "Internal", "Public"],
          description: "Protected health information flag"
        },
        {
          key: "BackupPolicy",
          displayName: "Backup Policy",
          required: false,
          caseSensitive: false,
          allowedValues: ["Daily-4Weeks", "Weekly-1Year", "None", "NA"],
          description: "Required Azure Backup frequency"
        }
      ]
    },
    geoRestrictions: {
      enabled: true,
      allowedLocations: ["eastus", "centralus"],
      effect: "Audit"
    },
    tagInheritance: {
      enabled: true,
      effect: "modify",
      subToRg: ["CostCenter", "Owner"],
      rgToResource: ["Environment", "CostCenter", "HIPAA_Tier"],
      defaultResourceNA: ["BackupPolicy"]
    }
  },
  {
    id: "contoso-ai",
    name: "Contoso AI Labs",
    abbreviation: "conai",
    environmentParadigm: "greenfield",
    scaffoldingPreset: "5-sub-full",
    policyModules: { naming: true, tags: true, geoRestrictions: true },
    subscriptionName: "AI-Foundry-Production",
    subscriptionCode: "AIP",
    environment: "prod",
    version: "1.0.0",
    description: "Enterprise Tabletop Exercise: Modern Generative AI & Foundation Model Landing Zone with ISO 42001 governance.",
    regions: {
      canadacentral: "cc",
      canadaeast: "ce",
      eastus2: "eus2"
    },
    defaultRegion: "canadacentral",
    purposes: ["hub", "core", "ai-inference", "model-training", "apps"],
    purpose: "core",
    namingEffect: "Audit",
    subnetEffect: "Audit",
    tagEffect: "Audit",
    enforcementMode: "Default",
    notScopes: [],
    namingRules: {
      defaultBehavior: "enforce",
      globalPattern: "{Org}-{SUB}-{ResourceGroup}-{abbreviation}",
      unrestrictedTypes: ["synw"],
      customPatterns: {
        oai: "{Org}-{SUB}-{ResourceGroup}-oai",
        srch: "{org}-{sub}-{region}-srch",
        mlw: "{Org}-{SUB}-{ResourceGroup}-mlw",
        aif: "{Org}-{SUB}-{ResourceGroup}-aif",
        dbw: "{Org}-{SUB}-{ResourceGroup}-dbw",
        vm_windows: "vm-{org}{sub}{purpose}{instance}",
        vm_linux: "{Org}-{SUB}-{ResourceGroup}-vm",
        vm: "vm-{org}{sub}{purpose}{instance}",
        rg: "{Org}-{SUB}-{ResourceGroup}-rg",
        vnet: "{Org}-{SUB}-{ResourceGroup}-vnet",
        storage: "{org}{sub}{region}sa",
        kv: "{org}-{sub}-{region}-kv"
      },
      subnetNaming: {
        effect: "Audit",
        allowedNames: [
          "snet-ai-inference",
          "snet-model-training",
          "snet-private-endpoints",
          "GatewaySubnet",
          "AzureBastionSubnet",
          "AzureFirewallSubnet"
        ]
      }
    },
    tags: {
      subscription: [
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["AI-RND-101", "AI-PROD-202", "DATA-ENG", "SHARED-INFRA"],
          description: "High-level cost allocation code for GPU & token billing."
        },
        {
          key: "Owner",
          displayName: "Platform Owner",
          required: true,
          caseSensitive: false,
          allowedValues: ["ai-leads@contoso.com", "mlops-platform@contoso.com", "security@contoso.com"],
          description: "Designated team custodian for subscription governance."
        },
        {
          key: "ComplianceFramework",
          displayName: "Compliance Framework",
          required: false,
          caseSensitive: false,
          allowedValues: ["ISO42001-AI", "SOC2-Type2", "HIPAA", "Standard", "NA"],
          description: "AI safety and compliance regulatory regime."
        }
      ],
      resourceGroup: [
        {
          key: "Environment",
          displayName: "Environment Tier",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "NonProd", "Dev", "Stage", "Sandbox"],
          description: "Workload operational lifecycle stage."
        },
        {
          key: "Workload",
          displayName: "AI Workload",
          required: true,
          caseSensitive: false,
          allowedValues: ["GenerativeAI-RAG", "ModelFineTuning", "CopilotIntegration", "AnalyticsLakehouse", "CoreInfra"],
          description: "Specific AI initiative or project name."
        },
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["AI-RND-101", "AI-PROD-202", "DATA-ENG", "SHARED-INFRA"],
          description: "Departmental cost allocation."
        }
      ],
      resource: [
        {
          key: "Environment",
          displayName: "Environment",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "NonProd", "Dev", "Stage", "Sandbox"],
          description: "Resource environment tier."
        },
        {
          key: "DataClassification",
          displayName: "Data Classification",
          required: true,
          caseSensitive: false,
          allowedValues: ["Restricted", "Confidential", "Internal", "Public"],
          description: "Data sensitivity processed by this AI/Storage component."
        },
        {
          key: "AIModelType",
          displayName: "AI Model Family",
          required: false,
          caseSensitive: false,
          allowedValues: ["LLM-GPT4", "LLM-GPT4o", "Embedding-Ada", "Vision-MultiModal", "Custom-FineTuned", "None", "NA"],
          description: "Underlying model architecture deployed or consumed."
        },
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["AI-RND-101", "AI-PROD-202", "DATA-ENG", "SHARED-INFRA"],
          description: "Resource chargeback tag."
        },
        {
          key: "BackupPolicy",
          displayName: "Backup SLA",
          required: false,
          caseSensitive: false,
          allowedValues: ["Daily-30Days", "Weekly-90Days", "MultiRegion-Replica", "None", "NA"],
          description: "Business continuity and snapshot policy."
        }
      ]
    },
    geoRestrictions: {
      enabled: true,
      allowedLocations: ["canadacentral", "canadaeast"],
      effect: "Audit"
    },
    tagInheritance: {
      enabled: true,
      effect: "modify",
      subToRg: ["CostCenter", "Owner"],
      rgToResource: ["Environment", "CostCenter", "Workload"],
      defaultResourceNA: ["BackupPolicy"]
    }
  },
  {
    id: "woodgrove",
    name: "Woodgrove Legacy Corp",
    abbreviation: "wg",
    environmentParadigm: "brownfield",
    scaffoldingPreset: "custom",
    policyModules: { naming: true, tags: true, geoRestrictions: false },
    subscriptionName: "SharedServices",
    subscriptionCode: "SHD",
    environment: "prod",
    version: "1.0.0",
    description: "Brownfield Azure tenant with pre-existing legacy workloads requiring unified tagging and audit-only naming governance.",
    regions: {
      eastus: "eus",
      canadacentral: "cc"
    },
    defaultRegion: "eastus",
    purposes: ["corp", "app", "db", "legacy"],
    purpose: "corp",
    namingEffect: "Audit",
    subnetEffect: "Audit",
    tagEffect: "Audit",
    enforcementMode: "Default",
    notScopes: [],
    namingRules: {
      defaultBehavior: "enforce",
      globalPattern: "{Org}-{ResourceGroup}-{abbreviation}",
      unrestrictedTypes: [],
      customPatterns: {
        rg: "rg-{org}-{env}-{purpose}",
        vnet: "{org}-{env}-vnet-{instance}",
        vm: "{org}{env}{purpose}vm{instance}",
        storage: "{org}{env}sa{instance}",
        kv: "kv-{org}-{env}-{purpose}"
      },
      subnetNaming: {
        effect: "Audit",
        allowedNames: ["snet-corp", "snet-web", "snet-data", "GatewaySubnet"]
      }
    },
    tags: {
      subscription: [
        {
          key: "CostCenter",
          displayName: "Cost Center",
          required: true,
          caseSensitive: false,
          allowedValues: ["CC-CORP-100", "CC-RETAIL-200", "CC-IT-900"],
          description: "Legacy corporate cost center."
        },
        {
          key: "Owner",
          displayName: "Application Custodian",
          required: true,
          caseSensitive: false,
          allowedValues: ["it-ops@woodgrove.com", "arch@woodgrove.com"],
          description: "Primary point of contact."
        }
      ],
      resourceGroup: [
        {
          key: "Environment",
          displayName: "Environment Tier",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "NonProd", "Legacy"],
          description: "Operational lifecycle tier."
        },
        {
          key: "Application",
          displayName: "Application Name",
          required: true,
          caseSensitive: false,
          allowedValues: ["CoreBanking", "RetailPortal", "Payments", "DataHub"],
          description: "Workload application name."
        }
      ],
      resource: [
        {
          key: "Environment",
          displayName: "Environment Tier",
          required: true,
          caseSensitive: false,
          allowedValues: ["Prod", "NonProd", "Legacy"],
          description: "Operational lifecycle tier."
        },
        {
          key: "DataClassification",
          displayName: "Data Classification",
          required: true,
          caseSensitive: false,
          allowedValues: ["Confidential", "Restricted", "Internal", "Public"],
          description: "Sensitivity tier."
        }
      ]
    },
    geoRestrictions: {
      enabled: false,
      allowedLocations: ["eastus", "canadacentral"],
      effect: "Audit"
    },
    tagInheritance: {
      enabled: true,
      effect: "modify",
      subToRg: ["CostCenter", "Owner"],
      rgToResource: ["Environment", "Application", "CostCenter"],
      defaultResourceNA: ["DataClassification"]
    },
    brownfieldMetadata: {
      importedAt: "2026-10-21T10:00:00Z",
      totalDiscoveredResources: 24,
      discoveredSubscriptionsCount: 3,
      inferredPatternsCount: 5,
      discoveredTagsCount: 6,
      discoveredTags: [
        { key: "CostCenter", sampleValues: ["CC-PROD-100", "CC-IT-900"], foundInScopes: ["subscription", "resourceGroup"], count: 5 },
        { key: "Owner", sampleValues: ["cloudops@woodgrove.com", "infra@woodgrove.com"], foundInScopes: ["subscription"], count: 3 },
        { key: "Environment", sampleValues: ["Prod", "NonProd"], foundInScopes: ["resourceGroup"], count: 4 },
        { key: "Application", sampleValues: ["CoreBanking", "DataLake"], foundInScopes: ["resourceGroup", "resource"], count: 4 },
        { key: "billing_id", sampleValues: ["MKT-88", "FIN-102"], foundInScopes: ["resourceGroup"], count: 2 },
        { key: "temporary", sampleValues: ["true", "false"], foundInScopes: ["resource"], count: 2 }
      ]
    }
  }
];
