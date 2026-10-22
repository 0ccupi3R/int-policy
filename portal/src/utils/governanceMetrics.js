import { evaluateResourceNode } from "../engine/topologyGenerator.js";
import { AZURE_RESOURCE_CATALOG } from "../data/azureResourceCatalog.js";

/**
 * Calculates live topology structural statistics for the active customer.
 */
export function calculateTopologyStats(customer) {
  if (!customer) {
    return {
      subCount: 0,
      rgCount: 0,
      resCount: 0,
      scopeLabel: "0 Subscriptions",
      scopeMeta: "No topology active"
    };
  }

  const subscriptions = customer.topology?.subscriptions || [];
  const subCount = subscriptions.length;
  let rgCount = 0;
  let resCount = 0;

  subscriptions.forEach((sub) => {
    const rgs = sub.resourceGroups || [];
    rgCount += rgs.length;
    rgs.forEach((rg) => {
      resCount += (rg.resources || []).length;
    });
  });

  const isBrownfield = customer.environmentParadigm === "brownfield";
  const totalDiscovered = customer.brownfieldMetadata?.totalDiscoveredResources || resCount;

  return {
    subCount,
    rgCount,
    resCount,
    scopeLabel: `${subCount} ${subCount === 1 ? "Subscription" : "Subscriptions"}`,
    scopeMeta: isBrownfield
      ? `Discovered Tenant · ${totalDiscovered} Resources`
      : `${rgCount} RGs · ${resCount} Resources Active`
  };
}

/**
 * Calculates live governance readiness score (%) based on actual resource compliance.
 */
export function calculateGovernanceReadiness(customer, catalog = AZURE_RESOURCE_CATALOG) {
  if (!customer) {
    return {
      score: "100%",
      meta: "ALZ Baseline Ready",
      isOptimal: true,
      violations: 0
    };
  }

  const subscriptions = customer.topology?.subscriptions || [];
  let totalResources = 0;
  let compliantResources = 0;

  subscriptions.forEach((sub) => {
    sub.resourceGroups?.forEach((rg) => {
      rg.resources?.forEach((res) => {
        totalResources++;
        const evalNode = evaluateResourceNode(customer, catalog, sub, rg, res);
        if (evalNode?.validation?.valid) {
          compliantResources++;
        }
      });
    });
  });

  if (totalResources === 0) {
    return {
      score: "100%",
      meta: "ALZ Baseline Ready",
      isOptimal: true,
      violations: 0
    };
  }

  const percentage = Math.round((compliantResources / totalResources) * 100);
  const violations = totalResources - compliantResources;

  return {
    score: `${percentage}%`,
    meta: violations === 0 ? "100% Policy Compliant" : `${violations} Non-Compliant · Remediate`,
    isOptimal: violations === 0,
    violations
  };
}

/**
 * Calculates total configured tag policy rules across all three scopes.
 */
export function calculateTotalTagRules(customer) {
  if (!customer || !customer.tags) return 0;
  return (
    (customer.tags.subscription?.length || 0) +
    (customer.tags.resourceGroup?.length || 0) +
    (customer.tags.resource?.length || 0)
  );
}
