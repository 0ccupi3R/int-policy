import React, { useState, useMemo, useEffect } from "react";
import {
  evaluateResourceNode,
  evaluateRgNode,
  generateBicepParameters,
  generateArmParameters,
  generateCompanionResourcesBicep,
  getBaselineTopology,
  getAirGateDefaultPlatformTopology
} from "../engine/topologyGenerator.js";
import { toTitleCase } from "../engine/tokenParser.js";
import {
  Layers,
  Server,
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
  Sparkles,
  Database,
  Shield,
  Cpu,
  Globe,
  FolderTree,
  FileCode,
  Info,
  Sliders,
  RotateCcw,
  Zap,
  X,
  Check
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
    } catch (e) {}
    return 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`alz_topology_sub_idx_${customer.id}`, activeSubIndex.toString());
    } catch (e) {}
  }, [activeSubIndex, customer.id]);

  const [selectedResId, setSelectedResId] = useState(null);
  const [expandedRgs, setExpandedRgs] = useState({ "rg-hub": true, "rg-core": true, "rg-apps": true });
  const [expandedTagEditors, setExpandedTagEditors] = useState({}); // { [id]: boolean }
  const [codeDrawerOpen, setCodeDrawerOpen] = useState(false);
  const [codeTab, setCodeTab] = useState("bicepparam"); // "bicepparam" | "armparam" | "bicepmodule"
  const [copied, setCopied] = useState(false);

  // Deletion Confirmation Modal state: { type: "sub"|"rg", id, name, subIndex, rgCount, resCount }
  const [deleteModal, setDeleteModal] = useState(null);

  // Preset Confirmation Modal state: "airgate" | "reset" | null
  const [presetModal, setPresetModal] = useState(null);

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

  const toggleTagEditor = (id) => {
    setExpandedTagEditors((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // ----------------------------------------------------------------------------
  // Subscription Handlers
  // ----------------------------------------------------------------------------
  const handleAddSubscription = () => {
    const nextNum = (topology.subscriptions.length + 1).toString().padStart(2, "0");
    const newSub = {
      id: `sub-${Date.now()}`,
      name: `Workload-${nextNum}`,
      code: `WL${nextNum}`,
      environment: customer.environment || "prod",
      location: customer.defaultRegion || "canadacentral",
      resourceGroups: [
        {
          id: `rg-app-${Date.now()}`,
          purpose: "apps",
          name: "",
          location: customer.defaultRegion || "canadacentral",
          resources: [
            { id: `res-vm-${Date.now()}`, resourceTypeKey: "vm", purpose: "apps", instance: "01" },
            { id: `res-sa-${Date.now()}`, resourceTypeKey: "storage", purpose: "apps", instance: "01" }
          ]
        }
      ]
    };

    const newSubs = [...topology.subscriptions, newSub];
    handleUpdateTopology({ ...topology, subscriptions: newSubs });
    setActiveSubIndex(newSubs.length - 1);
    onShowToast(`Created Subscription ${newSub.name} (${newSub.code})!`);
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
  const handleAddRg = () => {
    const defaultPurpose = "apps";
    const newRg = {
      id: `rg-${Date.now()}`,
      purpose: defaultPurpose,
      name: "",
      location: activeSub.location || "canadacentral",
      tags: {},
      resources: [
        { id: `res-${Date.now()}-1`, resourceTypeKey: "vnet", purpose: defaultPurpose, instance: "01" }
      ]
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
    onShowToast(`Added Resource Group (${defaultPurpose})!`);
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
  const handleAddResource = (rgId) => {
    const newRes = {
      id: `res-${Date.now()}`,
      resourceTypeKey: "storage",
      purpose: "core",
      instance: "01",
      tags: {}
    };

    const updatedSubs = topology.subscriptions.map((sub, idx) => {
      if (idx !== safeSubIndex) return sub;
      return {
        ...sub,
        resourceGroups: (sub.resourceGroups || []).map((rg) => {
          if (rg.id !== rgId) return rg;
          return {
            ...rg,
            resources: [...(rg.resources || []), newRes]
          };
        })
      };
    });

    handleUpdateTopology({ ...topology, subscriptions: updatedSubs });
    setSelectedResId(newRes.id);
    onShowToast("Added new resource to Resource Group!");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner & KPI Ribbon */}
      <div
        className="glass-card"
        style={{
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          borderLeft: "4px solid var(--azure-cyan)",
          background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(17, 24, 39, 0.8) 100%)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <FolderTree size={22} color="var(--azure-cyan)" />
            <h2 style={{ fontSize: "1.3rem", fontWeight: "700", fontFamily: "var(--font-display)" }}>
              Resource Topology & Parameter Generator
            </h2>
            <span className="chip chip-azure" style={{ fontSize: "0.75rem" }}>
              1 Bullet, Two Kills
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
            Scaffold your Subscription $\rightarrow$ Resource Group $\rightarrow$ Leaf Resource topology. Generates both
            compliant canonical resource names and complete multi-tier governance tags simultaneously.
          </p>
        </div>

        {/* Action Controls & Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Preset Buttons */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPresetModal("airgate")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(6, 182, 212, 0.15)",
              borderColor: "rgba(6, 182, 212, 0.35)",
              color: "#38bdf8"
            }}
            title="Scaffold standard 5-subscription enterprise architecture"
          >
            <Zap size={14} color="#38bdf8" />
            <span>AirGate Default Platform</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPresetModal("reset")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            title="Reset to customer profile baseline"
          >
            <RotateCcw size={14} />
            <span>Reset Baseline</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCodeDrawerOpen(!codeDrawerOpen)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Code2 size={15} />
            <span>{codeDrawerOpen ? "Hide Live Code" : "Live Bicep & ARM Parameters"}</span>
          </button>
        </div>
      </div>

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
              onClick={handleAddSubscription}
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              title="Add another subscription to topology"
            >
              <Plus size={13} />
              <span>Add Sub</span>
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <Tag size={13} color="var(--azure-cyan)" />
            <span>Sub Tags:</span>
            <span className="chip chip-azure" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
              CostCenter = {activeSub.tags?.CostCenter || "1000"}
            </span>
            <span className="chip chip-azure" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
              Owner = {activeSub.tags?.Owner || "cloudops@customer.com"}
            </span>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={18} color="var(--azure-cyan)" />
              <span>Resource Groups in {activeSub.name}</span>
              <span className="chip" style={{ fontSize: "0.7rem" }}>
                {resourceGroups.length} Groups
              </span>
            </h3>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddRg}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={14} />
              <span>Add Resource Group</span>
            </button>
          </div>

          {/* Resource Groups Cards */}
          {resourceGroups.map((rg) => {
            const evalRg = evaluateRgNode(customer, catalog, activeSub, rg);
            const isExpanded = expandedRgs[rg.id] ?? true;
            const isRgTagEditorOpen = expandedTagEditors[rg.id] ?? false;
            const resCount = rg.resources?.length || 0;
            const hasRgOverrides = rg.tags && Object.keys(rg.tags).length > 0;

            return (
              <div
                key={rg.id}
                className="glass-card"
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  transition: "all 0.2s ease"
                }}
              >
                {/* RG Header Banner */}
                <div
                  style={{
                    padding: "14px 18px",
                    background: "rgba(255, 255, 255, 0.02)",
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
                            color: "#38bdf8"
                          }}
                        >
                          {evalRg.evaluatedName}
                        </span>

                        {evalRg.validation.valid ? (
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
                    <div style={{ display: "flex", gap: "4px", alignItems: "center", marginRight: "6px" }}>
                      <span
                        className={`chip ${evalRg.tagOrigins?.CostCenter?.source?.includes("override") ? "chip-purple" : ""}`}
                        style={{ fontSize: "0.68rem" }}
                      >
                        CostCenter: {evalRg.tags.CostCenter}
                      </span>
                      <span
                        className={`chip ${evalRg.tagOrigins?.Environment?.source?.includes("override") ? "chip-purple" : "chip-purple"}`}
                        style={{ fontSize: "0.68rem" }}
                      >
                        Env: {evalRg.tags.Environment}
                      </span>
                      <span className="chip chip-purple" style={{ fontSize: "0.68rem" }}>
                        Workload: {evalRg.tags.Workload}
                      </span>
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
                      onClick={() => handleAddResource(rg.id)}
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
                        <label style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Purpose Token:</label>
                        <select
                          className="input-field"
                          value={rg.purpose || "core"}
                          onChange={(e) => handleUpdateRg(rg.id, { purpose: e.target.value })}
                          style={{ padding: "3px 8px", fontSize: "0.75rem", width: "130px" }}
                        >
                          {(customer.purposes || ["hub", "core", "monitoring", "infrafw", "apps"]).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <label style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Region:</label>
                        <select
                          className="input-field"
                          value={rg.location || activeSub.location || "canadacentral"}
                          onChange={(e) => handleUpdateRg(rg.id, { location: e.target.value })}
                          style={{ padding: "3px 8px", fontSize: "0.75rem", width: "140px" }}
                        >
                          {customer.regions ? (
                            Object.entries(customer.regions).map(([regKey, code]) => (
                              <option key={regKey} value={regKey}>
                                {regKey} ({code})
                              </option>
                            ))
                          ) : (
                            <option value="canadacentral">canadacentral (cc)</option>
                          )}
                        </select>
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
                          {["CostCenter", "Environment", "Workload", "Owner"].map((tagKey) => {
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
                                  <select
                                    className="input-field"
                                    value={currentVal}
                                    onChange={(e) => handleSetRgTagOverride(rg.id, tagKey, e.target.value)}
                                    style={{ fontSize: "0.75rem", padding: "2px 6px", width: "100%" }}
                                  >
                                    <option value="">(Inherit: {inheritedVal})</option>
                                    {allowed.map((val) => (
                                      <option key={val} value={val}>
                                        {val}
                                      </option>
                                    ))}
                                  </select>
                                  {currentVal && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleSetRgTagOverride(rg.id, tagKey, "")}
                                      style={{ padding: "2px 6px", fontSize: "0.7rem" }}
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
                          const isSelected = selectedResId === resource.id;
                          const isResTagEditorOpen = expandedTagEditors[resource.id] ?? false;
                          const hasResOverrides = resource.tags && Object.keys(resource.tags).length > 0;

                          return (
                            <div
                              key={resource.id}
                              style={{
                                padding: "12px 14px",
                                background: isSelected ? "rgba(6, 182, 212, 0.08)" : "rgba(17, 24, 39, 0.6)",
                                border: isSelected ? "1px solid var(--azure-cyan)" : "1px solid var(--border-subtle)",
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
                                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Type:</label>
                                    <select
                                      className="input-field"
                                      value={resource.resourceTypeKey}
                                      onChange={(e) =>
                                        handleUpdateResource(rg.id, resource.id, {
                                          resourceTypeKey: e.target.value
                                        })
                                      }
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "0.8rem",
                                        fontWeight: "600",
                                        fontFamily: "var(--font-mono)",
                                        maxWidth: "260px"
                                      }}
                                    >
                                      {catalog.map((catItem) => (
                                        <option key={catItem.key || catItem.id} value={catItem.key || catItem.abbreviation}>
                                          {catItem.name} ({catItem.abbreviation || catItem.key})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Purpose Override */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Role/Purpose:</label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={resource.purpose || rg.purpose || "core"}
                                      onChange={(e) =>
                                        handleUpdateResource(rg.id, resource.id, {
                                          purpose: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                                        })
                                      }
                                      style={{ width: "90px", padding: "4px 8px", fontSize: "0.8rem" }}
                                    />
                                  </div>

                                  {/* Instance Number */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Instance:</label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={resource.instance || "01"}
                                      onChange={(e) =>
                                        handleUpdateResource(rg.id, resource.id, {
                                          instance: e.target.value.replace(/[^0-9]/g, "").slice(0, 2)
                                        })
                                      }
                                      style={{ width: "50px", padding: "4px 8px", fontSize: "0.8rem", textAlign: "center" }}
                                    />
                                  </div>
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

                              {/* Row 2: "1 BULLET, TWO KILLS" Real-time Evaluation */}
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
                                {/* KILL 1: Canonical Compliant Name */}
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                      Kill 1: Generated Canonical Name
                                    </span>
                                    {evalRes.validation.valid ? (
                                      <span className="chip chip-emerald" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                        <CheckCircle2 size={11} />
                                        <span>
                                          Compliant ({evalRes.evaluatedName.length}/{evalRes.resourceMeta.maxLength || 64})
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="chip chip-amber" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                        <AlertTriangle size={11} />
                                        <span>Constraint Violation</span>
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "0.85rem",
                                      fontWeight: "600",
                                      color: evalRes.validation.valid ? "#38bdf8" : "#f59e0b",
                                      wordBreak: "break-all"
                                    }}
                                  >
                                    {evalRes.evaluatedName}
                                  </div>

                                  {/* Error/Warning Explanation if any */}
                                  {!evalRes.validation.valid && evalRes.validation.errors?.length > 0 && (
                                    <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: "3px" }}>
                                      {evalRes.validation.errors[0]}
                                    </div>
                                  )}
                                </div>

                                {/* KILL 2: Governance Tags Multi-Tier Inheritance */}
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                      Kill 2: Resolved Governance Tags ({Object.keys(evalRes.tags).length})
                                    </span>
                                    <span style={{ fontSize: "0.68rem", color: "var(--azure-cyan)" }}>
                                      Sub + RG + Resource + NA Default
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
                                    {[
                                      "CostCenter",
                                      "Environment",
                                      "Workload",
                                      "Application",
                                      "DataClassification",
                                      "Criticality",
                                      "DisasterRecovery",
                                      "Owner"
                                    ].map((tagKey) => {
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
                                            <select
                                              className="input-field"
                                              value={currentVal}
                                              onChange={(e) =>
                                                handleSetResourceTagOverride(rg.id, resource.id, tagKey, e.target.value)
                                              }
                                              style={{ fontSize: "0.75rem", padding: "2px 6px", width: "100%" }}
                                            >
                                              <option value="">(Inherit: {effectiveVal})</option>
                                              {allowed.map((val) => (
                                                <option key={val} value={val}>
                                                  {val}
                                                </option>
                                              ))}
                                            </select>
                                            {currentVal && (
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() =>
                                                  handleSetResourceTagOverride(rg.id, resource.id, tagKey, "")
                                                }
                                                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
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
            className="glass-card"
            style={{
              position: "sticky",
              top: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              padding: "16px 20px",
              maxHeight: "88vh",
              overflow: "hidden"
            }}
          >
            {/* Header & Tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className={`btn btn-sm ${codeTab === "bicepparam" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCodeTab("bicepparam")}
                  style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}
                >
                  <FileCode size={13} />
                  <span>.bicepparam</span>
                </button>
                <button
                  className={`btn btn-sm ${codeTab === "armparam" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCodeTab("armparam")}
                  style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}
                >
                  <FileCode size={13} />
                  <span>parameters.json</span>
                </button>
                <button
                  className={`btn btn-sm ${codeTab === "bicepmodule" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCodeTab("bicepmodule")}
                  style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}
                >
                  <FileCode size={13} />
                  <span>resources.bicep</span>
                </button>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyCode}
                  style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                  title="Copy Code"
                >
                  <Copy size={13} />
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleDownloadSingle}
                  style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                  title="Download File"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div
              className="code-container"
              style={{
                flex: 1,
                overflowY: "auto",
                maxHeight: "calc(88vh - 120px)",
                background: "#080c14",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.78rem"
              }}
            >
              <pre style={{ margin: 0, color: "#e2e8f0", fontFamily: "var(--font-mono)", lineHeight: 1.45 }}>
                <code>{currentCodeContent}</code>
              </pre>
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
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle size={22} color="var(--accent-rose)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>
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
                  background: "rgba(244, 63, 94, 0.1)",
                  border: "1px solid rgba(244, 63, 94, 0.25)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  fontSize: "0.85rem",
                  color: "#fca5a5"
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
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Zap size={22} color="var(--azure-cyan)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>
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
    </div>
  );
}
