import React, { useState } from "react";
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
import { BASELINE_TAGS } from "../data/baselineTags.js";

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

  const handleAddTag = () => {
    const newTag = {
      key: `NewTag${currentTags.length + 1}`,
      displayName: `New Tag ${currentTags.length + 1}`,
      required: true,
      caseSensitive: false,
      allowedValues: ["Value1", "Value2", "Value3"],
      description: "Governance tag description."
    };
    handleUpdateCurrentTags([...currentTags, newTag]);
    onShowToast(`Added new tag to ${activeScope} scope`);
  };

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

  const handleAllowedValuesChange = (index, commaStr) => {
    const parsed = commaStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const updatedList = [...currentTags];
    updatedList[index] = {
      ...updatedList[index],
      allowedValues: parsed
    };
    handleUpdateCurrentTags(updatedList);
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
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
              <Tag size={20} color="var(--azure-cyan)" />
              Granular Tag Governance & Inheritance Studio
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
              Enforce fixed tag keys and strictly allowed values across the Azure hierarchy, automate one-way downward tag inheritance (Subscription ➔ RG ➔ Resource), and default empty leaf tags to <code>NA</code>.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {activeScope !== "inheritance" ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={handleAddCafBaselines}>
                  <Sparkles size={15} color="var(--azure-cyan)" />
                  <span>Import CAF Baseline</span>
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleAddTag}>
                  <Plus size={16} />
                  <span>Add Tag</span>
                </button>
              </>
            ) : (
              <span className="chip chip-emerald" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
                <RefreshCw size={14} className="spin-slow" />
                <span>Automated Remediation Active</span>
              </span>
            )}
          </div>
        </div>

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
                      <label
                        key={t.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: isChecked ? "rgba(0, 120, 212, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          border: isChecked ? "1px solid rgba(0, 120, 212, 0.4)" : "1px solid var(--border-subtle)",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          id={`chk-sub-rg-${t.key}`}
                          name={`chk_sub_rg_${t.key}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSubToRg(t.key)}
                        />
                        <div style={{ fontSize: "0.82rem" }}>
                          <strong>{t.key}</strong>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Allowed: {(t.allowedValues || []).slice(0, 2).join(", ")}...
                          </div>
                        </div>
                      </label>
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
                      <label
                        key={t.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: isChecked ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          border: isChecked ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-subtle)",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          id={`chk-rg-res-${t.key}`}
                          name={`chk_rg_res_${t.key}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRgToRes(t.key)}
                        />
                        <div style={{ fontSize: "0.82rem" }}>
                          <strong>{t.key}</strong>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Allowed: {(t.allowedValues || []).slice(0, 2).join(", ")}...
                          </div>
                        </div>
                      </label>
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
                      <label
                        key={t.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: isChecked ? "rgba(245, 158, 11, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          border: isChecked ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border-subtle)",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          id={`chk-res-na-${t.key}`}
                          name={`chk_res_na_${t.key}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDefaultNA(t.key)}
                        />
                        <div style={{ fontSize: "0.82rem" }}>
                          <strong>{t.key}</strong>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Defaults to: <span style={{ color: "var(--accent-amber)" }}>"NA"</span>
                          </div>
                        </div>
                      </label>
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
                <select
                  id="geo-restrictions-effect"
                  name="geo_restrictions_effect"
                  aria-label="Regional Geo-Boundary policy effect"
                  className="form-select form-select-sm"
                  style={{ width: "110px" }}
                  value={geoRestrictions.effect || "Audit"}
                  onChange={(e) =>
                    handleUpdateGeoRestrictions({
                      ...geoRestrictions,
                      effect: e.target.value
                    })
                  }
                >
                  <option value="Audit">Audit</option>
                  <option value="Deny">Deny</option>
                  <option value="Disabled">Disabled</option>
                </select>

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
              const allowedStr = (tag.allowedValues || []).join(", ");

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

                  {/* Second Row: Allowed Values List */}
                  <div>
                    <label className="form-label" htmlFor={`tag-values-${activeScope}-${idx}`}>
                      Allowed Values (Comma-Separated)
                      {!tag.required && (
                        <span style={{ color: "var(--accent-amber)", fontSize: "0.75rem", marginLeft: "8px" }}>
                          (Automatically accepts "NA")
                        </span>
                      )}
                    </label>
                    <input
                      id={`tag-values-${activeScope}-${idx}`}
                      name={`tag_values_${activeScope}_${idx}`}
                      aria-label={`Allowed values for tag ${tag.key || idx + 1}`}
                      type="text"
                      className="form-input"
                      value={allowedStr}
                      onChange={(e) => handleAllowedValuesChange(idx, e.target.value)}
                      placeholder="Prod, NonProd, Dev, Stage"
                    />
                  </div>

                  {/* Badges Preview of Allowed Values */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginRight: "4px" }}>
                      Enforced Values:
                    </span>
                    {(tag.allowedValues || []).map((val, vIdx) => (
                      <span key={vIdx} className="chip chip-dim" style={{ fontSize: "0.75rem" }}>
                        {val}
                      </span>
                    ))}
                    {!tag.required && (
                      <span className="chip chip-amber" style={{ fontSize: "0.75rem" }}>
                        NA (Fallback)
                      </span>
                    )}
                  </div>

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
    </div>
  );
}
