// Microsoft Cloud Adoption Framework (CAF) Recommended Baseline Tags Catalogue

export const BASELINE_TAGS = [
  {
    key: "Environment",
    displayName: "Environment",
    description: "Deployment tier of the workload or resource.",
    recommendedTier: "resource",
    defaultAllowed: ["Prod", "NonProd", "Dev", "Stage", "Test", "Shared"],
    category: "Functional"
  },
  {
    key: "CostCenter",
    displayName: "Cost Center",
    description: "Accounting entity that tracks expenses associated with the resource.",
    recommendedTier: "subscription",
    defaultAllowed: ["1000", "2000", "3000", "IT-Platform", "CloudOps", "Finance"],
    category: "Financial"
  },
  {
    key: "Owner",
    displayName: "Owner",
    description: "Primary point of contact or email of the team accountable for the resource.",
    recommendedTier: "resourceGroup",
    defaultAllowed: ["cloudops@company.com", "platform-team@company.com", "security@company.com"],
    category: "Ownership"
  },
  {
    key: "Application",
    displayName: "Application Name",
    description: "Name of the business application or service component.",
    recommendedTier: "resource",
    defaultAllowed: ["ActiveDirectory", "Firewall", "Bastion", "CoreERP", "CustomerPortal"],
    category: "Functional"
  },
  {
    key: "DataClassification",
    displayName: "Data Classification",
    description: "Sensitivity rating of data stored or processed by this resource.",
    recommendedTier: "resource",
    defaultAllowed: ["Public", "Internal", "Confidential", "Restricted", "NA"],
    category: "Security"
  },
  {
    key: "Criticality",
    displayName: "Criticality Tier",
    description: "Importance of the resource to business continuity and SLA commitments.",
    recommendedTier: "resource",
    defaultAllowed: ["Mission-Critical", "Business-Critical", "Standard", "Low", "NA"],
    category: "Operational"
  },
  {
    key: "DisasterRecovery",
    displayName: "Disaster Recovery",
    description: "Disaster recovery resilience tier or strategy.",
    recommendedTier: "resource",
    defaultAllowed: ["ActiveActive", "WarmStandby", "PilotLight", "BackupOnly", "None", "NA"],
    category: "Operational"
  },
  {
    key: "Workload",
    displayName: "Workload / Project",
    description: "Project or landing zone workload name.",
    recommendedTier: "resourceGroup",
    defaultAllowed: ["Connectivity", "Identity", "Management", "CoreInfra", "SharedServices"],
    category: "Functional"
  },
  {
    key: "BusinessUnit",
    displayName: "Business Unit",
    description: "Division or high-level organizational group.",
    recommendedTier: "subscription",
    defaultAllowed: ["EnterpriseIT", "Retail", "Commercial", "Corporate", "Healthcare", "NA"],
    category: "Financial"
  }
];
