import React, { useState, useMemo, useEffect } from "react";
import {
  evaluateResourceNode,
  evaluateRgNode,
  generateBicepParameters,
  generateArmParameters,
  generateCompanionResourcesBicep,
  getBaselineTopology,
  getAirGateDefaultPlatformTopology,
  validateSubscriptionInput,
  validateResourceGroupInput,
  validateResourceInput,
  getNextAvailableInstance
} from "../engine/topologyGenerator.js";
import { AuHudCard, AuButton, AuBadge, AuExpandCollapseButton, AuCodeViewer, AuSelect } from "../theme";
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Tag,
  ChevronDown,
  ChevronRight,
  Globe,
  FolderTree,
  FileCode,
  Sliders,
  RotateCcw,
  Zap,
  X,
  Check,
  Edit3,
  Search,
  Sparkles
} from "lucide-react";

export function TopologyGenerator({ customer, catalog, onUpdateCustomer, onShowToast }) {
  // Ensure customer has a topology initialized
  const topology = useMemo(() => {
    if (customer.topology && customer.topology.subscriptions && customer.topology.subscriptions.length > 0) {
      return customer.topology;
    }
    return getBaselineTopology(customer);
  }, [customer]);

  // Persist active subscription tab in localStorage
  const [activeSubIndex, setActiveSubIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(`alz_topology_sub_idx_${customer.id}`);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {}
    return 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`alz_topology_sub_idx_${customer.id}`, activeSubIndex.toString());
    } catch {}
  }, [activeSubIndex, customer.id]);

  const [selectedResId, setSelectedResId] = useState(null);
  const [expandedRgs, setExpandedRgs] = useState({});

  const [expandedTagEditors, setExpandedTagEditors] = useState({}); // { [id]: boolean }
  const [codeDrawerOpen, setCodeDrawerOpen] = useState(false);
  const [codeTab, setCodeTab] = useState("bicepparam"); // "bicepparam" | "armparam" | "bicepmodule"
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Deletion Confirmation Modal state: { type: "sub"|"rg", id, name, subIndex, rgCount, resCount }
  const [deleteModal, setDeleteModal] = useState(null);

  // Preset Confirmation Modal state: "airgate" | "reset" | null
  const [presetModal, setPresetModal] = useState(null);

  // Creation & Configuration Modals
  // Subscription Modal state: { mode: "add"|"edit", id, name, code, environment, location } | null
  const [subModal, setSubModal] = useState(null);

  // Resource Group Modal state: { purpose, customPurpose, nameOverride, location, initialResourceType } | null
  const [rgModal, setRgModal] = useState(null);

  // Resource Modal state: { rgId, resourceTypeKey, purpose, instance, osType, searchQuery } | null
  const [resModal, setResModal] = useState(null);

  // Dismiss modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (deleteModal) setDeleteModal(null);
        if (presetModal) setPresetModal(null);
        if (subModal) setSubModal(null);
        if (rgModal) setRgModal(null);
        if (resModal) setResModal(null);
      }
    };
    if (deleteModal || presetModal || subModal || rgModal || resModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [deleteModal, presetModal, subModal, rgModal, resModal]);

  // Ensure activeSubIndex stays in bounds if subscriptions are deleted
  const safeSubIndex = Math.min(activeSubIndex, Math.max(0, (topology.subscriptions?.length || 1) - 1));
  const activeSub = topology.subscriptions[safeSubIndex] || topology.subscriptions[0] || {};
  const resourceGroups = activeSub.resourceGroups || [];

  // Update customer's topology state
  const handleUpdateTopology = (newTopology) => {
    onUpdateCustomer({
      ...customer,
      topology: newTopology
    });
  };

  const toggleRgExpand = (rgId) => {
    setExpandedRgs((prev) => ({
      ...prev,
      [rgId]: !prev[rgId]
    }));
  };

  const allRgsExpanded = resourceGroups.length > 0 && resourceGroups.every((rg) => !!expandedRgs[rg.id]);

  const handleToggleAllRgs = () => {
    if (allRgsExpanded) {
      setExpandedRgs({});
    } else {
      const next = {};
      resourceGroups.forEach((rg) => {
        next[rg.id] = true;
      });
      setExpandedRgs(next);
    }
  };

  const toggleTagEditor = (id) => {

    setExpandedTagEditors((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // ----------------------------------------------------------------------------
  // Subscription Handlers
  // ----------------------------------------------------------------------------
  const openAddSubscriptionModal = () => {
    let nextNum = topology.subscriptions.length + 1;
    let candidateName = `Workload-${nextNum.toString().padStart(2, "0")}`;
    let candidateCode = `WL${nextNum.toString().padStart(2, "0")}`;
    while (
      topology.subscriptions.some(
        (s) => s.name?.toLowerCase() === candidateName.toLowerCase() || s.code?.toLowerCase() === candidateCode.toLowerCase()
      )
    ) {
      nextNum++;
      candidateName = `Workload-${nextNum.toString().padStart(2, "0")}`;
      candidateCode = `WL${nextNum.toString().padStart(2, "0")}`;
    }

    setSubModal({
      mode: "add",
      name: candidateName,
      code: candidateCode,
      environment: customer.environment || "prod",
      location: customer.defaultRegion || "canadacentral"
    });
  };

  const openEditSubscriptionModal = () => {
    setSubModal({
      mode: "edit",
      subIndex: safeSubIndex,
      id: activeSub.id,
      name: activeSub.name || "",
      code: activeSub.code || "",
      environment: activeSub.environment || "prod",
      location: activeSub.location || "canadacentral"
    });
  };

  const handleSaveSubscription = () => {
    if (!subModal) return;
    const validation = validateSubscriptionInput(
      subModal,
      topology.subscriptions,
      subModal.mode === "edit" ? activeSub.id : null
    );
    if (!validation.valid) {
      onShowToast(validation.duplicateError || validation.errors[0] || "Invalid subscription details");
      return;
    }

    if (subModal.mode === "add") {
      const newSub = {
        id: `sub-${Date.now()}`,
        name: validation.sanitized.name,
        code: validation.sanitized.code,
        environment: validation.sanitized.environment,
        location: validation.sanitized.location,
        resourceGroups: [
          {
            id: `rg-app-${Date.now()}`,
            purpose: "apps",
            name: "",
            location: validation.sanitized.location,
            resources: [
              { id: `res-vm-${Date.now()}`, resourceTypeKey: "vm", purpose: "apps", instance: "01", osType: "Windows" },
              { id: `res-sa-${Date.now()}`, resourceTypeKey: "storage", purpose: "apps", instance: "01" }
            ]
          }
        ]
      };
      const newSubs = [...topology.subscriptions, newSub];
      handleUpdateTopology({ ...topology, subscriptions: newSubs });
      setActiveSubIndex(newSubs.length - 1);
      onShowToast(`Created Subscription ${newSub.name} (${newSub.code})!`);
    } else {
      const updatedSubs = topology.subscriptions.map((s, idx) => {
        if (idx !== safeSubIndex) return s;
        return {
          ...s,
          name: validation.sanitized.name,
          code: validation.sanitized.code,
          environment: validation.sanitized.environment,
          location: validation.sanitized.location
        };
      });
      handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
      onShowToast(`Updated Subscription ${validation.sanitized.name}!`);
    }
    setSubModal(null);
  };

  const requestDeleteSubscription = (subIdx) => {
    if (topology.subscriptions.length <= 1) {
      onShowToast("Cannot delete the only Subscription in the topology.");
      return;
    }
    const targetSub = topology.subscriptions[subIdx];
    const rgCount = targetSub.resourceGroups?.length || 0;
    let resCount = 0;
    (targetSub.resourceGroups || []).forEach((rg) => {
      resCount += rg.resources?.length || 0;
    });

    setDeleteModal({
      type: "sub",
      subIndex: subIdx,
      name: `${targetSub.name} (${targetSub.code})`,
      rgCount,
      resCount
    });
  };

  const executeConfirmDelete = () => {
    if (!deleteModal) return;

    if (deleteModal.type === "sub") {
      const newSubs = topology.subscriptions.filter((_, idx) => idx !== deleteModal.subIndex);
      handleUpdateTopology({ ...topology, subscriptions: newSubs });
      setActiveSubIndex(Math.max(0, deleteModal.subIndex - 1));
      onShowToast(`Deleted subscription ${deleteModal.name}.`);
    } else if (deleteModal.type === "rg") {
      const updatedSubs = topology.subscriptions.map((sub, idx) => {
        if (idx !== safeSubIndex) return sub;
        return {
          ...sub,
          resourceGroups: (sub.resourceGroups || []).filter((rg) => rg.id !== deleteModal.id)
        };
      });
      handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
      onShowToast(`Deleted Resource Group ${deleteModal.name}.`);
    }

    setDeleteModal(null);
  };

  // ----------------------------------------------------------------------------
  // Resource Group Handlers
  // ----------------------------------------------------------------------------
  const openAddRgModal = () => {
    const standardPurposes = customer.purposes && customer.purposes.length > 0
      ? customer.purposes
      : ["apps", "data", "services", "monitoring", "identity", "security", "ai", "hub", "core"];
    const existingPurposes = new Set((activeSub.resourceGroups || []).map((r) => (r.purpose || "").toLowerCase()));
    const suggestedPurpose = standardPurposes.find((p) => !existingPurposes.has(p.toLowerCase())) || "services";

    setRgModal({
      purpose: suggestedPurpose,
      customPurpose: "",
      nameOverride: "",
      location: activeSub.location || customer.defaultRegion || "canadacentral",
      initialResourceType: "vnet"
    });
  };

  const handleSaveRg = () => {
    if (!rgModal) return;
    const effectivePurpose = rgModal.purpose === "__custom__" ? rgModal.customPurpose.trim().toLowerCase() : rgModal.purpose;
    const validation = validateResourceGroupInput(
      { purpose: effectivePurpose, name: rgModal.nameOverride, location: rgModal.location },
      activeSub,
      customer,
      catalog
    );

    if (!validation.valid) {
      onShowToast(validation.duplicateError || validation.errors[0] || "Invalid Resource Group configuration");
      return;
    }

    const newRg = {
      id: `rg-${Date.now()}`,
      purpose: effectivePurpose,
      name: rgModal.nameOverride.trim(),
      location: rgModal.location,
      tags: {},
      resources: rgModal.initialResourceType && rgModal.initialResourceType !== "none"
        ? [
            {
              id: `res-${Date.now()}-1`,
              resourceTypeKey: rgModal.initialResourceType,
              purpose: effectivePurpose,
              instance: "01",
              osType: rgModal.initialResourceType === "vm" ? "Windows" : undefined
            }
          ]
        : []
    };

    const updatedSubs = topology.subscriptions.map((sub, idx) => {
      if (idx !== safeSubIndex) return sub;
      return {
        ...sub,
        resourceGroups: [...(sub.resourceGroups || []), newRg]
      };
    });

    setExpandedRgs((prev) => ({ ...prev, [newRg.id]: true }));
    handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
    onShowToast(`Created Resource Group (${validation.evaluatedName})!`);
    setRgModal(null);
  };

  const handleUpdateRg = (rgId, updates) => {
    const updatedSubs = topology.subscriptions.map((sub, idx) => {
      if (idx !== safeSubIndex) return sub;
      return {
        ...sub,
        resourceGroups: (sub.resourceGroups || []).map((rg) => (rg.id === rgId ? { ...rg, ...updates } : rg))
      };
    });
    handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
  };

  const requestDeleteRg = (rgId, rgName, resCount) => {
    if (resourceGroups.length <= 1) {
      onShowToast("Cannot delete the only Resource Group in this subscription.");
      return;
    }
    setDeleteModal({
      type: "rg",
      id: rgId,
      name: rgName,
      resCount
    });
  };

  // ----------------------------------------------------------------------------
  // Resource Handlers
  // ----------------------------------------------------------------------------
  const openAddResourceModal = (rgId) => {
    const targetRg = resourceGroups.find((r) => r.id === rgId);
    const defaultPurpose = targetRg?.purpose || "core";
    const defaultType = "storage";
    const nextInst = getNextAvailableInstance(targetRg, defaultType, defaultPurpose);

    setResModal({
      rgId,
      resourceTypeKey: defaultType,
      purpose: defaultPurpose,
      instance: nextInst,
      osType: "Windows",
      searchQuery: ""
    });
  };

  const handleSaveResource = () => {
    if (!resModal) return;
    const targetRg = resourceGroups.find((r) => r.id === resModal.rgId);
    if (!targetRg) return;

    const validation = validateResourceInput(
      {
        resourceTypeKey: resModal.resourceTypeKey,
        purpose: resModal.purpose,
        instance: resModal.instance,
        osType: resModal.osType
      },
      targetRg,
      activeSub,
      customer,
      catalog
    );

    if (!validation.valid) {
      onShowToast(validation.duplicateError || validation.errors[0] || "Invalid resource configuration");
      return;
    }

    const newRes = {
      id: `res-${Date.now()}`,
      resourceTypeKey: resModal.resourceTypeKey,
      purpose: resModal.purpose.toLowerCase().replace(/[^a-z0-9]/g, ""),
      instance: resModal.instance.padStart(2, "0"),
      osType: (resModal.resourceTypeKey === "vm" || validation.resourceMeta?.resourceType?.toLowerCase().includes("virtualmachines")) ? resModal.osType : undefined,
      tags: {}
    };

    const updatedSubs = topology.subscriptions.map((sub, idx) => {
      if (idx !== safeSubIndex) return sub;
      return {
        ...sub,
        resourceGroups: (sub.resourceGroups || []).map((rg) => {
          if (rg.id !== resModal.rgId) return rg;
          return {
            ...rg,
            resources: [...(rg.resources || []), newRes]
          };
        })
      };
    });

    handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
    setSelectedResId(newRes.id);
    onShowToast(`Added resource: ${validation.evaluatedName}!`);
    setResModal(null);
  };

  const handleUpdateResource = (rgId, resId, updates) => {
    const updatedSubs = topology.subscriptions.map((sub, idx) => {
      if (idx !== safeSubIndex) return sub;
      return {
        ...sub,
        resourceGroups: (sub.resourceGroups || []).map((rg) => {
          if (rg.id !== rgId) return rg;
          return {
            ...rg,
            resources: (rg.resources || []).map((r) => (r.id === resId ? { ...r, ...updates } : r))
          };
        })
      };
    });
    handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
  };

  const handleDeleteResource = (rgId, resId) => {
    const updatedSubs = topology.subscriptions.map((sub, idx) => {
      if (idx !== safeSubIndex) return sub;
      return {
        ...sub,
        resourceGroups: (sub.resourceGroups || []).map((rg) => {
          if (rg.id !== rgId) return rg;
          return {
            ...rg,
            resources: (rg.resources || []).filter((r) => r.id !== resId)
          };
        })
      };
    });
    handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
    onShowToast("Resource removed.");
  };

  // ----------------------------------------------------------------------------
  // Tag Override Handlers
  // ----------------------------------------------------------------------------
  const handleSetRgTagOverride = (rgId, key, value) => {
    const currentRg = resourceGroups.find((r) => r.id === rgId);
    if (!currentRg) return;

    const newTags = { ...(currentRg.tags || {}) };
    if (!value) {
      delete newTags[key];
    } else {
      newTags[key] = value;
    }

    handleUpdateRg(rgId, { tags: newTags });
    onShowToast(`Updated RG tag [${key} = ${value || "Inherited"}]`);
  };

  const handleSetResourceTagOverride = (rgId, resId, key, value) => {
    const currentRg = resourceGroups.find((r) => r.id === rgId);
    if (!currentRg) return;
    const currentRes = (currentRg.resources || []).find((r) => r.id === resId);
    if (!currentRes) return;

    const newTags = { ...(currentRes.tags || {}) };
    if (!value) {
      delete newTags[key];
    } else {
      newTags[key] = value;
    }

    handleUpdateResource(rgId, resId, { tags: newTags });
    onShowToast(`Updated resource tag [${key} = ${value || "Inherited"}]`);
  };

  // ----------------------------------------------------------------------------
  // Preset Handlers
  // ----------------------------------------------------------------------------
  const handleApplyPreset = (presetType) => {
    if (presetType === "airgate") {
      const airgateTopology = getAirGateDefaultPlatformTopology(customer);
      handleUpdateTopology(airgateTopology);
      setActiveSubIndex(0);
      setPresetModal(null);
      onShowToast("⚡ Loaded AirGate Default Platform Landing Zone (5 Subscriptions)!");
    } else if (presetType === "reset") {
      const baseline = getBaselineTopology(customer);
      handleUpdateTopology(baseline);
      setActiveSubIndex(0);
      setPresetModal(null);
      onShowToast("Reset topology to workspace profile defaults.");
    }
  };

  // ----------------------------------------------------------------------------
  // Code Generators & Exports
  // ----------------------------------------------------------------------------
  const bicepParamsCode = useMemo(() => {
    return generateBicepParameters(customer, topology, catalog);
  }, [customer, topology, catalog]);

  const armParamsCode = useMemo(() => {
    return JSON.stringify(generateArmParameters(customer, topology, catalog), null, 2);
  }, [customer, topology, catalog]);

  const resourcesBicepCode = useMemo(() => {
    return generateCompanionResourcesBicep(customer, topology);
  }, [customer, topology]);

  const currentCodeContent =
    codeTab === "bicepparam"
      ? bicepParamsCode
      : codeTab === "armparam"
      ? armParamsCode
      : resourcesBicepCode;

  const currentCodeFilename =
    codeTab === "bicepparam"
      ? "resources.bicepparam"
      : codeTab === "armparam"
      ? "parameters.json"
      : "resources.bicep";

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCodeContent);
    setCopied(true);
    onShowToast(`Copied ${currentCodeFilename} to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([currentCodeContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentCodeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Downloaded ${currentCodeFilename}!`);
  };

  // ----------------------------------------------------------------------------
  // Metric Calculations
  // ----------------------------------------------------------------------------
  let totalResourcesCount = 0;
  let validationErrorCount = 0;

  (topology.subscriptions || []).forEach((sub) => {
    (sub.resourceGroups || []).forEach((rg) => {
      (rg.resources || []).forEach((res) => {
        totalResourcesCount++;
        const evalNode = evaluateResourceNode(customer, catalog, sub, rg, res);
        if (!evalNode.validation.valid) {
          validationErrorCount++;
        }
      });
    });
  });

  // Collect all known governance tag definitions for dropdown population
  const allTagDefinitions = useMemo(() => {
    const map = {};
    (customer.tags?.subscription || []).forEach((t) => (map[t.key] = t));
    (customer.tags?.resourceGroup || []).forEach((t) => (map[t.key] = t));
    (customer.tags?.resource || []).forEach((t) => (map[t.key] = t));
    return map;
  }, [customer]);

  // Dynamically derive applicable tag keys for RG override dropdown from customer governance rules
  const applicableRgTagKeys = useMemo(() => {
    const keys = new Set([
      ...(customer.tags?.subscription || []).map((t) => t.key),
      ...(customer.tags?.resourceGroup || []).map((t) => t.key)
    ]);
    if (keys.size === 0) {
      ["CostCenter", "Environment", "Workload", "Owner"].forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  }, [customer]);

  // Dynamically derive applicable tag keys for Resource override dropdown from customer governance rules
  const applicableResTagKeys = useMemo(() => {
    const keys = new Set([
      ...(customer.tags?.subscription || []).map((t) => t.key),
      ...(customer.tags?.resourceGroup || []).map((t) => t.key),
      ...(customer.tags?.resource || []).map((t) => t.key)
    ]);
    if (keys.size === 0) {
      [
        "CostCenter",
        "Environment",
        "Workload",
        "Application",
        "DataClassification",
        "Criticality",
        "DisasterRecovery",
        "Owner"
      ].forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  }, [customer]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner & KPI Ribbon */}
      <AuHudCard
        kicker="TOPOLOGY & CANONICAL GOVERNANCE"
        title="Resource Topology & Parameter Generator"
        meta={
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
            <span className="au-badge au-badge-mint">Unified Engine</span>
            <span className="au-mono-meta">· {totalResourcesCount} Resources</span>
            {validationErrorCount > 0 ? (
              <span className="au-badge au-badge-rose">⚠ {validationErrorCount} Non-Compliant</span>
            ) : (
              <span className="au-badge au-badge-mint">✔ All Compliant</span>
            )}
          </div>
        }
        action={
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <AuButton
              variant="secondary"
              size="sm"
              onClick={() => setPresetModal("airgate")}
              title="Scaffold standard 5-subscription enterprise architecture"
              icon={<Zap size={13} style={{ color: "var(--accent-primary)" }} />}
            >
              AirGate Default Platform
            </AuButton>

            <AuButton
              variant="secondary"
              size="sm"
              onClick={() => setPresetModal("reset")}
              title="Reset to customer profile baseline"
              icon={<RotateCcw size={13} />}
            >
              Reset Baseline
            </AuButton>

            <AuButton
              variant="primary"
              size="sm"
              onClick={() => setCodeDrawerOpen(!codeDrawerOpen)}
              icon={<Code2 size={13} />}
            >
              {codeDrawerOpen ? "Hide Live Code" : "Live IaC Parameters"}
            </AuButton>
          </div>
        }
      >
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
          Scaffold your Subscription → Resource Group → Leaf Resource topology with automated canonical
          resource naming and multi-tier governance tag inheritance.
        </p>
      </AuHudCard>

      {/* Subscription Selector Bar */}
      <div className="glass-panel" style={{ padding: "12px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: "600", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Subscriptions:
            </span>
            {(topology.subscriptions || []).map((sub, idx) => (
              <button
                key={sub.id}
                onClick={() => setActiveSubIndex(idx)}
                className={`btn btn-sm ${safeSubIndex === idx ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Globe size={13} />
                <span>
                  {sub.name} ({sub.code})
                </span>
                <span className="chip" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                  {sub.environment}
                </span>
              </button>
            ))}

            <button
              className="btn btn-secondary btn-sm"
              onClick={openAddSubscriptionModal}
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              title="Add another subscription to topology"
            >
              <Plus size={13} />
              <span>Add Sub</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={openEditSubscriptionModal}
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              title="Edit current subscription properties"
            >
              <Edit3 size={13} />
              <span>Edit Sub</span>
            </button>

            {topology.subscriptions.length > 1 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => requestDeleteSubscription(safeSubIndex)}
                style={{ fontSize: "0.75rem", padding: "4px 8px", color: "var(--accent-rose)" }}
                title="Delete current subscription"
              >
                <Trash2 size={13} />
                <span>Delete Sub</span>
              </button>
            )}
          </div>

          {/* Sub Inherited Tags preview */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
            <Tag size={13} color="var(--azure-cyan)" />
            <span>Sub Tags:</span>
            {Object.entries(activeSub.tags || {}).length > 0 ? (
              Object.entries(activeSub.tags).map(([k, v]) => (
                <span key={k} className="chip chip-azure" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                  {k} = {v}
                </span>
              ))
            ) : (
              <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontStyle: "italic" }}>
                None defined
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Layout: Topology Designer on Left, Code Drawer on Right if open */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: codeDrawerOpen ? "1.2fr 1fr" : "1fr",
          gap: "24px",
          alignItems: "start"
        }}
      >
        {/* Visual Topology Designer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* RG Group Header Action */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Layers size={18} style={{ color: "var(--accent-primary)" }} />
              <span>Resource Groups in {activeSub.name}</span>
              <span className="au-badge">
                {resourceGroups.length} Groups
              </span>
            </h3>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  id="topology-filter-input"
                  name="topology_filter"
                  aria-label="Filter groups and resources"
                  type="text"
                  placeholder="Filter groups & resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input form-input-mono"
                  style={{ paddingLeft: "30px", width: "220px", fontSize: "0.8rem", padding: "0.4rem 0.6rem 0.4rem 1.9rem" }}
                />
              </div>

              <AuExpandCollapseButton
                allExpanded={allRgsExpanded}
                onToggle={handleToggleAllRgs}
              />

              <AuButton
                variant="primary"
                size="sm"
                onClick={openAddRgModal}
                icon={<Plus size={14} />}
              >
                Add Resource Group
              </AuButton>
            </div>
          </div>

          {/* Resource Groups Cards */}
          {(searchQuery.trim()
            ? resourceGroups.filter((rg) => {
                const q = searchQuery.toLowerCase().trim();
                const evalName = evaluateRgNode(customer, catalog, activeSub, rg).evaluatedName.toLowerCase();
                const matchRes = (rg.resources || []).some((res) => (res.purpose || res.resourceTypeKey || "").toLowerCase().includes(q));
                return (rg.purpose || "").toLowerCase().includes(q) || evalName.includes(q) || matchRes;
              })
            : resourceGroups
          ).map((rg) => {
            const evalRg = evaluateRgNode(customer, catalog, activeSub, rg);
            const isExpanded = !!expandedRgs[rg.id];

            const isRgTagEditorOpen = expandedTagEditors[rg.id] ?? false;
            const resCount = rg.resources?.length || 0;
            const hasRgOverrides = rg.tags && Object.keys(rg.tags).length > 0;
            const isDuplicateRg = resourceGroups.some(
              (other) => other.id !== rg.id && evaluateRgNode(customer, catalog, activeSub, other).evaluatedName.toLowerCase() === evalRg.evaluatedName.toLowerCase()
            );

            return (
              <div
                key={rg.id}
                className="au-hud-card"
                style={{
                  border: isDuplicateRg ? "1px solid var(--accent-rose)" : "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  transition: "all 0.2s ease"
                }}
              >
                {/* RG Header Banner */}
                <div
                  style={{
                    padding: "14px 18px",
                    background: isDuplicateRg ? "rgba(244, 63, 94, 0.05)" : "rgba(255, 255, 255, 0.02)",
                    borderBottom: isExpanded ? "1px solid var(--border-subtle)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    cursor: "pointer"
                  }}
                  onClick={() => toggleRgExpand(rg.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ color: "var(--text-muted)" }}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.95rem",
                            fontWeight: "700",
                            color: isDuplicateRg ? "var(--accent-rose)" : "#38bdf8"
                          }}
                        >
                          {evalRg.evaluatedName}
                        </span>

                        {isDuplicateRg ? (
                          <span
                            className="chip"
                            style={{ fontSize: "0.7rem", padding: "2px 8px", background: "rgba(244, 63, 94, 0.15)", color: "var(--accent-rose)", borderColor: "rgba(244, 63, 94, 0.4)" }}
                            title="A Resource Group with this evaluated name already exists in this subscription"
                          >
                            <AlertTriangle size={12} />
                            <span>Already Exists (Duplicate Name)</span>
                          </span>
                        ) : evalRg.validation.valid ? (
                          <span className="chip chip-emerald" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                            <CheckCircle2 size={12} />
                            <span>Valid RG</span>
                          </span>
                        ) : (
                          <span className="chip chip-amber" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                            <AlertTriangle size={12} />
                            <span>Constraint Violation</span>
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "10px", marginTop: "4px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span>
                          Purpose: <strong>{rg.purpose}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Location: <strong>{evalRg.location}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Resources: <strong>{resCount}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RG Actions & Tag Pills */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center", marginRight: "6px", flexWrap: "wrap" }}>
                      {Object.entries(evalRg.tags || {}).slice(0, 3).map(([k, v]) => (
                        <span
                          key={k}
                          className={`chip ${evalRg.tagOrigins?.[k]?.source?.includes("override") ? "chip-purple" : ""}`}
                          style={{ fontSize: "0.68rem" }}
                        >
                          {k}: {v}
                        </span>
                      ))}
                    </div>

                    {/* Toggle RG Tag Override Drawer */}
                    <button
                      className={`btn btn-sm ${hasRgOverrides ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => toggleTagEditor(rg.id)}
                      style={{ fontSize: "0.72rem", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
                      title="Override tags for this Resource Group"
                    >
                      <Sliders size={12} />
                      <span>{hasRgOverrides ? "RG Tags (Custom)" : "Override Tags"}</span>
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openAddResourceModal(rg.id)}
                      style={{ fontSize: "0.75rem", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
                      title="Add resource to this group"
                    >
                      <Plus size={13} />
                      <span>Add Res</span>
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => requestDeleteRg(rg.id, evalRg.evaluatedName, resCount)}
                      style={{ fontSize: "0.75rem", padding: "4px 8px", color: "var(--accent-rose)" }}
                      title="Delete Resource Group (with confirmation)"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Collapsible RG Resources Content */}
                {isExpanded && (
                  <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* RG Purpose and Settings Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 12px",
                        background: "rgba(0, 0, 0, 0.2)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.8rem",
                        flexWrap: "wrap"
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>Configure RG:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>Purpose Token:</span>
                        <AuSelect
                          id={`rg-purpose-${rg.id}`}
                          name={`rg_purpose_${rg.id}`}
                          ariaLabel={`Purpose token for resource group ${rg.name || rg.purpose}`}
                          className="au-select-compact"
                          style={{ width: "130px" }}
                          value={rg.purpose || "core"}
                          onChange={(val) => handleUpdateRg(rg.id, { purpose: val })}
                          options={(customer.purposes || ["hub", "core", "monitoring", "infrafw", "apps"]).map((p) => ({
                            value: p,
                            label: p
                          }))}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>Region:</span>
                        <AuSelect
                          id={`rg-region-${rg.id}`}
                          name={`rg_region_${rg.id}`}
                          ariaLabel={`Region for resource group ${rg.name || rg.purpose}`}
                          className="au-select-compact"
                          style={{ minWidth: "160px" }}
                          value={rg.location || activeSub.location || "canadacentral"}
                          onChange={(val) => handleUpdateRg(rg.id, { location: val })}
                          options={customer.regions ? (
                            Object.entries(customer.regions).map(([regKey, code]) => ({
                              value: regKey,
                              label: `${regKey} (${code})`
                            }))
                          ) : [
                            { value: "canadacentral", label: "canadacentral (cc)" }
                          ]}
                        />
                      </div>
                    </div>

                    {/* Inline RG Tag Override Matrix */}
                    {isRgTagEditorOpen && (
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "rgba(139, 92, 246, 0.08)",
                          border: "1px solid rgba(139, 92, 246, 0.3)",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "#c4b5fd", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Sliders size={13} />
                            <span>Resource Group Tag Overrides (Cascades to all resources in this RG)</span>
                          </span>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleTagEditor(rg.id)}
                            style={{ padding: "1px 6px", fontSize: "0.7rem" }}
                          >
                            <X size={12} />
                          </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
                          {applicableRgTagKeys.map((tagKey) => {
                            const currentVal = rg.tags?.[tagKey] || "";
                            const inheritedVal = evalRg.tags[tagKey] || "";
                            const def = allTagDefinitions[tagKey];
                            const allowed = def?.allowedValues || [];

                            return (
                              <div
                                key={tagKey}
                                style={{
                                  background: "rgba(0, 0, 0, 0.3)",
                                  padding: "6px 10px",
                                  borderRadius: "var(--radius-sm)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px"
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "600" }}>{tagKey}</span>
                                  {currentVal ? (
                                    <span className="chip chip-purple" style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                                      Overridden
                                    </span>
                                  ) : (
                                    <span className="chip" style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                                      Inherited
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <AuSelect
                                      id={`rg-tag-override-${rg.id}-${tagKey}`}
                                      name={`rg_tag_override_${rg.id}_${tagKey}`}
                                      ariaLabel={`Override tag ${tagKey} for resource group ${rg.name}`}
                                      className="au-select-compact"
                                      value={currentVal}
                                      onChange={(val) => handleSetRgTagOverride(rg.id, tagKey, val)}
                                      options={[
                                        { value: "", label: `(Inherit: ${inheritedVal || "NA"})`, badge: "Inherit" },
                                        ...allowed.map((val) => ({ value: val, label: val }))
                                      ]}
                                    />
                                  </div>
                                  {currentVal && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleSetRgTagOverride(rg.id, tagKey, "")}
                                      style={{ padding: "4px 6px", fontSize: "0.7rem", flexShrink: 0 }}
                                      title="Reset to Inherited"
                                    >
                                      <RotateCcw size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Resources List Inside RG */}
                    {(rg.resources || []).length === 0 ? (
                      <div
                        style={{
                          padding: "24px",
                          textAlign: "center",
                          color: "var(--text-dim)",
                          background: "rgba(0, 0, 0, 0.1)",
                          borderRadius: "var(--radius-sm)"
                        }}
                      >
                        No resources configured in this Resource Group. Click "+ Add Resource" above.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {(rg.resources || []).map((resource) => {
                          const evalRes = evaluateResourceNode(customer, catalog, activeSub, rg, resource);
                          const isDuplicateRes = (rg.resources || []).some(
                            (other) => other.id !== resource.id && evaluateResourceNode(customer, catalog, activeSub, rg, other).evaluatedName.toLowerCase() === evalRes.evaluatedName.toLowerCase()
                          );
                          const isSelected = selectedResId === resource.id;
                          const isResTagEditorOpen = expandedTagEditors[resource.id] ?? false;
                          const hasResOverrides = resource.tags && Object.keys(resource.tags).length > 0;

                          return (
                            <div
                              key={resource.id}
                              style={{
                                padding: "12px 14px",
                                background: isDuplicateRes ? "rgba(244, 63, 94, 0.05)" : isSelected ? "rgba(6, 182, 212, 0.08)" : "rgba(17, 24, 39, 0.6)",
                                border: isDuplicateRes ? "1px solid var(--accent-rose)" : isSelected ? "1px solid var(--azure-cyan)" : "1px solid var(--border-subtle)",
                                borderRadius: "var(--radius-sm)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                transition: "all 0.15s ease"
                              }}
                              onClick={() => setSelectedResId(resource.id)}
                            >
                              {/* Row 1: Resource Type, Instance, Purpose, Actions */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "10px"
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                  {/* Resource Type Dropdown */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Type:</span>
                                    <AuSelect
                                      id={`res-type-${resource.id}`}
                                      name={`res_type_${resource.id}`}
                                      ariaLabel={`Select resource type for ${resource.name || "resource"}`}
                                      className="au-select-compact"
                                      searchable={true}
                                      style={{ minWidth: "220px", maxWidth: "280px" }}
                                      value={resource.resourceTypeKey}
                                      onChange={(newKey) => {
                                        const updates = { resourceTypeKey: newKey };
                                        if (newKey === "vm" && !resource.osType) {
                                          updates.osType = "Windows";
                                        }
                                        handleUpdateResource(rg.id, resource.id, updates);
                                      }}
                                      options={catalog.map((catItem) => ({
                                        value: catItem.key || catItem.abbreviation,
                                        label: `${catItem.name} (${catItem.abbreviation || catItem.key})`,
                                        badge: catItem.abbreviation || catItem.key
                                      }))}
                                    />
                                  </div>

                                  {/* Purpose Override */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <label htmlFor={`res-purpose-${resource.id}`} style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Role/Purpose:</label>
                                    <input
                                      id={`res-purpose-${resource.id}`}
                                      name={`res_purpose_${resource.id}`}
                                      aria-label={`Role purpose for ${resource.name || "resource"}`}
                                      type="text"
                                      className="form-input form-input-mono"
                                      value={resource.purpose || rg.purpose || "core"}
                                      onChange={(e) =>
                                        handleUpdateResource(rg.id, resource.id, {
                                          purpose: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                                        })
                                      }
                                      style={{ width: "95px", padding: "4px 8px", fontSize: "0.8rem" }}
                                    />
                                  </div>

                                  {/* Instance Number */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <label htmlFor={`res-instance-${resource.id}`} style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Instance:</label>
                                    <input
                                      id={`res-instance-${resource.id}`}
                                      name={`res_instance_${resource.id}`}
                                      aria-label={`Instance number for ${resource.name || "resource"}`}
                                      type="text"
                                      className="form-input form-input-mono"
                                      value={resource.instance || "01"}
                                      onChange={(e) =>
                                        handleUpdateResource(rg.id, resource.id, {
                                          instance: e.target.value.replace(/[^0-9]/g, "").slice(0, 2)
                                        })
                                      }
                                      style={{ width: "50px", padding: "4px 8px", fontSize: "0.8rem", textAlign: "center" }}
                                    />
                                  </div>

                                  {/* OS Type Selector (Only for VM) */}
                                  {(resource.resourceTypeKey === "vm" || evalRes.resourceMeta.resourceType?.toLowerCase().includes("virtualmachines")) && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>OS:</span>
                                      <AuSelect
                                        id={`res-os-${resource.id}`}
                                        name={`res_os_${resource.id}`}
                                        ariaLabel={`Select OS type for VM ${resource.id}`}
                                        className="au-select-compact"
                                        style={{ width: "165px" }}
                                        value={resource.osType || "Windows"}
                                        onChange={(val) =>
                                          handleUpdateResource(rg.id, resource.id, {
                                            osType: val
                                          })
                                        }
                                        options={[
                                          { value: "Windows", label: "🪟 Windows (15 max)" },
                                          { value: "Linux", label: "🐧 Linux (64 max)" }
                                        ]}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Resource Actions: Tag Override Toggle & Delete */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    className={`btn btn-sm ${hasResOverrides ? "btn-primary" : "btn-secondary"}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTagEditor(resource.id);
                                    }}
                                    style={{ padding: "4px 8px", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "4px" }}
                                    title="Override tags for this resource"
                                  >
                                    <Sliders size={12} />
                                    <span>{hasResOverrides ? "Tags Overridden" : "Override Tags"}</span>
                                  </button>

                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteResource(rg.id, resource.id);
                                    }}
                                    style={{ padding: "4px 8px", color: "var(--accent-rose)" }}
                                    title="Remove resource"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Row 2: Real-time Evaluation (Naming & Governance Tags) */}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1.3fr 1.7fr",
                                  gap: "12px",
                                  padding: "8px 12px",
                                  background: "rgba(0, 0, 0, 0.25)",
                                  borderRadius: "var(--radius-sm)",
                                  alignItems: "center"
                                }}
                              >
                                {/* Canonical Resource Name */}
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                      Canonical Resource Name
                                    </span>
                                    {isDuplicateRes ? (
                                      <span
                                        className="chip"
                                        style={{ fontSize: "0.68rem", padding: "1px 6px", background: "rgba(244, 63, 94, 0.15)", color: "var(--accent-rose)", borderColor: "rgba(244, 63, 94, 0.4)" }}
                                        title="Another resource in this Resource Group has the same evaluated name"
                                      >
                                        <AlertTriangle size={11} />
                                        <span>Already Exists in RG</span>
                                      </span>
                                    ) : evalRes.validation.valid ? (
                                      <span className="chip chip-emerald" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                        <CheckCircle2 size={11} />
                                        <span>
                                          Compliant ({evalRes.evaluatedName.length}/{evalRes.validation.maxLength || (evalRes.osType === "Windows" ? 15 : (evalRes.resourceMeta.maxLength || 64))})
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="chip chip-amber" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                        <AlertTriangle size={11} />
                                        <span>
                                          Constraint Violation ({evalRes.evaluatedName.length}/{evalRes.validation.maxLength || (evalRes.osType === "Windows" ? 15 : (evalRes.resourceMeta.maxLength || 64))})
                                        </span>
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "0.85rem",
                                      fontWeight: "600",
                                      color: isDuplicateRes ? "var(--accent-rose)" : evalRes.validation.valid ? "#38bdf8" : "#f59e0b",
                                      wordBreak: "break-all"
                                    }}
                                  >
                                    {evalRes.evaluatedName}
                                  </div>

                                  {/* Duplicate Warning if duplicate */}
                                  {isDuplicateRes && (
                                    <div style={{ fontSize: "0.7rem", color: "var(--accent-rose)", marginTop: "3px", fontWeight: "600" }}>
                                      ⚠️ Duplicate Name: Name already exists in this Resource Group.
                                    </div>
                                  )}

                                  {/* Error/Warning Explanation if any */}
                                  {!isDuplicateRes && !evalRes.validation.valid && evalRes.validation.errors?.length > 0 && (
                                    <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: "3px" }}>
                                      {evalRes.validation.errors[0]}
                                    </div>
                                  )}
                                </div>

                                {/* Effective Governance Tags */}
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                      Effective Governance Tags ({Object.keys(evalRes.tags).length})
                                    </span>
                                    <span style={{ fontSize: "0.68rem", color: "var(--azure-cyan)" }}>
                                      Subscription + RG + Resource + NA Default
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                    {Object.entries(evalRes.tagOrigins || {}).map(([key, orig]) => {
                                      const isSub = orig.source === "subscription";
                                      const isSubOverride = orig.source === "subscription-override";
                                      const isRg = orig.source === "resourceGroup";
                                      const isRgOverride = orig.source === "rg-override";
                                      const isResOverride = orig.source === "resource-override";
                                      const isNa = orig.source === "default-na";

                                      const chipStyle = isResOverride
                                        ? { background: "rgba(245, 158, 11, 0.25)", color: "#fde68a", borderColor: "rgba(245, 158, 11, 0.5)" }
                                        : isRgOverride
                                        ? { background: "rgba(168, 85, 247, 0.25)", color: "#e9d5ff", borderColor: "rgba(168, 85, 247, 0.5)" }
                                        : isSubOverride || isSub
                                        ? { background: "rgba(0, 120, 212, 0.2)", color: "#7dd3fc", borderColor: "rgba(0, 120, 212, 0.4)" }
                                        : isRg
                                        ? { background: "rgba(139, 92, 246, 0.2)", color: "#c4b5fd", borderColor: "rgba(139, 92, 246, 0.4)" }
                                        : isNa
                                        ? { background: "rgba(100, 116, 139, 0.2)", color: "#94a3b8", borderColor: "rgba(100, 116, 139, 0.4)" }
                                        : { background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", borderColor: "rgba(16, 185, 129, 0.4)" };

                                      const prefix = isResOverride
                                        ? "Override"
                                        : isRgOverride
                                        ? "RG-Override"
                                        : isSubOverride || isSub
                                        ? "Sub"
                                        : isRg
                                        ? "RG"
                                        : isNa
                                        ? "Default"
                                        : "Res";

                                      return (
                                        <span
                                          key={key}
                                          className="chip"
                                          style={{ ...chipStyle, fontSize: "0.68rem", padding: "1px 6px" }}
                                          title={`Tag [${key} = ${orig.value}] - Source: ${orig.source}`}
                                        >
                                          <strong>[{prefix}]</strong> {key}: {orig.value}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* Inline Resource Tag Override Matrix */}
                              {isResTagEditorOpen && (
                                <div
                                  style={{
                                    padding: "12px 14px",
                                    background: "rgba(6, 182, 212, 0.06)",
                                    border: "1px solid rgba(6, 182, 212, 0.3)",
                                    borderRadius: "var(--radius-sm)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px"
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "#38bdf8", display: "flex", alignItems: "center", gap: "6px" }}>
                                      <Sliders size={13} />
                                      <span>Override Resource Tags (Pick from allowed values or revert to inherit)</span>
                                    </span>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => toggleTagEditor(resource.id)}
                                      style={{ padding: "1px 6px", fontSize: "0.7rem" }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>

                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "8px" }}>
                                    {applicableResTagKeys.map((tagKey) => {
                                      const currentVal = resource.tags?.[tagKey] || "";
                                      const effectiveVal = evalRes.tags[tagKey] || "";
                                      const def = allTagDefinitions[tagKey];
                                      const allowed = def?.allowedValues || [];

                                      return (
                                        <div
                                          key={tagKey}
                                          style={{
                                            background: "rgba(0, 0, 0, 0.3)",
                                            padding: "6px 10px",
                                            borderRadius: "var(--radius-sm)",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "4px"
                                          }}
                                        >
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "600" }}>{tagKey}</span>
                                            {currentVal ? (
                                              <span className="chip chip-amber" style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                                                Overridden
                                              </span>
                                            ) : (
                                              <span className="chip" style={{ fontSize: "0.65rem", padding: "1px 5px" }}>
                                                Inherited
                                              </span>
                                            )}
                                          </div>

                                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <AuSelect
                                                id={`res-tag-override-${resource.id}-${tagKey}`}
                                                name={`res_tag_override_${resource.id}_${tagKey}`}
                                                ariaLabel={`Override tag ${tagKey} for resource ${resource.name || "resource"}`}
                                                className="au-select-compact"
                                                value={currentVal}
                                                onChange={(val) =>
                                                  handleSetResourceTagOverride(rg.id, resource.id, tagKey, val)
                                                }
                                                options={[
                                                  { value: "", label: `(Inherit: ${effectiveVal || "NA"})`, badge: "Inherit" },
                                                  ...allowed.map((val) => ({ value: val, label: val }))
                                                ]}
                                              />
                                            </div>
                                            {currentVal && (
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() =>
                                                  handleSetResourceTagOverride(rg.id, resource.id, tagKey, "")
                                                }
                                                style={{ padding: "4px 6px", fontSize: "0.7rem", flexShrink: 0 }}
                                                title="Reset to Inherited"
                                              >
                                                <RotateCcw size={11} />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Code Drawer / Split-Pane Preview */}
        {codeDrawerOpen && (
          <div
            className="au-hud-card"
            style={{
              position: "sticky",
              top: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              padding: "16px",
              maxHeight: "88vh",
              overflow: "hidden"
            }}
          >
            {/* Header & Tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <AuButton
                  variant={codeTab === "bicepparam" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setCodeTab("bicepparam")}
                  icon={<FileCode size={13} />}
                >
                  .bicepparam
                </AuButton>
                <AuButton
                  variant={codeTab === "armparam" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setCodeTab("armparam")}
                  icon={<FileCode size={13} />}
                >
                  parameters.json
                </AuButton>
                <AuButton
                  variant={codeTab === "bicepmodule" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setCodeTab("bicepmodule")}
                  icon={<FileCode size={13} />}
                >
                  resources.bicep
                </AuButton>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <AuButton
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadSingle}
                  title="Download File"
                  icon={<Download size={13} />}
                >
                  Download
                </AuButton>
              </div>
            </div>

            {/* Code Box with Syntax Highlighting and Gutter */}
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "calc(88vh - 120px)" }}>
              <AuCodeViewer
                code={currentCodeContent}
                language={codeTab === "armparam" ? "json" : "bicep"}
                filename={currentCodeFilename}
                showLineNumbers={true}
                onCopy={() => onShowToast(`Copied ${currentCodeFilename} to clipboard!`)}
              />
            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "480px", borderLeft: "4px solid var(--accent-rose)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle size={22} color="var(--accent-rose)" />
                <h3 id="delete-modal-title" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                  Confirm Deletion
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteModal(null)} style={{ padding: "4px 8px" }}>
                <X size={14} />
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-main)" }}>
                Are you sure you want to delete{" "}
                <strong style={{ color: "var(--azure-cyan)" }}>{deleteModal.name}</strong>?
              </p>

              <div
                style={{
                  background: "var(--status-danger-bg)",
                  border: "1px solid var(--status-danger-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  fontSize: "0.85rem",
                  color: "var(--status-danger-text)"
                }}
              >
                {deleteModal.type === "sub" ? (
                  <span>
                    ⚠️ This action will permanently remove this subscription, along with all{" "}
                    <strong>{deleteModal.rgCount} Resource Groups</strong> and{" "}
                    <strong>{deleteModal.resCount} resources</strong> inside it.
                  </span>
                ) : (
                  <span>
                    ⚠️ This action will permanently remove this Resource Group and all{" "}
                    <strong>{deleteModal.resCount} resources</strong> configured inside it.
                  </span>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-sm"
                onClick={executeConfirmDelete}
                style={{ background: "var(--accent-rose)", color: "#fff", border: "none" }}
              >
                Yes, Delete {deleteModal.type === "sub" ? "Subscription" : "Resource Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Confirmation Modal */}
      {presetModal && (
        <div className="modal-overlay" onClick={() => setPresetModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "500px", borderLeft: "4px solid var(--azure-cyan)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Zap size={22} color="var(--azure-cyan)" />
                <h3 id="preset-modal-title" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                  {presetModal === "airgate" ? "Load AirGate Default Platform" : "Reset to Profile Baseline"}
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setPresetModal(null)} style={{ padding: "4px 8px" }}>
                <X size={14} />
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {presetModal === "airgate" ? (
                <div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "var(--text-main)" }}>
                    Load the official <strong>AirGate Standard Platform Landing Zone</strong> architecture?
                  </p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    This will populate 5 core subscriptions:
                  </p>
                  <ul style={{ margin: "8px 0 0 20px", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                    <li><strong>Connectivity (CON)</strong>: Hub VNet, Firewall, Bastion, Gateway, Private DNS</li>
                    <li><strong>Identity (IDN)</strong>: Active Directory Domain Controllers, Key Vault</li>
                    <li><strong>Management (MGT)</strong>: Log Analytics Workspace, Automation Account, Recovery Vault</li>
                    <li><strong>Security (SEC)</strong>: Central Key Vault, Audit Log Storage Account</li>
                    <li><strong>Workload-Apps (APP)</strong>: App Service, Azure SQL, Core Storage</li>
                  </ul>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-main)" }}>
                  Reset the current topology to the customer's default profile baseline? Any custom subscriptions and groups will be reverted.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setPresetModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleApplyPreset(presetModal)}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Check size={14} />
                <span>Confirm & Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal (Add / Edit) */}
      {subModal && (() => {
        const isEdit = subModal.mode === "edit";
        const validation = validateSubscriptionInput(
          subModal,
          topology.subscriptions,
          isEdit ? activeSub.id : null
        );

        return (
          <div className="modal-overlay" onClick={() => setSubModal(null)}>
            <div
              className="modal-card"
              style={{ maxWidth: "540px", borderLeft: "4px solid var(--azure-cyan)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="sub-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Globe size={22} color="var(--azure-cyan)" />
                  <div>
                    <h3 id="sub-modal-title" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                      {isEdit ? "Edit Subscription" : "Add Subscription to Topology"}
                    </h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Configure subscription scope, token code, and Azure deployment tier.
                    </span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setSubModal(null)} style={{ padding: "4px 8px" }}>
                  <X size={14} />
                </button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Subscription Name */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="sub-modal-name" style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)" }}>
                    Subscription Name:
                  </label>
                  <input
                    id="sub-modal-name"
                    name="sub_modal_name"
                    aria-label="Subscription Name"
                    type="text"
                    className="form-input form-input-mono"
                    placeholder="e.g. Workload-Analytics, SharedServices"
                    value={subModal.name}
                    onChange={(e) => setSubModal({ ...subModal, name: e.target.value })}
                    style={{ fontSize: "0.85rem", padding: "6px 10px" }}
                  />
                  <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                    1–64 characters (alphanumerics, spaces, hyphens, underscores, periods).
                  </span>
                </div>

                {/* Subscription Code & Environment */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="sub-modal-code" style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)" }}>
                      Subscription Code ({"{SUB}"}):
                    </label>
                    <input
                      id="sub-modal-code"
                      name="sub_modal_code"
                      aria-label="Subscription Code"
                      type="text"
                      className="form-input form-input-mono"
                      placeholder="e.g. WL, APP, SHD"
                      value={subModal.code}
                      onChange={(e) => setSubModal({ ...subModal, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })}
                      style={{ fontSize: "0.85rem", padding: "6px 10px", fontFamily: "var(--font-mono)" }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                      2–10 uppercase chars, resolves in naming tokens.
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <AuSelect
                      label="Environment Tier:"
                      value={subModal.environment}
                      onChange={(val) => setSubModal({ ...subModal, environment: val })}
                      options={[
                        { value: "prod", label: "Production (prod)" },
                        { value: "nonprod", label: "Non-Production (nonprod)" },
                        { value: "dev", label: "Development (dev)" },
                        { value: "stage", label: "Staging (stage)" },
                        { value: "test", label: "Testing (test)" }
                      ]}
                    />
                  </div>
                </div>

                {/* Location / Region */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <AuSelect
                    label="Default Deployment Region:"
                    value={subModal.location}
                    onChange={(val) => setSubModal({ ...subModal, location: val })}
                    options={customer.regions ? (
                      Object.entries(customer.regions).map(([regKey, code]) => ({
                        value: regKey,
                        label: `${regKey} (${code})`
                      }))
                    ) : (
                      [{ value: "canadacentral", label: "canadacentral (cc)" }]
                    )}
                  />
                </div>


                {/* Real-time Preview & Validation Card */}
                <div
                  style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase" }}>
                      Preview Subscription Tab
                    </span>
                    <span className="chip chip-azure" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                      <Globe size={11} />
                      <span>{subModal.name || "Untitled"} ({subModal.code || "---"})</span>
                      <span style={{ opacity: 0.8 }}>[{subModal.environment}]</span>
                    </span>
                  </div>

                  {/* Duplicate or Constraint Alert */}
                  {validation.isDuplicate ? (
                    <div
                      style={{
                        background: "var(--status-danger-bg)",
                        border: "1px solid var(--status-danger-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "var(--status-danger-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <AlertTriangle size={15} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
                      <span><strong>Already Exists:</strong> {validation.duplicateError}</span>
                    </div>
                  ) : !validation.valid && validation.errors.length > 0 ? (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "#fde68a",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <span>{validation.errors[0]}</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "#6ee7b7",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <CheckCircle2 size={15} color="var(--status-success)" style={{ flexShrink: 0 }} />
                      <span>Subscription name and code are compliant & available in this topology.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setSubModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveSubscription}
                  disabled={!validation.valid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: validation.valid ? 1 : 0.5,
                    cursor: validation.valid ? "pointer" : "not-allowed"
                  }}
                >
                  <Check size={14} />
                  <span>{isEdit ? "Save Changes" : "Create Subscription"}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Resource Group Modal (Add) */}
      {rgModal && (() => {
        const effectivePurpose = rgModal.purpose === "__custom__" ? rgModal.customPurpose.trim().toLowerCase() : rgModal.purpose;
        const validation = validateResourceGroupInput(
          { purpose: effectivePurpose, name: rgModal.nameOverride, location: rgModal.location },
          activeSub,
          customer,
          catalog
        );

        const standardPurposes = customer.purposes && customer.purposes.length > 0
          ? customer.purposes
          : ["apps", "data", "services", "monitoring", "identity", "security", "ai", "hub", "core"];

        return (
          <div className="modal-overlay" onClick={() => setRgModal(null)}>
            <div
              className="modal-card"
              style={{ maxWidth: "560px", borderLeft: "4px solid var(--azure-cyan)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rg-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Layers size={22} color="var(--azure-cyan)" />
                  <div>
                    <h3 id="rg-modal-title" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                      Add Resource Group to {activeSub.name}
                    </h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Configure purpose token or custom name with live Azure ARM constraint verification.
                    </span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setRgModal(null)} style={{ padding: "4px 8px" }}>
                  <X size={14} />
                </button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Purpose Token */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <AuSelect
                    label="Resource Group Purpose Token:"
                    value={rgModal.purpose}
                    onChange={(val) => setRgModal({ ...rgModal, purpose: val })}
                    options={[
                      ...standardPurposes.map((p) => ({ value: p, label: p })),
                      { value: "__custom__", label: "✨ Custom Purpose...", badge: "Custom" }
                    ]}
                  />
                </div>

                {/* Custom Purpose Input if selected */}
                {rgModal.purpose === "__custom__" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="rg-modal-custom-purpose" style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)" }}>
                      Custom Purpose Name:
                    </label>
                    <input
                      id="rg-modal-custom-purpose"
                      name="rg_custom_purpose"
                      aria-label="Custom Purpose Name"
                      type="text"
                      className="form-input form-input-mono"
                      placeholder="e.g. analytics, batch, telemetry"
                      value={rgModal.customPurpose}
                      onChange={(e) =>
                        setRgModal({
                          ...rgModal,
                          customPurpose: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                        })
                      }
                      style={{ fontSize: "0.85rem", padding: "6px 10px" }}
                    />
                  </div>
                )}

                {/* Optional Name Override & Region */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <AuSelect
                      label="Region:"
                      value={rgModal.location}
                      onChange={(val) => setRgModal({ ...rgModal, location: val })}
                      options={customer.regions ? (
                        Object.entries(customer.regions).map(([regKey, code]) => ({
                          value: regKey,
                          label: `${regKey} (${code})`
                        }))
                      ) : (
                        [{ value: "canadacentral", label: "canadacentral (cc)" }]
                      )}
                    />
                  </div>

                  <div>
                    <AuSelect
                      label="Initial Resource:"
                      value={rgModal.initialResourceType}
                      onChange={(val) => setRgModal({ ...rgModal, initialResourceType: val })}
                      options={[
                        { value: "vnet", label: "Virtual Network (vnet)" },
                        { value: "storage", label: "Storage Account (storage)" },
                        { value: "vm", label: "Virtual Machine (vm)" },
                        { value: "kv", label: "Key Vault (kv)" },
                        { value: "none", label: "None (Empty Resource Group)" }
                      ]}
                    />
                  </div>
                </div>


                {/* Optional Custom Name Override */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="rg-modal-name-override" style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-muted)" }}>
                    Custom Name Override (Optional):
                  </label>
                  <input
                    id="rg-modal-name-override"
                    name="rg_name_override"
                    aria-label="Custom Name Override"
                    type="text"
                    className="form-input form-input-mono"
                    placeholder="Leave blank to use naming rule pattern ({Org}-{SUB}-{ResourceGroup}-rg)"
                    value={rgModal.nameOverride}
                    onChange={(e) => setRgModal({ ...rgModal, nameOverride: e.target.value })}
                    style={{ fontSize: "0.85rem", padding: "6px 10px", fontFamily: "var(--font-mono)" }}
                  />
                </div>

                {/* Real-time Canonical RG Name Evaluation Card */}
                <div
                  style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase" }}>
                      Canonical Evaluated Resource Group Name
                    </span>
                    <span className={`chip ${validation.valid ? "chip-emerald" : "chip-amber"}`} style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                      {validation.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      <span>{validation.valid ? "Compliant" : "Violation"} ({validation.evaluatedName.length}/90 chars)</span>
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "1rem",
                      fontWeight: "700",
                      color: validation.isDuplicate ? "var(--accent-rose)" : validation.valid ? "#38bdf8" : "#f59e0b",
                      wordBreak: "break-all"
                    }}
                  >
                    {validation.evaluatedName}
                  </div>

                  {/* Duplicate or Constraint Alert */}
                  {validation.isDuplicate ? (
                    <div
                      style={{
                        background: "var(--status-danger-bg)",
                        border: "1px solid var(--status-danger-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "var(--status-danger-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <AlertTriangle size={15} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
                      <span><strong>Already Exists:</strong> {validation.duplicateError}</span>
                    </div>
                  ) : !validation.valid && validation.errors.length > 0 ? (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "#fde68a",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <span>{validation.errors[0]}</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "#6ee7b7",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <CheckCircle2 size={15} color="var(--status-success)" style={{ flexShrink: 0 }} />
                      <span>Resource Group name is compliant & unique in this subscription.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setRgModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveRg}
                  disabled={!validation.valid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: validation.valid ? 1 : 0.5,
                    cursor: validation.valid ? "pointer" : "not-allowed"
                  }}
                >
                  <Check size={14} />
                  <span>Add Resource Group</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Resource Modal (Add) */}
      {resModal && (() => {
        const targetRg = resourceGroups.find((r) => r.id === resModal.rgId);
        const validation = validateResourceInput(
          {
            resourceTypeKey: resModal.resourceTypeKey,
            purpose: resModal.purpose,
            instance: resModal.instance,
            osType: resModal.osType
          },
          targetRg,
          activeSub,
          customer,
          catalog
        );

        const filteredCatalog = catalog.filter((c) => {
          if (!resModal.searchQuery) return true;
          const q = resModal.searchQuery.toLowerCase();
          return (
            (c.name || "").toLowerCase().includes(q) ||
            (c.key || "").toLowerCase().includes(q) ||
            (c.abbreviation || "").toLowerCase().includes(q) ||
            (c.resourceType || "").toLowerCase().includes(q)
          );
        });

        const isVm = resModal.resourceTypeKey === "vm" || validation.resourceMeta?.resourceType?.toLowerCase().includes("virtualmachines");

        return (
          <div className="modal-overlay" onClick={() => setResModal(null)}>
            <div
              className="modal-card"
              style={{ maxWidth: "600px", borderLeft: "4px solid var(--azure-cyan)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="res-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Sparkles size={22} color="var(--azure-cyan)" />
                  <div>
                    <h3 id="res-modal-title" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                      Add Resource to {targetRg?.purpose || "Resource Group"}
                    </h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Pick from 200+ Azure types with auto-suggested non-conflicting instances and real-time validation.
                    </span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setResModal(null)} style={{ padding: "4px 8px" }}>
                  <X size={14} />
                </button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Resource Type Search & Dropdown */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)" }}>
                      Azure Resource Type:
                    </label>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      {catalog.length} catalog types available
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-dim)" }} />
                      <input
                        id="res-modal-search"
                        name="res_modal_search"
                        aria-label="Filter resource catalog types by name, abbr, or provider"
                        type="text"
                        className="form-input form-input-mono"
                        placeholder="Filter types by name, abbr, or provider..."
                        value={resModal.searchQuery || ""}
                        onChange={(e) => setResModal({ ...resModal, searchQuery: e.target.value })}
                        style={{ paddingLeft: "30px", fontSize: "0.8rem", width: "100%" }}
                      />
                    </div>

                    <AuSelect
                      searchable={true}
                      value={resModal.resourceTypeKey}
                      onChange={(newKey) => {
                        const nextInst = getNextAvailableInstance(targetRg, newKey, resModal.purpose);
                        setResModal({
                          ...resModal,
                          resourceTypeKey: newKey,
                          instance: nextInst,
                          osType: newKey === "vm" ? "Windows" : resModal.osType
                        });
                      }}
                      options={filteredCatalog.map((catItem) => ({
                        value: catItem.key || catItem.abbreviation,
                        label: catItem.name,
                        badge: catItem.abbreviation || catItem.key
                      }))}
                      style={{ maxWidth: "280px" }}
                    />
                  </div>
                </div>


                {/* Role / Purpose & Instance Number */}
                <div style={{ display: "grid", gridTemplateColumns: isVm ? "1fr 1fr 1fr" : "1.2fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="res-modal-purpose" style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)" }}>
                      Role / Purpose Token:
                    </label>
                    <input
                      id="res-modal-purpose"
                      name="res_modal_purpose"
                      aria-label="Role or purpose token"
                      type="text"
                      className="form-input form-input-mono"
                      placeholder="e.g. apps, core, db, web"
                      value={resModal.purpose}
                      onChange={(e) => {
                        const newPurp = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
                        const nextInst = getNextAvailableInstance(targetRg, resModal.resourceTypeKey, newPurp);
                        setResModal({ ...resModal, purpose: newPurp, instance: nextInst });
                      }}
                      style={{ fontSize: "0.85rem", padding: "6px 10px" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label htmlFor="res-modal-instance" style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)" }}>
                        Instance:
                      </label>
                      {validation.isDuplicate && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setResModal({ ...resModal, instance: validation.nextSuggestedInstance })}
                          style={{ fontSize: "0.68rem", padding: "1px 6px", color: "var(--azure-cyan)" }}
                          title="Switch to next available instance"
                        >
                          Auto-Fill {validation.nextSuggestedInstance}
                        </button>
                      )}
                    </div>
                    <input
                      id="res-modal-instance"
                      name="res_modal_instance"
                      aria-label="Instance number"
                      type="text"
                      className="form-input form-input-mono"
                      value={resModal.instance}
                      onChange={(e) =>
                        setResModal({
                          ...resModal,
                          instance: e.target.value.replace(/[^0-9]/g, "").slice(0, 2)
                        })
                      }
                      style={{ fontSize: "0.85rem", padding: "6px 10px", textAlign: "center", fontFamily: "var(--font-mono)" }}
                    />
                  </div>

                  {isVm && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <AuSelect
                        label="OS Type:"
                        value={resModal.osType || "Windows"}
                        onChange={(val) => setResModal({ ...resModal, osType: val })}
                        options={[
                          { value: "Windows", label: "Windows (15 max)", badge: "🪟 Win" },
                          { value: "Linux", label: "Linux (64 max)", badge: "🐧 Lnx" }
                        ]}
                      />
                    </div>

                  )}
                </div>

                {/* Real-time Canonical Name Preview Card */}
                <div
                  style={{
                    padding: "12px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase" }}>
                      Canonical Evaluated Resource Name
                    </span>
                    <span className={`chip ${validation.valid ? "chip-emerald" : "chip-amber"}`} style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                      {validation.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      <span>
                        {validation.valid ? "Compliant" : "Violation"} ({validation.evaluatedName.length}/{validation.validation.maxLength || (isVm && resModal.osType === "Windows" ? 15 : 64)} chars)
                      </span>
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "1rem",
                      fontWeight: "700",
                      color: validation.isDuplicate ? "var(--accent-rose)" : validation.valid ? "#38bdf8" : "#f59e0b",
                      wordBreak: "break-all"
                    }}
                  >
                    {validation.evaluatedName}
                  </div>

                  {/* Duplicate or Constraint Alert */}
                  {validation.isDuplicate ? (
                    <div
                      style={{
                        background: "var(--status-danger-bg)",
                        border: "1px solid var(--status-danger-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "var(--status-danger-text)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <AlertTriangle size={15} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
                        <span><strong>Already Exists:</strong> {validation.duplicateError}</span>
                      </div>
                      {validation.nextSuggestedInstance && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setResModal({ ...resModal, instance: validation.nextSuggestedInstance })}
                          style={{ fontSize: "0.72rem", padding: "2px 8px", background: "rgba(255,255,255,0.15)", color: "#fff" }}
                        >
                          Use Next Instance ({validation.nextSuggestedInstance})
                        </button>
                      )}
                    </div>
                  ) : !validation.valid && validation.errors.length > 0 ? (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "#fde68a",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <span>{validation.errors[0]}</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "#6ee7b7",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <CheckCircle2 size={15} color="var(--status-success)" style={{ flexShrink: 0 }} />
                      <span>Resource name is compliant with Azure constraints & unique in this scope.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setResModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveResource}
                  disabled={!validation.valid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: validation.valid ? 1 : 0.5,
                    cursor: validation.valid ? "pointer" : "not-allowed"
                  }}
                >
                  <Check size={14} />
                  <span>Add Resource</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
