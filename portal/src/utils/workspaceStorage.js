import { DEFAULT_CUSTOMERS } from "../data/defaultCustomers.js";

export const STORAGE_KEYS = {
  CUSTOMERS: "alz_policy_customers",
  ACTIVE_CUSTOMER: "alz_active_customer_id",
  ACTIVE_CUSTOMER_ID: "alz_active_customer_id",
  CATALOG: "alz_policy_catalog",
  POLICY_CATALOG: "alz_policy_catalog",
  ACTIVE_TAB: "alz_active_tab",
  OVERRIDES: "alz_airgate_overrides",
  AIRGATE_OVERRIDES: "alz_airgate_overrides",
  THEME_MODE: "alz_theme_mode"
};

/**
 * Loads customer workspaces from localStorage with clean migration and fallback handling.
 */
export function loadStoredCustomers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Strip legacy mockup identifiers if present
        const hasLegacy = parsed.some(
          (c) => c.id === "cust01" || c.name === "CustomerName" || c.id === "nova-ai"
        );
        if (hasLegacy) {
          return DEFAULT_CUSTOMERS;
        }

        // Ensure Woodgrove Bank brownfield tenant baseline exists
        const defaultWoodgrove = DEFAULT_CUSTOMERS.find((c) => c.id === "woodgrove");
        const woodgroveIdx = parsed.findIndex((c) => c.id === "woodgrove");

        if (defaultWoodgrove) {
          if (woodgroveIdx === -1) {
            return [...parsed, defaultWoodgrove];
          } else if (
            !parsed[woodgroveIdx].topology ||
            parsed[woodgroveIdx].topology?.subscriptions?.[0]?.resourceGroups?.some(rg => rg.name === "rg-wg-prod-apps") ||
            !parsed[woodgroveIdx].topology?.subscriptions?.[0]?.resourceGroups?.some(rg => rg.name === "RG-CoreApp-Prod")
          ) {
            const updated = [...parsed];
            updated[woodgroveIdx] = {
              ...parsed[woodgroveIdx],
              topology: defaultWoodgrove.topology,
              brownfieldMetadata: defaultWoodgrove.brownfieldMetadata
            };
            saveStoredCustomers(updated);
            return updated;
          }
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load customer workspaces from storage", e);
  }
  return DEFAULT_CUSTOMERS;
}

/**
 * Safely persists customer workspaces to localStorage.
 */
export function saveStoredCustomers(customers) {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  } catch (e) {
    console.warn("Failed to save customers to storage", e);
  }
}

/**
 * Loads the active customer ID from localStorage, validating against available workspaces.
 */
export function loadStoredActiveCustomerId(customers = []) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_CUSTOMER);
    if (saved && saved !== "cust01" && saved !== "nova-ai" && customers.some((c) => c.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.warn("Failed to load active customer ID from storage", e);
  }
  return customers[0]?.id || DEFAULT_CUSTOMERS[0]?.id || "contoso";
}

/**
 * Pure helper for semantic version increments (patch, minor).
 */
export function bumpSemver(currentVersion = "1.0.0", type = "patch") {
  const parts = currentVersion.split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);

  if (type === "patch") {
    parts[2] += 1;
  } else if (type === "minor") {
    parts[1] += 1;
    parts[2] = 0;
  } else if (type === "major") {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  }

  return parts.join(".");
}
