import React, { useState, useEffect, useMemo } from "react";
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
import { AZURE_NAMING_CATALOG, DEFAULT_AIRGATE_OVERRIDES } from "./data/azureNamingCatalog.js";
import {
  STORAGE_KEYS,
  loadStoredCustomers,
  saveStoredCustomers,
  loadStoredActiveCustomerId,
  bumpSemver
} from "./utils/workspaceStorage.js";
import {
  calculateTopologyStats,
  calculateGovernanceReadiness,
  calculateTotalTagRules
} from "./utils/governanceMetrics.js";
import { Layers, Tag, FolderTree, BookOpen, Code2, CheckCircle2 } from "lucide-react";
import { AuTabs, AuTelemetryStrip, AuBadge } from "./theme";

const TOAST_DURATION_MS = 3200;
const DEFAULT_TAB = "topology";
const DEFAULT_THEME_MODE = "dark";

export function App() {
  // Load customer workspaces via clean storage manager
  const [customers, setCustomers] = useState(() => loadStoredCustomers());

  // Active customer workspace ID
  const [activeCustomerId, setActiveCustomerId] = useState(() =>
    loadStoredActiveCustomerId(customers)
  );

  // Resource Catalog state
  const [catalog, setCatalog] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POLICY_CATALOG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load catalog from storage", e);
    }
    return AZURE_RESOURCE_CATALOG;
  });

  // Navigation tab state (persisted across reloads)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
      if (saved) return saved;
    } catch (e) {
      console.warn("Failed to load active tab from storage", e);
    }
    return DEFAULT_TAB;
  });

  // AirGate enterprise standard overrides state
  const [overrides, setOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AIRGATE_OVERRIDES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to load overrides from storage", e);
    }
    return { ...DEFAULT_AIRGATE_OVERRIDES };
  });

  // Dual Theme State (Dark / Light)
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {
      console.warn("Failed to load theme mode from storage", e);
    }
    return DEFAULT_THEME_MODE;
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", themeMode);
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, themeMode);
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
    saveStoredCustomers(customers);
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
    } catch (e) {
      console.warn("Failed to save active tab to storage", e);
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CUSTOMER_ID, activeCustomerId);
    } catch (e) {
      console.warn("Failed to save active customer to storage", e);
    }
  }, [activeCustomerId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.POLICY_CATALOG, JSON.stringify(catalog));
    } catch (e) {
      console.warn("Failed to save catalog to storage", e);
    }
  }, [catalog]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AIRGATE_OVERRIDES, JSON.stringify(overrides));
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
    }, TOAST_DURATION_MS);
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
    const newVersion = bumpSemver(activeCustomer.version, type);
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

  // Dynamic Telemetry Metrics derived from active topology & governance state
  const topoStats = useMemo(() => calculateTopologyStats(activeCustomer), [activeCustomer]);
  const readiness = useMemo(() => calculateGovernanceReadiness(activeCustomer, catalog), [activeCustomer, catalog]);
  const totalTagRules = useMemo(() => calculateTotalTagRules(activeCustomer), [activeCustomer]);

  const stats = [
    {
      label: "Active Workspace",
      value: activeCustomer.name,
      meta: `${activeCustomer.subscriptionCode || "COR"} · v${activeCustomer.version || "1.0.0"} · ${(activeCustomer.environmentParadigm || "greenfield").toUpperCase()}`,
      accentValue: true
    },
    {
      label: "Management Scope",
      value: topoStats.scopeLabel,
      meta: topoStats.scopeMeta
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
      value: readiness.score,
      meta: readiness.meta,
      accentValue: readiness.isOptimal
    }
  ];

  const studioTabs = [
    { id: "topology", num: "01", label: "TOPOLOGY & SCOPES", badge: `${topoStats.subCount} Subs` },
    { id: "naming", num: "02", label: "NAMING STUDIO", badge: catalog.length },
    { id: "tagging", num: "03", label: "TAG GOVERNANCE", badge: totalTagRules },
    { id: "catalogue", num: "04", label: "RESOURCE CATALOG", badge: `${AZURE_NAMING_CATALOG.length} CAF` },
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
