// Curated Naming Convention Baselines & Reusable Templates
// Designed for Enterprise Azure Landing Zones & Multi-Customer Deployment

export const BUILTIN_NAMING_TEMPLATES = [
  {
    id: "airgate-core",
    name: "AirGate Enterprise ALZ Core",
    category: "Foundation",
    badge: "18 Resources",
    description: "Essential foundational landing zone infrastructure covering networking, security, storage, compute, and management with official AirGate standards.",
    resourceKeys: [
      "rg", "vnet", "snet", "nsg", "nic", "pip", "rt", "afw", "bas",
      "kv", "storage", "vm", "log", "aa", "id", "ag", "pep", "ng"
    ],
    patterns: {
      rg: "{Org}-{SUB}-{ResourceGroup}-rg",
      vnet: "{Org}-{SUB}-{ResourceGroup}-vnet",
      snet: "snet-{purpose}",
      nsg: "{Org}-{SUB}-{ResourceGroup}-nsg",
      nic: "{Org}-{SUB}-{ResourceGroup}-nic",
      pip: "{Org}-{SUB}-{ResourceGroup}-pip",
      rt: "{Org}-{SUB}-{ResourceGroup}-rt",
      afw: "{Org}-{SUB}-{ResourceGroup}-afw",
      bas: "{Org}-{SUB}-{ResourceGroup}-bas",
      kv: "{org}-{sub}-{region}-kv",
      storage: "{org}{sub}{region}sa",
      vm: "{Org}-{SUB}-{ResourceGroup}-vm",
      log: "{Org}-{SUB}-{ResourceGroup}-law",
      aa: "{Org}-{SUB}-{ResourceGroup}-aa",
      id: "{Org}-{SUB}-{ResourceGroup}-id",
      ag: "{Org}-{SUB}-{ResourceGroup}-ag",
      pep: "{Org}-{SUB}-{ResourceGroup}-pep",
      ng: "{Org}-{SUB}-{ResourceGroup}-ng"
    },
    subnetAllowed: [
      "snet-apps",
      "snet-core",
      "snet-management",
      "GatewaySubnet",
      "AzureBastionSubnet",
      "AzureFirewallSubnet",
      "AzureFirewallManagementSubnet"
    ]
  },
  {
    id: "ai-analytics",
    name: "AI & Modern Analytics Suite",
    category: "AI & Data",
    badge: "12 Resources",
    description: "Curated suite for Generative AI, RAG architectures, model fine-tuning, Azure OpenAI, Vector Search, and Data Lakes.",
    resourceKeys: [
      "oai", "srch", "mlw", "aif", "dbw", "synw", "storage", "kv", "vnet", "pep", "rg", "vm"
    ],
    patterns: {
      oai: "{Org}-{SUB}-{ResourceGroup}-oai",
      srch: "{org}-{sub}-{region}-srch",
      mlw: "{Org}-{SUB}-{ResourceGroup}-mlw",
      aif: "{Org}-{SUB}-{ResourceGroup}-aif",
      dbw: "{Org}-{SUB}-{ResourceGroup}-dbw",
      synw: "{org}{sub}{region}synw",
      storage: "{org}{sub}{region}sa",
      kv: "{org}-{sub}-{region}-kv",
      vnet: "{Org}-{SUB}-{ResourceGroup}-vnet",
      pep: "{Org}-{SUB}-{ResourceGroup}-pep",
      rg: "{Org}-{SUB}-{ResourceGroup}-rg",
      vm: "{Org}-{SUB}-{ResourceGroup}-vm"
    },
    subnetAllowed: [
      "snet-ai-inference",
      "snet-ai-training",
      "snet-ai-private-link",
      "snet-data-engineering",
      "GatewaySubnet"
    ]
  },
  {
    id: "cloud-native",
    name: "Cloud-Native & Microservices",
    category: "Application Platform",
    badge: "13 Resources",
    description: "Standard conventions for AKS clusters, container registries, web applications, serverless functions, APIs, and distributed cloud databases.",
    resourceKeys: [
      "aks", "cr", "app", "asp", "cosmos", "pgsql", "redis", "evh", "sb", "kv", "vnet", "rg", "pip"
    ],
    patterns: {
      aks: "{Org}-{SUB}-{ResourceGroup}-aks",
      cr: "{org}{sub}{region}cr",
      app: "{Org}-{SUB}-{ResourceGroup}-app",
      asp: "{Org}-{SUB}-{ResourceGroup}-asp",
      cosmos: "{org}-{sub}-{region}-cosmos",
      pgsql: "{org}-{sub}-{region}-pgsql",
      redis: "{org}-{sub}-{region}-redis",
      evh: "{org}-{sub}-{region}-evh",
      sb: "{org}-{sub}-{region}-sb",
      kv: "{org}-{sub}-{region}-kv",
      vnet: "{Org}-{SUB}-{ResourceGroup}-vnet",
      rg: "{Org}-{SUB}-{ResourceGroup}-rg",
      pip: "{Org}-{SUB}-{ResourceGroup}-pip"
    },
    subnetAllowed: [
      "snet-aks-system",
      "snet-aks-workloads",
      "snet-ingress",
      "snet-private-endpoints",
      "snet-database"
    ]
  },
  {
    id: "full-caf",
    name: "Full Enterprise CAF Suite",
    category: "Enterprise Scale",
    badge: "36 Resources",
    description: "Comprehensive catalogue of all 36 Cloud Adoption Framework resource types across networking, compute, security, storage, data, and AI.",
    resourceKeys: [], // Empty means all 36 types
    patterns: {}, // Uses each item's default AirGate pattern
    subnetAllowed: [
      "snet-apps",
      "snet-core",
      "snet-management",
      "snet-data",
      "GatewaySubnet",
      "AzureBastionSubnet",
      "AzureFirewallSubnet",
      "AzureFirewallManagementSubnet"
    ]
  }
];

export function getCustomTemplates() {
  try {
    const raw = localStorage.getItem("alz_naming_templates");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to read custom naming templates from storage", e);
    return [];
  }
}

export function saveCustomTemplate(template) {
  try {
    const existing = getCustomTemplates();
    const updated = [...existing.filter((t) => t.id !== template.id), template];
    localStorage.setItem("alz_naming_templates", JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn("Failed to save custom naming template", e);
    return [];
  }
}

export function deleteCustomTemplate(templateId) {
  try {
    const existing = getCustomTemplates();
    const updated = existing.filter((t) => t.id !== templateId);
    localStorage.setItem("alz_naming_templates", JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn("Failed to delete custom naming template", e);
    return [];
  }
}
