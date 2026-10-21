import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.jsx";
import { NamingStudio } from "./components/NamingStudio.jsx";
import { TagStudio } from "./components/TagStudio.jsx";
import { CatalogManager } from "./components/CatalogManager.jsx";
import { CodeInspector } from "./components/CodeInspector.jsx";
import { TopologyGenerator } from "./components/TopologyGenerator.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { CustomerWorkspaceModal } from "./components/CustomerWorkspaceModal.jsx";
import { GuidedStepper } from "./components/GuidedStepper.jsx";
import { BrownfieldIngestionModal } from "./components/BrownfieldIngestionModal.jsx";
import {
  get4SubscriptionPlatformCoreTopology,
  getAirGateDefaultPlatformTopology
} from "./engine/topologyGenerator.js";
import { DEFAULT_CUSTOMERS } from "./data/defaultCustomers.js";
import { AZURE_RESOURCE_CATALOG } from "./data/azureResourceCatalog.js";
import { DEFAULT_AIRGATE_OVERRIDES } from "./data/azureNamingCatalog.js";
import { Layers, Tag, FolderTree, BookOpen, Code2, CheckCircle2 } from "lucide-react";
import { AuTabs, AuTelemetryStrip, AuBadge } from "./theme";

export function App() {
  // Load customers from localStorage or defaults
  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem("alz_policy_customers");
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasLegacy = Array.isArray(parsed) && parsed.some(
          (c) => c.id === "cust01" || c.name === "CustomerName" || c.id === "nova-ai"
        );
        if (!hasLegacy && Array.isArray(parsed) && parsed.length > 0) {
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
              try {
                localStorage.setItem("alz_policy_customers", JSON.stringify(updated));
              } catch {
                // ignore
              }
              return updated;
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load customers from storage", e);
    }
    return DEFAULT_CUSTOMERS;
  });

  const [activeCustomerId, setActiveCustomerId] = useState(() => {
    try {
      const saved = localStorage.getItem("alz_active_customer_id");
      if (saved && saved !== "cust01" && saved !== "nova-ai" && customers.some((c) => c.id === saved)) {
        return saved;
      }
    } catch (e) {
      console.warn("Failed to load active customer from storage", e);
    }
    return customers[0]?.id || "contoso";
  });

  // Resource Catalog state
  const [catalog, setCatalog] = useState(() => {
    try {
      const saved = localStorage.getItem("alz_policy_catalog");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to load catalog from storage", e);
    }
    return AZURE_RESOURCE_CATALOG;
  });

  // Navigation tab state (persisted across reloads)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem("alz_active_tab");
      if (saved) return saved;
    } catch (e) {
      console.warn("Failed to load active tab from storage", e);
    }
    return "topology";
  });

  // AirGate enterprise standard overrides state
  const [overrides, setOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem("alz_airgate_overrides");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to load overrides from storage", e);
    }
    return { ...DEFAULT_AIRGATE_OVERRIDES };
  });

  // Dual Theme State (Dark / Light)
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const saved = localStorage.getItem("alz_theme_mode");
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {
      console.warn("Failed to load theme mode from storage", e);
    }
    return "dark";
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", themeMode);
      localStorage.setItem("alz_theme_mode", themeMode);
    } catch (e) {
      console.warn("Failed to sync theme attribute to DOM", e);
    }
  }, [themeMode]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("edit"); // "edit" or "create"
  const [brownfieldModalOpen, setBrownfieldModalOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("alz_policy_customers", JSON.stringify(customers));
    } catch (e) {
      console.warn("Failed to save customers to storage", e);
    }
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem("alz_active_tab", activeTab);
    } catch (e) {
      console.warn("Failed to save active tab to storage", e);
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem("alz_active_customer_id", activeCustomerId);
    } catch (e) {
      console.warn("Failed to save active customer to storage", e);
    }
  }, [activeCustomerId]);

  useEffect(() => {
    try {
      localStorage.setItem("alz_policy_catalog", JSON.stringify(catalog));
    } catch (e) {
      console.warn("Failed to save catalog to storage", e);
    }
  }, [catalog]);

  useEffect(() => {
    try {
      localStorage.setItem("alz_airgate_overrides", JSON.stringify(overrides));
    } catch (e) {
      console.warn("Failed to save overrides to storage", e);
    }
  }, [overrides]);

  const activeCustomer =
    customers.find((c) => c.id === activeCustomerId) || customers[0] || DEFAULT_CUSTOMERS[0];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleUpdateCustomer = (updated) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleSaveCustomerModal = (customerData, mode) => {
    if (mode === "create") {
      let prepared = { ...customerData };
      if (prepared.environmentParadigm === "greenfield") {
        if (prepared.scaffoldingPreset === "4-sub-core") {
          prepared.topology = get4SubscriptionPlatformCoreTopology(prepared);
        } else {
          prepared.topology = getAirGateDefaultPlatformTopology(prepared);
        }
      } else if (prepared.environmentParadigm === "brownfield") {
        prepared.topology = { subscriptions: [] };
        prepared.namingRules = {
          ...prepared.namingRules,
          inferredPatterns: null
        };
      }
      setCustomers((prev) => [...prev, prepared]);
      setActiveCustomerId(prepared.id);
      showToast(`Created workspace for ${prepared.name} (${(prepared.environmentParadigm || "greenfield").toUpperCase()})!`);
      if (prepared.environmentParadigm === "brownfield") {
        setBrownfieldModalOpen(true);
      }
    } else {
      handleUpdateCustomer(customerData);
      showToast(`Updated profile for ${customerData.name}!`);
    }
  };

  const handleBrownfieldIngestionSuccess = (updatedCustomer) => {
    handleUpdateCustomer(updatedCustomer);
    setBrownfieldModalOpen(false);
    showToast(`Ingested tenant! Discovered ${updatedCustomer.brownfieldMetadata?.totalDiscoveredResources || 0} resources.`);
    setActiveTab("naming");
  };

  const handleDeleteCustomer = (customerId) => {
    const remaining = customers.filter((c) => c.id !== customerId);
    if (remaining.length > 0) {
      setCustomers(remaining);
      setActiveCustomerId(remaining[0].id);
      showToast("Workspace deleted.");
    }
  };

  const handleBumpVersion = (type) => {
    const current = activeCustomer.version || "1.0.0";
    const parts = current.split(".").map((n) => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);

    if (type === "patch") {
      parts[2] += 1;
    } else if (type === "minor") {
      parts[1] += 1;
      parts[2] = 0;
    }

    const newVersion = parts.join(".");
    const updated = {
      ...activeCustomer,
      version: newVersion
    };
    handleUpdateCustomer(updated);
    showToast(`Bumped ${activeCustomer.name} version to v${newVersion}!`);
  };

  const handleAddResourceType = (newType) => {
    setCatalog((prev) => [...prev, newType]);
  };

  // Telemetry Metrics calculation
  const totalTagRules =
    (activeCustomer.tags?.subscription?.length || 0) +
    (activeCustomer.tags?.resourceGroup?.length || 0) +
    (activeCustomer.tags?.resource?.length || 0);

  const stats = [
    {
      label: "Active Workspace",
      value: activeCustomer.name,
      meta: `${activeCustomer.subscriptionCode || "COR"} · v${activeCustomer.version || "1.0.0"}`,
      accentValue: true
    },
    {
      label: "Management Scope",
      value: "4 Levels",
      meta: "Root → Platform → LZ → Sandbox"
    },
    {
      label: "Resource Types",
      value: `${catalog.length}`,
      meta: "CAF Standards Active"
    },
    {
      label: "Tag Policy Rules",
      value: `${totalTagRules}`,
      meta: "FinOps & Security Enforced"
    },
    {
      label: "Readiness Index",
      value: "96%",
      meta: "ALZ v2.4 Compliant",
      accentValue: true
    }
  ];

  const studioTabs = [
    { id: "topology", num: "01", label: "TOPOLOGY & SCOPES", badge: "Unified" },
    { id: "naming", num: "02", label: "NAMING STUDIO", badge: catalog.length },
    { id: "tagging", num: "03", label: "TAG GOVERNANCE", badge: totalTagRules },
    { id: "catalogue", num: "04", label: "RESOURCE CATALOG", badge: "200 CAF" },
    { id: "code", num: "05", label: "IAC EXPORT", badge: `v${activeCustomer.version || "1.0"}` }
  ];

  return (
    <div className="app-container">
      <Header
        customers={customers}
        activeCustomer={activeCustomer}
        onSelectCustomer={setActiveCustomerId}
        onOpenCustomerModal={(mode) => {
          setModalMode(mode);
          setModalOpen(true);
        }}
        onOpenBrownfieldModal={() => setBrownfieldModalOpen(true)}
        onBumpVersion={handleBumpVersion}
        catalog={catalog}
        onShowToast={showToast}
        themeMode={themeMode}
        onToggleThemeMode={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
      />

      <main className="main-content">
        {/* HUD Tactical Telemetry Ribbon */}
        <div style={{ marginBottom: "1.5rem" }}>
          <AuTelemetryStrip stats={stats} />
        </div>

        {/* Greenfield / Brownfield Guided Journey Stepper */}
        <div style={{ marginBottom: "1.25rem" }}>
          <GuidedStepper
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            customer={activeCustomer}
          />
        </div>

        {/* Numbered HUD Tabs */}
        <div style={{ marginBottom: "1.5rem" }}>
          <AuTabs
            tabs={studioTabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Studio Tab Views */}
        <ErrorBoundary fallbackTitle="An error occurred rendering this studio tab.">
          {activeTab === "topology" && (
            <TopologyGenerator
              customer={activeCustomer}
              catalog={catalog}
              onUpdateCustomer={handleUpdateCustomer}
              onShowToast={showToast}
            />
          )}

          {activeTab === "naming" && (
            <NamingStudio
              customer={activeCustomer}
              catalog={catalog}
              onUpdateCustomer={handleUpdateCustomer}
              onAddResourceType={handleAddResourceType}
              onShowToast={showToast}
            />
          )}

          {activeTab === "tagging" && (
            <TagStudio
              customer={activeCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onShowToast={showToast}
              onNavigateToCatalogue={() => setActiveTab("catalogue")}
              onNavigateToTopology={() => setActiveTab("topology")}
            />
          )}

          {activeTab === "catalogue" && (
            <CatalogManager
              customer={activeCustomer}
              catalog={catalog}
              onAddResourceType={handleAddResourceType}
              onShowToast={showToast}
              overrides={overrides}
              onUpdateOverrides={setOverrides}
            />
          )}

          {activeTab === "code" && (
            <CodeInspector
              customer={activeCustomer}
              catalog={catalog}
              onShowToast={showToast}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Customer Workspace Modal */}
      <CustomerWorkspaceModal
        isOpen={modalOpen}
        mode={modalMode}
        customer={activeCustomer}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCustomerModal}
        onDelete={handleDeleteCustomer}
        canDelete={customers.length > 1}
      />

      {/* Brownfield Ingestion Modal */}
      <BrownfieldIngestionModal
        isOpen={brownfieldModalOpen}
        customer={activeCustomer}
        onClose={() => setBrownfieldModalOpen(false)}
        onIngestSuccess={handleBrownfieldIngestionSuccess}
        onShowToast={showToast}
      />

      {/* Snappy Toast Notification */}
      {toastMessage && (
        <div className="toast-notice">
          <CheckCircle2 size={16} style={{ color: "var(--accent-mint)" }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
