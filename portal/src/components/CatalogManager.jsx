import React, { useState, useEffect } from "react";
import {
  AZURE_NAMING_CATALOG,
  DEFAULT_AIRGATE_OVERRIDES,
  getCatalogCategories,
  getCatalogScopes
} from "../data/azureNamingCatalog.js";
import {
  Search,
  BookOpen,
  RotateCcw,
  Plus,
  ExternalLink,
  Download,
  Edit2
} from "lucide-react";

export function CatalogManager({
  customer,
  catalog,
  onAddResourceType,
  onShowToast,
  overrides,
  onUpdateOverrides
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedScope, setSelectedScope] = useState("All");
  const [selectedTagFilter, setSelectedTagFilter] = useState("All");
  const [selectedOverrideFilter, setSelectedOverrideFilter] = useState("All");

  // Edit Override Modal
  const [editingItem, setEditingItem] = useState(null);
  const [overrideValue, setOverrideValue] = useState("");

  // Dismiss modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && editingItem) {
        setEditingItem(null);
      }
    };
    if (editingItem) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [editingItem]);

  const categories = ["All", ...getCatalogCategories()];
  const scopes = ["All", ...getCatalogScopes()];

  // Active items with current overrides applied
  const activeCatalog = AZURE_NAMING_CATALOG.map((item) => {
    const customAbbr = overrides[item.id];
    const effectiveAbbr = customAbbr || item.airgate_abbreviation || item.caf_abbreviation;
    const isOverride = customAbbr
      ? customAbbr !== item.caf_abbreviation
      : item.is_override;

    return {
      ...item,
      active_abbreviation: effectiveAbbr,
      is_override: isOverride
    };
  });

  // Filtered catalog
  const filteredCatalog = activeCatalog.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.provider.toLowerCase().includes(q) ||
      item.caf_abbreviation.toLowerCase().includes(q) ||
      item.active_abbreviation.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;

    const matchesScope =
      selectedScope === "All" || item.scope === selectedScope;

    const matchesTagFilter =
      selectedTagFilter === "All" ||
      (selectedTagFilter === "taggable" && item.taggable) ||
      (selectedTagFilter === "untaggable" && !item.taggable);

    const matchesOverride =
      selectedOverrideFilter === "All" ||
      (selectedOverrideFilter === "overrides" && item.is_override) ||
      (selectedOverrideFilter === "caf" && !item.is_override);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesScope &&
      matchesTagFilter &&
      matchesOverride
    );
  });

  // Stats
  const totalCount = activeCatalog.length;
  const overrideCount = activeCatalog.filter((i) => i.is_override).length;
  const cafStandardCount = totalCount - overrideCount;
  const taggableCount = activeCatalog.filter((i) => i.taggable).length;

  // Check if resource is already in active naming catalog
  const isAlreadyInNamingPolicy = (item) => {
    return catalog.some(
      (c) =>
        c.resourceType?.toLowerCase() === item.provider?.toLowerCase() ||
        c.key?.toLowerCase() === item.active_abbreviation?.toLowerCase() ||
        c.abbreviation?.toLowerCase() === item.active_abbreviation?.toLowerCase()
    );
  };

  const handleAddResourceToNaming = (item) => {
    if (isAlreadyInNamingPolicy(item)) {
      onShowToast(`"${item.name}" is already active in your naming policy rules.`);
      return;
    }

    const newType = {
      key: item.active_abbreviation,
      name: item.name,
      resourceType: item.provider,
      abbreviation: item.active_abbreviation,
      category: item.category,
      defaultPattern: `{Org}-{SUB}-{ResourceGroup}-${item.active_abbreviation}`,
      minLength: item.minLength,
      maxLength: item.maxLength,
      allowedCharacters: item.allowedCharacters,
      pattern: item.pattern,
      scope: item.scope,
      taggable: item.taggable,
      caf_abbreviation: item.caf_abbreviation,
      airgate_abbreviation: item.airgate_abbreviation,
      is_override: item.is_override,
      doc_url: item.doc_url,
      description: `${item.name} (${item.category}) - ${item.scope} scope.`
    };

    onAddResourceType(newType);
    onShowToast(`Added ${item.name} (${item.active_abbreviation}) to active workspace naming rules!`);
  };

  const handleOpenEditOverride = (item) => {
    setEditingItem(item);
    setOverrideValue(item.active_abbreviation);
  };

  const handleSaveOverride = () => {
    if (!editingItem) return;
    const clean = overrideValue.trim().toLowerCase();
    const updated = { ...overrides };
    if (!clean || clean === editingItem.caf_abbreviation) {
      delete updated[editingItem.id];
      onShowToast(`Reset ${editingItem.name} to official CAF (${editingItem.caf_abbreviation})`);
    } else {
      updated[editingItem.id] = clean;
      onShowToast(`Saved override for ${editingItem.name}: ${clean}`);
    }
    onUpdateOverrides(updated);
    setEditingItem(null);
  };

  const handleResetItemToCaf = (item) => {
    const updated = { ...overrides };
    delete updated[item.id];
    onUpdateOverrides(updated);
    onShowToast(`Reset ${item.name} to official CAF abbreviation (${item.caf_abbreviation})`);
  };

  const handleResetAllToCaf = () => {
    if (window.confirm("Are you sure you want to reset ALL 200 resources to official Microsoft CAF abbreviations?")) {
      const cafOnly = {};
      AZURE_NAMING_CATALOG.forEach((i) => {
        cafOnly[i.id] = i.caf_abbreviation;
      });
      onUpdateOverrides(cafOnly);
      onShowToast("Reset all resources to official Microsoft CAF standard abbreviations.");
    }
  };

  const handleRestoreAirGateDefaults = () => {
    onUpdateOverrides({ ...DEFAULT_AIRGATE_OVERRIDES });
    onShowToast("Restored AirGate Enterprise Standard abbreviations (sa, law, gw, conn, lb).");
  };

  const handleExportJson = () => {
    const exportData = {
      schemaVersion: "1.0",
      description: "Azure CAF & AirGate Naming Catalogue with Enterprise Overrides",
      generatedAt: new Date().toISOString(),
      totalResources: activeCatalog.length,
      overridesCount: overrideCount,
      resources: activeCatalog
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `azure-naming-catalogue-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast("Exported catalogue JSON!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header & Summary Banner */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
              <BookOpen size={22} color="var(--azure-cyan)" />
              Microsoft CAF & AirGate Azure Resource Catalogue
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px", maxWidth: "800px" }}>
              Single source of truth for <strong>200 Azure resource types</strong> across 14 service categories. Inspect official Microsoft Cloud Adoption Framework (CAF) abbreviations, AirGate enterprise standard overrides, character length limits, and governance scopes.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleRestoreAirGateDefaults}
              title="Restore standard AirGate overrides: sa, law, gw, conn, lb"
            >
              <RotateCcw size={14} />
              Restore AirGate Standards
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleResetAllToCaf}
              title="Reset all shortcodes to official Microsoft CAF defaults"
            >
              <RotateCcw size={14} />
              Reset All to CAF
            </button>
            <button className="btn btn-sm btn-outline-azure" onClick={handleExportJson}>
              <Download size={14} />
              Export Catalogue JSON
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Total Resource Types</span>
            <span style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text-main)" }}>{totalCount}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--azure-cyan)" }}>14 Service Categories</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Official Microsoft CAF</span>
            <span style={{ fontSize: "1.5rem", fontWeight: "800", color: "#38bdf8" }}>{cafStandardCount}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>Microsoft Learn Standards</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>AirGate Enterprise Overrides</span>
            <span style={{ fontSize: "1.5rem", fontWeight: "800", color: "#fbbf24" }}>{overrideCount}</span>
            <span style={{ fontSize: "0.7rem", color: "#fbbf24" }}>e.g. sa, law, gw, conn, lb</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Taggable Leaf Resources</span>
            <span style={{ fontSize: "1.5rem", fontWeight: "800", color: "#34d399" }}>{taggableCount}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>Supports mode: Indexed</span>
          </div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="glass-panel" style={{ padding: "16px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", alignItems: "center" }}>
          {/* Text Search */}
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "12px", color: "var(--text-dim)" }} />
            <input
              id="catalog-search"
              name="catalog_search"
              aria-label="Search 200 Azure resource types"
              type="text"
              className="form-input"
              style={{ paddingLeft: "32px", fontSize: "0.85rem" }}
              placeholder="Search 200 resources, keys, providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              id="catalog-category-filter"
              name="catalog_category_filter"
              aria-label="Filter catalog by category"
              className="form-input"
              style={{ fontSize: "0.85rem" }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  Category: {c}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Filter */}
          <div>
            <select
              id="catalog-scope-filter"
              name="catalog_scope_filter"
              aria-label="Filter catalog by scope"
              className="form-input"
              style={{ fontSize: "0.85rem" }}
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
            >
              {scopes.map((s) => (
                <option key={s} value={s}>
                  Scope: {s}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <select
              id="catalog-tag-filter"
              name="catalog_tag_filter"
              aria-label="Filter catalog by tag governance"
              className="form-input"
              style={{ fontSize: "0.85rem" }}
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
            >
              <option value="All">Tag Governance: All</option>
              <option value="taggable">Taggable Leaf Only (mode: Indexed)</option>
              <option value="untaggable">Untaggable Sub-Resources</option>
            </select>
          </div>

          {/* Override Filter */}
          <div>
            <select
              id="catalog-standards-filter"
              name="catalog_standards_filter"
              aria-label="Filter catalog by standards"
              className="form-input"
              style={{ fontSize: "0.85rem" }}
              value={selectedOverrideFilter}
              onChange={(e) => setSelectedOverrideFilter(e.target.value)}
            >
              <option value="All">Standards: All</option>
              <option value="overrides">AirGate Overrides Only</option>
              <option value="caf">Official CAF Only</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "0.8rem", color: "var(--text-dim)" }}>
          <span>
            Showing <strong>{filteredCatalog.length}</strong> of {totalCount} Azure Resource Types
          </span>
          {(searchQuery || selectedCategory !== "All" || selectedScope !== "All" || selectedTagFilter !== "All" || selectedOverrideFilter !== "All") && (
            <button
              style={{ background: "transparent", border: "none", color: "var(--azure-cyan)", cursor: "pointer", fontSize: "0.8rem" }}
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedScope("All");
                setSelectedTagFilter("All");
                setSelectedOverrideFilter("All");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Resource Catalogue Table */}
      <div className="glass-panel" style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.05em" }}>
                <th style={{ padding: "14px 18px" }}>Resource Type & Provider</th>
                <th style={{ padding: "14px 14px" }}>Category & Scope</th>
                <th style={{ padding: "14px 14px" }}>CAF Abbr</th>
                <th style={{ padding: "14px 14px" }}>Active Standard</th>
                <th style={{ padding: "14px 14px" }}>Platform Constraints</th>
                <th style={{ padding: "14px 14px" }}>Tag Governance</th>
                <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                    No Azure resource types matched your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCatalog.map((item) => {
                  const alreadyActive = isAlreadyInNamingPolicy(item);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        transition: "background 0.15s ease"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0, 120, 212, 0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Name & Provider */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: "700", color: "var(--text-main)" }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                          {item.provider}
                        </div>
                      </td>

                      {/* Category & Scope */}
                      <td style={{ padding: "14px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                          <span className="chip" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                            {item.category}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Scope: {item.scope}
                          </span>
                        </div>
                      </td>

                      {/* Official CAF */}
                      <td style={{ padding: "14px 14px" }}>
                        <code style={{ fontSize: "0.8rem", color: "var(--text-dim)", background: "rgba(0,0,0,0.25)", padding: "2px 6px", borderRadius: "4px" }}>
                          {item.caf_abbreviation}
                        </code>
                      </td>

                      {/* Active Standard with Override Badge */}
                      <td style={{ padding: "14px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            className="chip chip-azure"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontWeight: "700",
                              fontSize: "0.8rem",
                              padding: "3px 8px"
                            }}
                          >
                            {item.active_abbreviation}
                          </span>
                          {item.is_override && (
                            <span
                              className="chip"
                              style={{
                                background: "rgba(245, 158, 11, 0.2)",
                                color: "#fbbf24",
                                fontSize: "0.68rem",
                                padding: "1px 6px"
                              }}
                            >
                              AirGate Override
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Platform Constraints */}
                      <td style={{ padding: "14px 14px" }}>
                        <div style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div>
                            <span style={{ color: "var(--text-dim)" }}>Len: </span>
                            <strong style={{ fontFamily: "var(--font-mono)", color: "var(--azure-cyan)" }}>
                              {item.minLength}-{item.maxLength}
                            </strong>
                          </div>
                          <div style={{ color: "var(--text-dim)", maxWidth: "180px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.allowedCharacters}>
                            {item.allowedCharacters}
                          </div>
                        </div>
                      </td>

                      {/* Tag Governance Scope */}
                      <td style={{ padding: "14px 14px" }}>
                        {item.scope === "Subscription" ? (
                          <span className="chip" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", fontSize: "0.72rem" }}>
                            Subscription [All]
                          </span>
                        ) : item.scope === "Resource group" && item.id.includes("resourcegroups") ? (
                          <span className="chip" style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", fontSize: "0.72rem" }}>
                            Resource Group [All]
                          </span>
                        ) : item.taggable ? (
                          <span className="chip" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontSize: "0.72rem" }}>
                            Resource Leaf [Indexed]
                          </span>
                        ) : (
                          <span className="chip" style={{ background: "rgba(100, 116, 139, 0.2)", color: "#94a3b8", fontSize: "0.72rem" }}>
                            Untaggable Child
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", alignItems: "center" }}>
                          <button
                            className={`btn btn-sm ${alreadyActive ? "btn-secondary" : "btn-primary"}`}
                            style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                            onClick={() => handleAddResourceToNaming(item)}
                            title={alreadyActive ? "Already in active workspace naming policy" : "Add to active customer naming rules"}
                          >
                            <Plus size={13} />
                            {alreadyActive ? "Enabled" : "Add to Naming"}
                          </button>

                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                            onClick={() => handleOpenEditOverride(item)}
                            title="Customize AirGate abbreviation or reset to CAF"
                          >
                            <Edit2 size={13} />
                          </button>

                          {item.doc_url && (
                            <a
                              href={item.doc_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: "0.72rem", padding: "4px 8px", color: "var(--text-dim)" }}
                              title="View official Microsoft Learn documentation"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Edit Override Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "480px" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-override-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="edit-override-modal-title" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                Customize Standard for {editingItem.name}
              </h2>
              <button
                onClick={() => setEditingItem(null)}
                aria-label="Close modal"
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                Provider: {editingItem.provider}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "6px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Official Microsoft CAF:</span>
                <span style={{ fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--azure-cyan)" }}>
                  {editingItem.caf_abbreviation}
                </span>
              </div>

              <div>
                <label className="form-label" htmlFor="edit-abbreviation-input">Active / AirGate Standard Abbreviation</label>
                <input
                  id="edit-abbreviation-input"
                  name="edit_abbreviation"
                  type="text"
                  className="form-input form-input-mono"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value.toLowerCase())}
                  placeholder={`e.g. ${editingItem.caf_abbreviation}`}
                  autoFocus
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "4px", display: "block" }}>
                  This abbreviation will be used in naming formulas, token generation, and policy definitions.
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button
                className="btn btn-sm btn-secondary"
                style={{ color: "#fbbf24" }}
                onClick={() => {
                  handleResetItemToCaf(editingItem);
                  setEditingItem(null);
                }}
              >
                Reset to CAF ({editingItem.caf_abbreviation})
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-secondary" onClick={() => setEditingItem(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSaveOverride}>
                  Save Standard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
