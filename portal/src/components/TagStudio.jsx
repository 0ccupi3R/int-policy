import React, { useState, useEffect } from "react";
import {
  Tag,
  Building,
  FolderTree,
  Box,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  GitBranch,
  ArrowDown,
  ShieldCheck,
  Layers,
  Globe,
  RefreshCw,
  KeyRound
} from "lucide-react";
import {
  AuHudCard,
  AuButton,
  AuBadge,
  AuModal,
  AuSelect,
  AuCheckbox,
  AuIconButton,
  validateTagKey,
  validateTagAllowedValues
} from "../theme";


/**
 * Controlled Allowed Values Editor
 * Preserves raw comma typing while updating parent tag array in real time
 */
function TagAllowedValuesEditor({ allowedValues = [], isRequired, activeScope, idx, tagKey, onChange }) {
  const [text, setText] = useState(() => (allowedValues || []).join(", "));
  const [isFocused, setIsFocused] = useState(false);

  // Sync from props only when not currently focused by user
  useEffect(() => {
    if (!isFocused) {
      setText((allowedValues || []).join(", "));
    }
  }, [allowedValues, isFocused]);

  const validation = validateTagAllowedValues(text);

  const handleChange = (e) => {
    const rawVal = e.target.value;
    setText(rawVal);

    const parsed = rawVal
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setText(parsed.join(", "));
    onChange(parsed);
  };

  const handleRemoveVal = (valToRemove) => {
    const updated = (allowedValues || []).filter((v) => v !== valToRemove);
    setText(updated.join(", "));
    onChange(updated);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label className="form-label" htmlFor={`tag-values-${activeScope}-${idx}`}>
          Allowed Values (Comma-Separated)
          {!isRequired && (
            <span style={{ color: "var(--accent-amber)", fontSize: "0.75rem", marginLeft: "8px" }}>
              (Automatically accepts "NA")
            </span>
          )}
        </label>
        <span className="au-mono-meta" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          {allowedValues.length} items
        </span>
      </div>
      <input
        id={`tag-values-${activeScope}-${idx}`}
        name={`tag_values_${activeScope}_${idx}`}
        aria-label={`Allowed values for tag ${tagKey || idx + 1}`}
        type="text"
        className={`form-input ${!validation.valid ? "au-input-invalid" : ""}`}
        value={text}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleBlur();
          }
        }}
        placeholder="Prod, NonProd, Dev, Stage"
      />

      {/* Syntax Error / Warning Pills */}
      {!validation.valid && validation.errors.length > 0 && (
        <div className="au-input-pill au-input-pill-error">
          <span>✕</span>
          <span>{validation.errors[0]}</span>
        </div>
      )}
      {validation.valid && validation.warnings.length > 0 && (
        <div className="au-input-pill au-input-pill-warning">
          <span>⚠</span>
          <span>{validation.warnings[0]}</span>
        </div>
      )}

      {/* Badges Preview of Allowed Values with interactive remove */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "8px" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginRight: "4px" }}>
          Enforced Values:
        </span>
        {(allowedValues || []).map((val, vIdx) => (
          <span
            key={vIdx}
            className="chip chip-dim"
            style={{
              fontSize: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "2px 8px"
            }}
          >
            <span>{val}</span>
            <button
              type="button"
              onClick={() => handleRemoveVal(val)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                padding: "0 2px",
                display: "inline-flex",
                alignItems: "center",
                fontSize: "0.85rem",
                lineHeight: 1
              }}
              title={`Remove ${val}`}
              aria-label={`Remove value ${val}`}
            >
              ×
            </button>
          </span>
        ))}
        {!isRequired && (
          <span className="chip chip-amber" style={{ fontSize: "0.75rem" }}>
            NA (Fallback)
          </span>
        )}
      </div>
    </div>
  );
}

export function TagStudio({ customer, onUpdateCustomer, onShowToast, onNavigateToCatalogue }) {
  const [activeScope, setActiveScope] = useState("resource"); // "subscription", "resourceGroup", "resource", "inheritance"

  const tags = customer.tags || { subscription: [], resourceGroup: [], resource: [] };
  const currentTags = tags[activeScope] || [];

  const tagInheritance = customer.tagInheritance || {
    enabled: true,
    effect: "modify",
    subToRg: ["CostCenter", "Owner"],
    rgToResource: ["Environment", "CostCenter", "Workload", "Owner"],
    defaultResourceNA: ["DataClassification", "Criticality"]
  };

  const geoRestrictions = customer.geoRestrictions || {
    enabled: true,
    allowedLocations: ["canadacentral", "canadaeast"],
    effect: "Audit"
  };

  const handleUpdateCurrentTags = (updatedList) => {
    const updated = {
      ...customer,
      tags: {
        ...tags,
        [activeScope]: updatedList
      }
    };
    onUpdateCustomer(updated);
  };

  const handleUpdateTagInheritance = (updatedInheritance) => {
    onUpdateCustomer({
      ...customer,
      tagInheritance: updatedInheritance
    });
  };

  const handleToggleSubToRg = (tagKey) => {
    const current = tagInheritance.subToRg || [];
    const updated = current.includes(tagKey)
      ? current.filter((k) => k !== tagKey)
      : [...current, tagKey];
    handleUpdateTagInheritance({ ...tagInheritance, subToRg: updated });
    onShowToast(`Updated Subscription ➔ RG inheritance for '${tagKey}'`);
  };

  const handleToggleRgToRes = (tagKey) => {
    const current = tagInheritance.rgToResource || [];
    const updated = current.includes(tagKey)
      ? current.filter((k) => k !== tagKey)
      : [...current, tagKey];
    handleUpdateTagInheritance({ ...tagInheritance, rgToResource: updated });
    onShowToast(`Updated RG ➔ Resource inheritance for '${tagKey}'`);
  };

  const handleToggleDefaultNA = (tagKey) => {
    const current = tagInheritance.defaultResourceNA || [];
    const updated = current.includes(tagKey)
      ? current.filter((k) => k !== tagKey)
      : [...current, tagKey];
    handleUpdateTagInheritance({ ...tagInheritance, defaultResourceNA: updated });
    onShowToast(`Updated 'NA' defaulting for '${tagKey}'`);
  };

  const handleUpdateGeoRestrictions = (updatedGeo) => {
    onUpdateCustomer({
      ...customer,
      geoRestrictions: updatedGeo
    });
    onShowToast("Updated Regional Geo-Boundary settings");
  };

  // Multi-Scope Add Tag Modal State
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [tagFormData, setTagFormData] = useState({
    key: "",
    displayName: "",
    description: "",
    required: true,
    caseSensitive: false,
    allowedValuesText: "Prod, NonProd, Dev, Stage",
    scopes: {
      subscription: false,
      resourceGroup: false,
      resource: false
    }
  });
  const [initialTagFormData, setInitialTagFormData] = useState(null);
  const [tagModalError, setTagModalError] = useState("");

  const handleOpenAddTagModal = () => {
    const isSub = activeScope === "subscription";
    const isRg = activeScope === "resourceGroup";
    const isRes = activeScope === "resource" || activeScope === "inheritance";

    const initial = {
      key: "",
      displayName: "",
      description: "",
      required: true,
      caseSensitive: false,
      allowedValuesText: "Prod, NonProd, Dev, Stage",
      scopes: {
        subscription: isSub,
        resourceGroup: isRg,
        resource: isRes
      }
    };
    setTagFormData(initial);
    setInitialTagFormData(initial);
    setTagModalError("");
    setShowAddTagModal(true);
  };

  const handleSelectBaselineSuggestion = (baseline) => {
    setTagFormData((prev) => ({
      ...prev,
      key: baseline.key,
      displayName: baseline.displayName,
      description: baseline.description,
      allowedValuesText: (baseline.defaultAllowed || []).join(", "),
      scopes: {
        ...prev.scopes,
        [baseline.recommendedTier]: true
      }
    }));
    setTagModalError("");
  };

  const handleToggleScope = (scopeKey) => {
    setTagFormData((prev) => ({
      ...prev,
      scopes: {
        ...prev.scopes,
        [scopeKey]: !prev.scopes[scopeKey]
      }
    }));
    setTagModalError("");
  };

  const handleSelectAllScopes = (selectAll) => {
    setTagFormData((prev) => ({
      ...prev,
      scopes: {
        subscription: selectAll,
        resourceGroup: selectAll,
        resource: selectAll
      }
    }));
    setTagModalError("");
  };

  const handleSaveTagModal = (e) => {
    if (e) e.preventDefault();

    const keyVal = validateTagKey(tagFormData.key);
    if (!keyVal.valid) {
      setTagModalError(keyVal.errors[0]);
      return;
    }
    const trimmedKey = keyVal.sanitized || tagFormData.key.trim();

    const selectedScopeKeys = Object.entries(tagFormData.scopes)
      .filter(([_, enabled]) => enabled)
      .map(([scope]) => scope);

    if (selectedScopeKeys.length === 0) {
      setTagModalError("Please select at least one target scope (Subscription, Resource Group, or Resource).");
      return;
    }

    const valVal = validateTagAllowedValues(tagFormData.allowedValuesText);
    if (!valVal.valid) {
      setTagModalError(valVal.errors[0]);
      return;
    }
    const parsedValues = valVal.sanitized;

    const newTag = {
      key: trimmedKey,
      displayName: tagFormData.displayName.trim() || trimmedKey,
      required: tagFormData.required,
      caseSensitive: tagFormData.caseSensitive,
      allowedValues: parsedValues.length > 0 ? parsedValues : ["Value1", "Value2"],
      description: tagFormData.description.trim() || `Governance tag for ${trimmedKey}`
    };

    const updatedTags = {
      subscription: [...(tags.subscription || [])],
      resourceGroup: [...(tags.resourceGroup || [])],
      resource: [...(tags.resource || [])]
    };

    selectedScopeKeys.forEach((scope) => {
      const existingIdx = updatedTags[scope].findIndex(
        (t) => t.key.toLowerCase() === trimmedKey.toLowerCase()
      );
      if (existingIdx >= 0) {
        // Overwrite / synchronize existing tag in this scope
        updatedTags[scope][existingIdx] = newTag;
      } else {
        // Add new tag to this scope
        updatedTags[scope].push(newTag);
      }
    });

    onUpdateCustomer({
      ...customer,
      tags: updatedTags
    });

    setShowAddTagModal(false);
    const scopeNames = selectedScopeKeys
      .map((s) => (s === "subscription" ? "Subscription" : s === "resourceGroup" ? "Resource Group" : "Resource"))
      .join(", ");
    onShowToast(`Saved tag '${trimmedKey}' across ${selectedScopeKeys.length} scope(s) (${scopeNames})!`);
  };

  const isTagModalDirty =
    initialTagFormData !== null && JSON.stringify(tagFormData) !== JSON.stringify(initialTagFormData);


  const handleDeleteTag = (index) => {
    const updatedList = currentTags.filter((_, i) => i !== index);
    handleUpdateCurrentTags(updatedList);
  };

  const handleTagFieldChange = (index, field, value) => {
    const updatedList = [...currentTags];
    updatedList[index] = {
      ...updatedList[index],
      [field]: value
    };
    handleUpdateCurrentTags(updatedList);
  };

  const handleAllowedValuesChange = (index, parsedList) => {
    const updatedList = [...currentTags];
    updatedList[index] = {
      ...updatedList[index],
      allowedValues: parsedList
    };
    handleUpdateCurrentTags(updatedList);
  };

  const handleApplyPreset = (presetType) => {
    let tagsToAdd = [];
    if (presetType === "finops") {
      tagsToAdd = [
        { key: "CostCenter", displayName: "Cost Center", required: true, caseSensitive: false, allowedValues: ["1001-Core", "1002-Infra", "1003-Apps", "1004-Data"], description: "FinOps financial cost allocation code" },
        { key: "ProjectCode", displayName: "Project Code", required: false, caseSensitive: false, allowedValues: ["PRJ-ALZ", "PRJ-CLOUD", "PRJ-MIGRATION"], description: "Enterprise accounting project code" },
        { key: "BusinessUnit", displayName: "Business Unit", required: true, caseSensitive: false, allowedValues: ["Engineering", "Finance", "Security", "Operations"], description: "Owning business division" },
        { key: "Owner", displayName: "Technical Owner", required: true, caseSensitive: false, allowedValues: ["CloudOps", "SecOps", "AppDev"], description: "Contact email or team responsible" }
      ];
    } else if (presetType === "security") {
      tagsToAdd = [
        { key: "DataClassification", displayName: "Data Classification", required: true, caseSensitive: false, allowedValues: ["Public", "Internal", "Confidential", "Restricted"], description: "NIST/ISO data sensitivity level" },
        { key: "Confidentiality", displayName: "Confidentiality", required: false, caseSensitive: false, allowedValues: ["Low", "Moderate", "High"], description: "Security confidentiality tier" },
        { key: "SecurityContact", displayName: "Security Contact", required: true, caseSensitive: false, allowedValues: ["secops@enterprise.com", "soc@enterprise.com"], description: "SOC triage contact" }
      ];
    } else if (presetType === "operations") {
      tagsToAdd = [
        { key: "Environment", displayName: "Environment", required: true, caseSensitive: false, allowedValues: ["Prod", "NonProd", "Dev", "Stage", "Sandbox"], description: "Operational lifecycle environment" },
        { key: "MaintenanceWindow", displayName: "Maintenance Window", required: false, caseSensitive: false, allowedValues: ["Weekend-0200-0600", "Weekday-0000-0400", "None"], description: "Patching and downtime window" },
        { key: "DisasterRecovery", displayName: "Disaster Recovery", required: true, caseSensitive: false, allowedValues: ["Critical-Tier1", "Essential-Tier2", "Standard-Tier3", "NonCritical"], description: "DR tier and failover SLA" }
      ];
    }

    const existingKeys = currentTags.map((t) => t.key.toLowerCase());
    const newItems = tagsToAdd.filter((t) => !existingKeys.includes(t.key.toLowerCase()));

    if (newItems.length === 0) {
      onShowToast("All tags from this preset are already present in this scope.");
      return;
    }

    handleUpdateCurrentTags([...currentTags, ...newItems]);
    onShowToast(`Added ${newItems.length} ${presetType.toUpperCase()} preset tags to ${activeScope} scope!`);
  };

  const handleAddCafBaselines = () => {
    const existingKeys = currentTags.map((t) => t.key.toLowerCase());
    const toAdd = BASELINE_TAGS.filter(
      (b) => !existingKeys.includes(b.key.toLowerCase())
    ).map((b) => ({
      key: b.key,
      displayName: b.displayName,
      required: b.recommendedTier === activeScope,
      caseSensitive: false,
      allowedValues: [...b.defaultAllowed],
      description: b.description
    }));

    if (toAdd.length === 0) {
      onShowToast("All baseline tags are already present in this scope.");
      return;
    }

    handleUpdateCurrentTags([...currentTags, ...toAdd]);
    onShowToast(`Added ${toAdd.length} Microsoft CAF baseline tags to ${activeScope} scope!`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header & Hierarchy Explanation */}
      <AuHudCard
        kicker="FINOPS & COMPLIANCE GOVERNANCE"
        title="Granular Tag Governance & Inheritance Studio"
        meta={`Scope: ${activeScope.toUpperCase()} · Enforce allowed values and one-way downward inheritance`}
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {activeScope !== "inheritance" ? (
              <>
                <AuButton
                  variant="secondary"
                  size="sm"
                  onClick={() => handleApplyPreset("finops")}
                  title="Inject FinOps Cost Allocation Suite (CostCenter, ProjectCode, BusinessUnit, Owner)"
                  icon={<Sparkles size={13} style={{ color: "var(--accent-mint)" }} />}
                >
                  + FinOps Suite
                </AuButton>

                <AuButton
                  variant="secondary"
                  size="sm"
                  onClick={() => handleApplyPreset("security")}
                  title="Inject Security & Data Classification Suite"
                  icon={<ShieldCheck size={13} style={{ color: "var(--accent-teal)" }} />}
                >
                  + Security Suite
                </AuButton>

                <AuButton
                  variant="secondary"
                  size="sm"
                  onClick={() => handleApplyPreset("operations")}
                  title="Inject Operational Environment & DR Suite"
                >
                  + Ops Suite
                </AuButton>

                <AuButton
                  variant="primary"
                  size="sm"
                  onClick={handleOpenAddTagModal}
                  icon={<Plus size={14} />}
                >
                  Add Tag
                </AuButton>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="au-badge au-badge-mint" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                  <RefreshCw size={13} className="spin-slow" />
                  <span>Automated Remediation Active</span>
                </span>
                <AuButton
                  variant="primary"
                  size="sm"
                  onClick={handleOpenAddTagModal}
                  icon={<Plus size={14} />}
                >
                  Add Tag
                </AuButton>
              </div>
            )}

          </div>
        }
      >
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>
          Enforce fixed tag keys and strictly allowed values across the Azure hierarchy, automate one-way downward tag inheritance (Subscription ➔ RG ➔ Resource), and default empty leaf tags to <code>NA</code>.
        </p>
      </AuHudCard>

        {/* Catalogue Scope Guidance Banner */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(0, 120, 212, 0.08)",
            border: "1px solid rgba(0, 120, 212, 0.25)",
            marginBottom: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BookOpen size={18} color="var(--azure-cyan)" />
            <div style={{ fontSize: "0.82rem" }}>
              <strong style={{ color: "var(--text-main)" }}>Catalogue Scope Alignment:</strong>{" "}
              <span style={{ color: "var(--text-dim)" }}>
                Subscription & RG policies evaluate with <code>mode: All</code>. Leaf Resource policies evaluate with <code>mode: Indexed</code> (governs taggable catalog resources while automatically exempting sub-resources like subnets).
              </span>
            </div>
          </div>
          {onNavigateToCatalogue && (
            <button
              className="btn btn-sm btn-outline-azure"
              style={{ fontSize: "0.75rem", padding: "4px 10px", whiteSpace: "nowrap" }}
              onClick={onNavigateToCatalogue}
            >
              Browse 200 Catalogue Resources
            </button>
          )}
        </div>

        {/* 2. Hierarchical Scope Tabs */}
        <div className="nav-tabs" style={{ marginBottom: 0 }}>
          <button
            className={`nav-tab-btn ${activeScope === "subscription" ? "active" : ""}`}
            onClick={() => setActiveScope("subscription")}
          >
            <Building size={16} />
            <span>1. Subscription Scope</span>
            <span className="tab-badge">{tags.subscription?.length || 0} Tags</span>
          </button>

          <button
            className={`nav-tab-btn ${activeScope === "resourceGroup" ? "active" : ""}`}
            onClick={() => setActiveScope("resourceGroup")}
          >
            <FolderTree size={16} />
            <span>2. Resource Group Scope</span>
            <span className="tab-badge">{tags.resourceGroup?.length || 0} Tags</span>
          </button>

          <button
            className={`nav-tab-btn ${activeScope === "resource" ? "active" : ""}`}
            onClick={() => setActiveScope("resource")}
          >
            <Box size={16} />
            <span>3. Resource Scope</span>
            <span className="tab-badge">{tags.resource?.length || 0} Tags</span>
          </button>

          <button
            className={`nav-tab-btn ${activeScope === "inheritance" ? "active" : ""}`}
            onClick={() => setActiveScope("inheritance")}
          >
            <GitBranch size={16} />
            <span>4. Tag Inheritance & Remediation</span>
            <span className="tab-badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "var(--accent-emerald)" }}>
              modify
            </span>
          </button>
        </div>

      {/* 3. Scope Details Banner */}
      <div
        style={{
          padding: "14px 20px",
          borderRadius: "10px",
          background: "rgba(11, 15, 25, 0.6)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>
            {activeScope === "subscription" && "🏢 Subscription Level Tag Policies"}
            {activeScope === "resourceGroup" && "📁 Resource Group Level Tag Policies"}
            {activeScope === "resource" && "📦 Resource Level Tag Policies (Indexed Mode)"}
            {activeScope === "inheritance" && "🔄 One-Way Tag Inheritance & Automated Defaulting Engine"}
          </span>
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: "2px" }}>
            {activeScope === "subscription" && "Evaluated at subscription level. Enforces high-level financial & operational accountability."}
            {activeScope === "resourceGroup" && "Targeted at Microsoft.Resources/subscriptions/resourceGroups. Ideal for Environment & Project tags."}
            {activeScope === "resource" && "Uses Azure Policy mode: Indexed. Targets all individual resources that support tags without impacting internal child objects."}
            {activeScope === "inheritance" && "Inherits common tags downward (Subscription ➔ RG ➔ Resource) with 100% multi-subscription boundary isolation. Defaults empty resource tags to 'NA'."}
          </p>
        </div>

        <span className="chip chip-emerald" style={{ fontSize: "0.8rem" }}>
          {activeScope === "inheritance"
            ? `${(tagInheritance.subToRg?.length || 0) + (tagInheritance.rgToResource?.length || 0) + (tagInheritance.defaultResourceNA?.length || 0)} Inheritance Rules`
            : `${currentTags.length} Active Rules`}
        </span>
      </div>

      {/* 4. Tab Body: Inheritance Studio or Standard Scope Card List */}
      {activeScope === "inheritance" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Visual Architecture Flow Diagram */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={18} color="var(--azure-cyan)" />
              Downward Tag Inheritance Architecture & Isolation Principle
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
              Tags flow strictly downward in the hierarchy. Resources can inherit common tags from their parent Resource Group, which can inherit common tags from the Subscription. Never vice-versa.
            </p>

            {/* Visual Three-Tier Flow */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: "12px", alignItems: "center" }}>
              {/* Tier 1: Subscription */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "rgba(0, 120, 212, 0.1)",
                  border: "1px solid rgba(0, 120, 212, 0.3)",
                  textAlign: "center"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontWeight: "700", color: "var(--azure-cyan)", marginBottom: "4px" }}>
                  <Building size={16} />
                  <span>Subscription Scope</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  High-level Financial & Ownership Tags
                </div>
                <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center" }}>
                  {(tagInheritance.subToRg || []).map((k) => (
                    <span key={k} className="chip chip-blue" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              {/* Arrow Downward */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--azure-cyan)" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "700", marginBottom: "2px" }}>modify</span>
                <ArrowDown size={22} />
              </div>

              {/* Tier 2: Resource Group */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  textAlign: "center"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontWeight: "700", color: "var(--accent-emerald)", marginBottom: "4px" }}>
                  <FolderTree size={16} />
                  <span>Resource Group Scope</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Environment & Project Context Tags
                </div>
                <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center" }}>
                  {(tagInheritance.rgToResource || []).map((k) => (
                    <span key={k} className="chip chip-emerald" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              {/* Arrow Downward */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--accent-emerald)" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "700", marginBottom: "2px" }}>modify</span>
                <ArrowDown size={22} />
              </div>

              {/* Tier 3: Leaf Resource */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  textAlign: "center"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontWeight: "700", color: "var(--accent-amber)", marginBottom: "4px" }}>
                  <Box size={16} />
                  <span>Resource Leaf Scope</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Application + Inherited + 'NA' Fallbacks
                </div>
                <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center" }}>
                  {(tagInheritance.defaultResourceNA || []).map((k) => (
                    <span key={k} className="chip chip-amber" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                      {k}: NA
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Isolation Warning Alert */}
            <div
              style={{
                marginTop: "20px",
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <ShieldCheck size={20} color="var(--accent-emerald)" />
              <div style={{ fontSize: "0.82rem", color: "var(--text-main)" }}>
                <strong>Strict Subscription Boundary Isolation Guaranteed:</strong> Azure Policy dynamically evaluates <code>subscription().tags</code> against the containing subscription only. If you manage multiple subscriptions (e.g. Sub1 and Sub2), tags in Sub1 can never bleed into or be inherited by Sub2's Resource Groups or Resources.
              </div>
            </div>
          </div>

          {/* Configuration Grid: 3 Inheritance Managers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            {/* 1. Sub -> RG */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "0.95rem", color: "var(--azure-cyan)" }}>
                <Building size={16} />
                <span>Sub ➔ RG Inheritance</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Select tags defined on Subscription to automatically copy to child Resource Groups if missing:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {(tags.subscription || []).length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontStyle: "italic" }}>
                    No subscription tags defined yet.
                  </span>
                ) : (
                  (tags.subscription || []).map((t) => {
                    const isChecked = (tagInheritance.subToRg || []).includes(t.key);
                    return (
                      <div
                        key={t.key}
                        className={`au-selection-row ${isChecked ? "is-checked" : ""}`}
                        onClick={() => handleToggleSubToRg(t.key)}
                      >
                        <AuCheckbox
                          id={`chk-sub-rg-${t.key}`}
                          checked={isChecked}
                          onChange={() => handleToggleSubToRg(t.key)}
                        />
                        <div style={{ fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--text-primary)" }}>{t.key}</strong>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Allowed: {(t.allowedValues || []).slice(0, 3).join(", ")}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. RG -> Resource */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "0.95rem", color: "var(--accent-emerald)" }}>
                <FolderTree size={16} />
                <span>RG ➔ Resource Inheritance</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Select tags defined on Resource Groups to automatically copy to child Resources if missing:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {(tags.resourceGroup || []).length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontStyle: "italic" }}>
                    No resource group tags defined yet.
                  </span>
                ) : (
                  (tags.resourceGroup || []).map((t) => {
                    const isChecked = (tagInheritance.rgToResource || []).includes(t.key);
                    return (
                      <div
                        key={t.key}
                        className={`au-selection-row ${isChecked ? "is-checked" : ""}`}
                        onClick={() => handleToggleRgToRes(t.key)}
                      >
                        <AuCheckbox
                          id={`chk-rg-res-${t.key}`}
                          checked={isChecked}
                          onChange={() => handleToggleRgToRes(t.key)}
                        />
                        <div style={{ fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--text-primary)" }}>{t.key}</strong>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Allowed: {(t.allowedValues || []).slice(0, 3).join(", ")}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Resource NA Defaulting */}
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "0.95rem", color: "var(--accent-amber)" }}>
                <Box size={16} />
                <span>Resource 'NA' Defaulting</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                When missing or empty on resources, automatically set value to <code>"NA"</code> so deployment succeeds:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {(tags.resource || []).length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontStyle: "italic" }}>
                    No resource tags defined yet.
                  </span>
                ) : (
                  (tags.resource || []).map((t) => {
                    const isChecked = (tagInheritance.defaultResourceNA || []).includes(t.key);
                    return (
                      <div
                        key={t.key}
                        className={`au-selection-row ${isChecked ? "is-checked" : ""}`}
                        onClick={() => handleToggleDefaultNA(t.key)}
                      >
                        <AuCheckbox
                          id={`chk-res-na-${t.key}`}
                          checked={isChecked}
                          onChange={() => handleToggleDefaultNA(t.key)}
                        />
                        <div style={{ fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--text-primary)" }}>{t.key}</strong>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Defaults to: <span style={{ color: "var(--accent-amber)" }}>"NA"</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Regional Geo-Boundary Lockdown (Canada Central & Canada East) */}
          <div className="glass-panel" style={{ padding: "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Globe size={20} color="var(--azure-cyan)" />
                <div>
                  <h4 style={{ fontSize: "0.98rem", fontWeight: "700" }}>
                    Regional Geo-Boundary Restriction (Canada Central & Canada East)
                  </h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Enforces Canadian data residency by restricting non-global resources and resource groups to approved regional locations.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "130px" }}>
                  <AuSelect
                    id="geo-restrictions-effect"
                    aria-label="Regional Geo-Boundary policy effect"
                    value={geoRestrictions.effect || "Audit"}
                    onChange={(val) =>
                      handleUpdateGeoRestrictions({
                        ...geoRestrictions,
                        effect: val
                      })
                    }
                    options={[
                      { value: "Audit", label: "Audit" },
                      { value: "Deny", label: "Deny" },
                      { value: "Disabled", label: "Disabled" }
                    ]}
                  />
                </div>


                <button
                  className={`btn btn-sm ${geoRestrictions.enabled ? "btn-primary" : "btn-secondary"}`}
                  onClick={() =>
                    handleUpdateGeoRestrictions({
                      ...geoRestrictions,
                      enabled: !geoRestrictions.enabled
                    })
                  }
                >
                  {geoRestrictions.enabled ? "✓ Geo-Lock Enabled" : "Disabled"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Allowed Regions:</span>
              {(geoRestrictions.allowedLocations || ["canadacentral", "canadaeast"]).map((loc) => (
                <span key={loc} className="chip chip-blue" style={{ fontSize: "0.75rem" }}>
                  🍁 {loc}
                </span>
              ))}
              <span className="chip chip-dim" style={{ fontSize: "0.75rem", fontStyle: "italic" }}>
                Global services (Traffic Manager, Front Door) auto-exempted
              </span>
            </div>
          </div>

          {/* Three-Initiative Summary Architecture Blueprint */}
          <div
            style={{
              padding: "20px 24px",
              borderRadius: "10px",
              background: "rgba(11, 15, 25, 0.8)",
              border: "1px solid var(--border-subtle)"
            }}
          >
            <h4 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <KeyRound size={17} color="var(--accent-purple)" />
              Three Dedicated Azure Policy Initiatives (Policy Sets) Generated
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
              <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontWeight: "700", color: "var(--azure-cyan)", fontSize: "0.85rem" }}>
                  1. Naming & Geo-Boundary Initiative
                </span>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Enforces 36+ type-specific naming rules, subnet allowlist, and locks regional deployments to Canada Central & Canada East.
                </p>
                <div style={{ marginTop: "8px", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Effect: <code>{customer.namingEffect || "Audit"}</code>
                </div>
              </div>

              <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontWeight: "700", color: "var(--accent-emerald)", fontSize: "0.85rem" }}>
                  2. Tag Governance Initiative
                </span>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Enforces mandatory tag keys and strictly allowed values across Subscription, Resource Group, and Leaf Resource scopes.
                </p>
                <div style={{ marginTop: "8px", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Effect: <code>{customer.tagEffect || "Audit"}</code>
                </div>
              </div>

              <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontWeight: "700", color: "var(--accent-amber)", fontSize: "0.85rem" }}>
                  3. Tag Inheritance & Remediation Initiative
                </span>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Uses Azure Policy <code>modify</code> effect with System-Assigned Managed Identity & Tag Contributor role to propagate common tags and default missing tags to 'NA'.
                </p>
                <div style={{ marginTop: "8px", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Effect: <code>{tagInheritance.effect || "modify"}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Tag Cards List for activeScope ("subscription", "resourceGroup", "resource") */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {currentTags.length === 0 ? (
            <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "14px" }}>
                No tag policies defined for this scope yet.
              </p>
              <button className="btn btn-primary" onClick={handleAddCafBaselines}>
                <Sparkles size={16} />
                <span>Import Microsoft CAF Baseline Tags</span>
              </button>
            </div>
          ) : (
            currentTags.map((tag, idx) => {
              return (
                <div
                  key={idx}
                  className="glass-panel"
                  style={{
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    borderLeft: tag.required
                      ? "4px solid var(--azure-cyan)"
                      : "4px solid var(--accent-amber)"
                  }}
                >
                  {/* Top Row: Key Name, Required Toggle, and Delete */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "16px", alignItems: "center" }}>
                    <div>
                      <label className="form-label" htmlFor={`tag-key-${activeScope}-${idx}`}>Tag Key Name</label>
                      <input
                        id={`tag-key-${activeScope}-${idx}`}
                        name={`tag_key_${activeScope}_${idx}`}
                        aria-label={`Tag key name for ${activeScope} rule ${idx + 1}`}
                        type="text"
                        className="form-input form-input-mono"
                        value={tag.key}
                        onChange={(e) => handleTagFieldChange(idx, "key", e.target.value)}
                        placeholder="e.g. Environment"
                      />
                    </div>

                    <div>
                      <label className="form-label">Requirement Status</label>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid var(--border-subtle)"
                        }}
                      >
                        <input
                          type="checkbox"
                          id={`req-${activeScope}-${idx}`}
                          name={`req_${activeScope}_${idx}`}
                          checked={tag.required}
                          onChange={(e) => handleTagFieldChange(idx, "required", e.target.checked)}
                          style={{ cursor: "pointer", width: "16px", height: "16px" }}
                        />
                        <label
                          htmlFor={`req-${activeScope}-${idx}`}
                          style={{ fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          {tag.required ? (
                            <>
                              <CheckCircle2 size={15} color="var(--accent-emerald)" />
                              <strong style={{ color: "var(--accent-emerald)" }}>Mandatory (Required)</strong>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={15} color="var(--accent-amber)" />
                              <span style={{ color: "var(--text-muted)" }}>Optional (Accepts NA)</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    <div style={{ alignSelf: "flex-end" }}>
                      <button
                        className="btn btn-icon btn-danger"
                        title="Delete tag rule"
                        onClick={() => handleDeleteTag(idx)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Second Row: Allowed Values Editor */}
                  <TagAllowedValuesEditor
                    key={`${activeScope}-${idx}`}
                    allowedValues={tag.allowedValues || []}
                    isRequired={tag.required}
                    activeScope={activeScope}
                    idx={idx}
                    tagKey={tag.key}
                    onChange={(newAllowed) => handleAllowedValuesChange(idx, newAllowed)}
                  />

                  {/* Description */}
                  <div>
                    <input
                      id={`tag-desc-${activeScope}-${idx}`}
                      name={`tag_desc_${activeScope}_${idx}`}
                      aria-label={`Description for tag ${tag.key || idx + 1}`}
                      type="text"
                      className="form-input"
                      style={{ fontSize: "0.8rem", padding: "6px 10px", color: "var(--text-muted)" }}
                      value={tag.description || ""}
                      onChange={(e) => handleTagFieldChange(idx, "description", e.target.value)}
                      placeholder="Optional business description..."
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Multi-Scope Add Tag Policy Modal */}

      <AuModal
        isOpen={showAddTagModal}
        onClose={() => setShowAddTagModal(false)}
        isDirty={isTagModalDirty}
        kicker="TAG GOVERNANCE POLICY"
        title="Add New Tag Policy Rule"
        maxWidth="680px"
        footer={
          <>
            <AuButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAddTagModal(false)}
            >
              Cancel
            </AuButton>
            <AuButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveTagModal}
              icon={<Plus size={14} />}
            >
              {`Save Tag to ${Object.values(tagFormData.scopes).filter(Boolean).length} Scope(s)`}
            </AuButton>
          </>
        }
      >
        <form onSubmit={handleSaveTagModal} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Validation Error Banner */}
          {tagModalError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent-rose-tint)",
                border: "1px solid var(--accent-rose)",
                color: "var(--accent-rose)",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <AlertCircle size={15} />
              <span>{tagModalError}</span>
            </div>
          )}

          {/* Quick Baseline Suggestions */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span className="au-label" style={{ margin: 0 }}>
                Microsoft CAF Recommended Baselines:
              </span>
              <span className="au-mono-meta" style={{ fontSize: "0.72rem" }}>
                Click to 1-Click Autofill
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {BASELINE_TAGS.slice(0, 7).map((bt) => (
                <button
                  key={bt.key}
                  type="button"
                  className="au-badge"
                  style={{
                    cursor: "pointer",
                    fontSize: "0.72rem",
                    padding: "0.25rem 0.6rem",
                    background: tagFormData.key === bt.key ? "var(--accent-primary)" : "var(--bg-canvas)",
                    color: tagFormData.key === bt.key ? "#06252D" : "var(--text-secondary)",
                    borderColor: tagFormData.key === bt.key ? "var(--accent-primary)" : "var(--border-hairline)"
                  }}
                  onClick={() => handleSelectBaselineSuggestion(bt)}
                  title={`Autofill ${bt.displayName}`}
                >
                  <Sparkles size={11} />
                  <span>{bt.key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tag Key and Display Name */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="au-form-group">
              <label className="au-label" htmlFor="new-tag-key">
                Tag Key Name *
              </label>
              <input
                id="new-tag-key"
                name="new_tag_key"
                type="text"
                required
                className="au-input au-input-mono"
                value={tagFormData.key}
                onChange={(e) => {
                  setTagFormData({ ...tagFormData, key: e.target.value });
                  setTagModalError("");
                }}
                placeholder="e.g. CostCenter or Environment"
                autoFocus
              />
            </div>

            <div className="au-form-group">
              <label className="au-label" htmlFor="new-tag-display-name">
                Display Name
              </label>
              <input
                id="new-tag-display-name"
                name="new_tag_display_name"
                type="text"
                className="au-input"
                value={tagFormData.displayName}
                onChange={(e) => setTagFormData({ ...tagFormData, displayName: e.target.value })}
                placeholder="e.g. Cost Center"
              />
            </div>
          </div>

          {/* Allowed Values (Comma-Separated) */}
          <div className="au-form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="au-label" htmlFor="new-tag-allowed-values" style={{ margin: 0 }}>
                Allowed Values (Comma-Separated)
              </label>
              {!tagFormData.required && (
                <span className="au-mono-meta" style={{ color: "var(--accent-amber)", fontSize: "0.72rem" }}>
                  (Optional tag auto-accepts 'NA' fallback)
                </span>
              )}
            </div>
            <input
              id="new-tag-allowed-values"
              name="new_tag_allowed_values"
              type="text"
              className="au-input"
              value={tagFormData.allowedValuesText}
              onChange={(e) => setTagFormData({ ...tagFormData, allowedValuesText: e.target.value })}
              placeholder="e.g. Prod, NonProd, Dev, Stage"
            />
            {/* Live Value Pill Preview */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
              {tagFormData.allowedValuesText
                .split(",")
                .map((v) => v.trim())
                .filter((v) => v.length > 0)
                .map((val, idx) => (
                  <span key={idx} className="au-badge au-badge-neutral" style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                    {val}
                  </span>
                ))}
              {!tagFormData.required && (
                <span className="au-badge au-badge-amber" style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                  NA (Fallback)
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="au-form-group">
            <label className="au-label" htmlFor="new-tag-description">
              Business Purpose / Description
            </label>
            <input
              id="new-tag-description"
              name="new_tag_description"
              type="text"
              className="au-input"
              value={tagFormData.description}
              onChange={(e) => setTagFormData({ ...tagFormData, description: e.target.value })}
              placeholder="Brief explanation of governance purpose..."
            />
          </div>

          {/* Requirement Status & Case Sensitivity Checkboxes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-canvas)",
                border: "1px solid var(--border-hairline)",
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={tagFormData.required}
                onChange={(e) => setTagFormData({ ...tagFormData, required: e.target.checked })}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <div>
                <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Mandatory / Required</strong>
                <div className="au-mono-meta" style={{ fontSize: "0.72rem" }}>Strict enforcement</div>
              </div>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-canvas)",
                border: "1px solid var(--border-hairline)",
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={tagFormData.caseSensitive}
                onChange={(e) => setTagFormData({ ...tagFormData, caseSensitive: e.target.checked })}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <div>
                <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>Case-Sensitive</strong>
                <div className="au-mono-meta" style={{ fontSize: "0.72rem" }}>Exact case matching</div>
              </div>
            </label>
          </div>

          {/* MULTI-SCOPE TARGET SELECTION BOX */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-strong)",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="au-kicker" style={{ fontSize: "0.68rem", marginBottom: "0.1rem" }}>
                  TARGET HIERARCHY
                </div>
                <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Assign to Scopes (Multi-Select)
                </h4>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <AuButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAllScopes(true)}
                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                >
                  Select All
                </AuButton>
                <AuButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAllScopes(false)}
                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                >
                  Clear
                </AuButton>
              </div>
            </div>

            {/* Scope 1: Subscription */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: tagFormData.scopes.subscription ? "var(--accent-tint)" : "var(--bg-canvas)",
                border: tagFormData.scopes.subscription ? "1px solid var(--accent-primary)" : "1px solid var(--border-hairline)",
                cursor: "pointer",
                transition: "all var(--ease-snappy)"
              }}
            >
              <input
                type="checkbox"
                checked={tagFormData.scopes.subscription}
                onChange={() => handleToggleScope("subscription")}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <Building size={18} style={{ color: "var(--accent-primary)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>1. Subscription Scope</strong>
                  <span className="au-badge au-badge-teal" style={{ fontSize: "0.68rem" }}>Root Policy</span>
                </div>
                <div className="au-mono-meta" style={{ fontSize: "0.74rem", marginTop: "2px" }}>
                  Evaluated at subscription level. Enforces financial & executive accountability.
                </div>
              </div>
            </label>

            {/* Scope 2: Resource Group */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: tagFormData.scopes.resourceGroup ? "var(--accent-mint-tint)" : "var(--bg-canvas)",
                border: tagFormData.scopes.resourceGroup ? "1px solid var(--accent-mint)" : "1px solid var(--border-hairline)",
                cursor: "pointer",
                transition: "all var(--ease-snappy)"
              }}
            >
              <input
                type="checkbox"
                checked={tagFormData.scopes.resourceGroup}
                onChange={() => handleToggleScope("resourceGroup")}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <FolderTree size={18} style={{ color: "var(--accent-mint)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>2. Resource Group Scope</strong>
                  <span className="au-badge au-badge-mint" style={{ fontSize: "0.68rem" }}>RG Context</span>
                </div>
                <div className="au-mono-meta" style={{ fontSize: "0.74rem", marginTop: "2px" }}>
                  Targets Microsoft.Resources/subscriptions/resourceGroups. Ideal for Environment & Project tags.
                </div>
              </div>
            </label>

            {/* Scope 3: Resource */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                background: tagFormData.scopes.resource ? "var(--accent-amber-tint)" : "var(--bg-canvas)",
                border: tagFormData.scopes.resource ? "1px solid var(--accent-amber)" : "1px solid var(--border-hairline)",
                cursor: "pointer",
                transition: "all var(--ease-snappy)"
              }}
            >
              <input
                type="checkbox"
                checked={tagFormData.scopes.resource}
                onChange={() => handleToggleScope("resource")}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <Box size={18} style={{ color: "var(--accent-amber)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>3. Leaf Resource Scope</strong>
                  <span className="au-badge au-badge-amber" style={{ fontSize: "0.68rem" }}>mode: Indexed</span>
                </div>
                <div className="au-mono-meta" style={{ fontSize: "0.74rem", marginTop: "2px" }}>
                  Targets individual Azure resources supporting tags without impacting internal child objects.
                </div>
              </div>
            </label>
          </div>
        </form>
      </AuModal>
    </div>
  );
}

