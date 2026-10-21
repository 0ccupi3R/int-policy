import React, { useState, useEffect, useMemo } from "react";
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
  Edit2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { AuHudCard, AuButton, AuBadge, AuExpandCollapseButton, AuSelect } from "../theme";


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

  const [expandedCategories, setExpandedCategories] = useState({});

  // Group filtered catalog by category
  const groupedCatalog = useMemo(() => {
    const groups = {};
    filteredCatalog.forEach((item) => {
      const cat = item.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredCatalog]);

  const categoryNames = useMemo(() => Object.keys(groupedCatalog), [groupedCatalog]);
  const allCategoriesExpanded = categoryNames.length > 0 && categoryNames.every((c) => !!expandedCategories[c]);

  const handleToggleAllCategories = () => {
    if (allCategoriesExpanded) {
      setExpandedCategories({});
    } else {
      const next = {};
      categoryNames.forEach((c) => {
        next[c] = true;
      });
      setExpandedCategories(next);
    }
  };

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };


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
      <AuHudCard
        kicker="AZURE CLOUD ADOPTION FRAMEWORK"
        title="Microsoft CAF & AirGate Azure Resource Catalogue"
        meta="Single source of truth for 200 Azure resource types across 14 service categories"
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <AuButton
              variant="secondary"
              size="sm"
              onClick={handleRestoreAirGateDefaults}
              title="Restore standard AirGate overrides: sa, law, gw, conn, lb"
              icon={<RotateCcw size={13} />}
            >
              Restore AirGate Standards
            </AuButton>
            <AuButton
              variant="secondary"
              size="sm"
              onClick={handleResetAllToCaf}
              title="Reset all shortcodes to official Microsoft CAF defaults"
              icon={<RotateCcw size={13} />}
            >
              Reset All to CAF
            </AuButton>
            <AuButton
              variant="primary"
              size="sm"
              onClick={handleExportJson}
              icon={<Download size={13} />}
            >
              Export JSON
            </AuButton>
          </div>
        }
      >
        {/* KPI Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "4px" }}>
          <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span className="au-mono-meta">Total Resource Types</span>
            <span style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--text-primary)" }}>{totalCount}</span>
            <span className="au-mono-meta" style={{ color: "var(--accent-primary)" }}>14 Service Categories</span>
          </div>

          <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span className="au-mono-meta">Official Microsoft CAF</span>
            <span style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--accent-teal)" }}>{cafStandardCount}</span>
            <span className="au-mono-meta">Microsoft Learn Standards</span>
          </div>

          <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span className="au-mono-meta">AirGate Overrides</span>
            <span style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--accent-amber)" }}>{overrideCount}</span>
            <span className="au-mono-meta" style={{ color: "var(--accent-amber)" }}>e.g. sa, law, gw, conn, lb</span>
          </div>

          <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span className="au-mono-meta">Taggable Leaf Resources</span>
            <span style={{ fontSize: "1.4rem", fontWeight: "700", color: "var(--accent-mint)" }}>{taggableCount}</span>
            <span className="au-mono-meta">Supports mode: Indexed</span>
          </div>
        </div>
      </AuHudCard>

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
            <AuSelect
              id="catalog-category-filter"
              aria-label="Filter catalog by category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categories.map((c) => ({ value: c, label: `Category: ${c}` }))}
            />
          </div>

          {/* Scope Filter */}
          <div>
            <AuSelect
              id="catalog-scope-filter"
              aria-label="Filter catalog by scope"
              value={selectedScope}
              onChange={setSelectedScope}
              options={scopes.map((s) => ({ value: s, label: `Scope: ${s}` }))}
            />
          </div>

          {/* Tag Filter */}
          <div>
            <AuSelect
              id="catalog-tag-filter"
              aria-label="Filter catalog by tag governance"
              value={selectedTagFilter}
              onChange={setSelectedTagFilter}
              options={[
                { value: "All", label: "Tag Governance: All" },
                { value: "taggable", label: "Taggable Leaf Only (mode: Indexed)" },
                { value: "untaggable", label: "Untaggable Sub-Resources" }
              ]}
            />
          </div>

          {/* Override Filter */}
          <div>
            <AuSelect
              id="catalog-standards-filter"
              aria-label="Filter catalog by standards"
              value={selectedOverrideFilter}
              onChange={setSelectedOverrideFilter}
              options={[
                { value: "All", label: "Standards: All" },
                { value: "overrides", label: "AirGate Overrides Only" },
                { value: "caf", label: "Official CAF Only" }
              ]}
            />
          </div>
        </div>


        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "0.8rem", color: "var(--text-dim)", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>
              Showing <strong>{filteredCatalog.length}</strong> of {totalCount} Azure Resource Types ({categoryNames.length} Categories)
            </span>
            <AuExpandCollapseButton
              allExpanded={allCategoriesExpanded}
              onToggle={handleToggleAllCategories}
            />
          </div>
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

      {/* 3. Resource Catalogue Grouped by Category */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {categoryNames.length === 0 ? (
          <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
            No Azure resource types matched your filter criteria.
          </div>
        ) : (
          categoryNames.map((cat) => {
            const items = groupedCatalog[cat];
            const isExpanded = !!expandedCategories[cat];
            return (
              <div
                key={cat}
                className="au-hud-card"
                style={{
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden"
                }}
              >
                {/* Category Header */}
                <div
                  style={{
                    padding: "12px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderBottom: isExpanded ? "1px solid var(--border-subtle)" : "none",
                    transition: "background 0.2s ease"
                  }}
                  onClick={() => toggleCategory(cat)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ color: "var(--text-muted)" }}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                      {cat}
                    </span>
                    <span className="au-badge au-badge-mint" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
                      {items.length} types
                    </span>
                  </div>
                  <span className="au-mono-meta" style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {isExpanded ? "Click to collapse" : "Click to expand"}
                  </span>
                </div>

                {/* Table for this Category */}
                {isExpanded && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.05em" }}>
                          <th style={{ padding: "12px 18px" }}>Resource Type & Provider</th>
                          <th style={{ padding: "12px 14px" }}>Category & Scope</th>
                          <th style={{ padding: "12px 14px" }}>CAF Abbr</th>
                          <th style={{ padding: "12px 14px" }}>Active Standard</th>
                          <th style={{ padding: "12px 14px" }}>Platform Constraints</th>
                          <th style={{ padding: "12px 14px" }}>Tag Governance</th>
                          <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
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
                })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
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
