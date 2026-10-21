import React, { useState, useMemo, useEffect } from "react";
import {
  AVAILABLE_TOKENS,
  toSampleName,
  validateCandidateName,
  getEnrichedResourceMeta,
  validateAzurePlatformConstraints,
  validatePatternStructure,
  autoFixPatternForResource,
  DEFAULT_VM_WINDOWS_PATTERN,
  DEFAULT_VM_LINUX_PATTERN
} from "../engine/tokenParser.js";
import { AZURE_NAMING_CATALOG } from "../data/azureNamingCatalog.js";
import {
  BUILTIN_NAMING_TEMPLATES,
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate
} from "../data/namingTemplates.js";
import {
  AuHudCard,
  AuButton,
  AuBadge,
  AuExpandCollapseButton,
  AuSelect,
  AuTokenChip,
  validateNamingPattern,
} from "../theme";

import {
  Layers,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  HelpCircle,
  Sparkles,
  Network,
  RotateCcw,
  Check,
  BookOpen,
  Sliders,
  AlertTriangle,
  LayoutTemplate,
  Bookmark,
  Save,
  Trash2,
  Zap,
  ChevronDown,
  ChevronRight
} from "lucide-react";

const EMPTY_OBJ = {};
const EMPTY_ARR = [];

export function NamingStudio({
  customer,
  catalog,
  onUpdateCustomer,
  onAddResourceType,
  onShowToast
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Live Sandbox state
  const [testName, setTestName] = useState("");
  const [testTypeKey, setTestTypeKey] = useState("vm");
  const [testOsType, setTestOsType] = useState("Windows"); // "Windows" | "Linux"
  const [vmOsMode, setVmOsMode] = useState("windows"); // "windows" | "linux"
  const [testRegion, setTestRegion] = useState(
    customer.regions ? Object.values(customer.regions)[0] : "cc"
  );
  const [testPurpose, setTestPurpose] = useState(
    customer.purpose || (customer.purposes && customer.purposes[0]) || "core"
  );

  // Add Resource Type Modal
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [cafSearchQuery, setCafSearchQuery] = useState("");
  const [selectedCafItem, setSelectedCafItem] = useState(null);

  // Curated Naming Templates & Baselines Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("airgate-core");
  const [customTemplates, setCustomTemplates] = useState(() => getCustomTemplates());
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");

  // Dismiss modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showAddTypeModal) {
          setShowAddTypeModal(false);
          setSelectedCafItem(null);
          setCafSearchQuery("");
        }
        if (showTemplateModal) {
          setShowTemplateModal(false);
        }
      }
    };
    if (showAddTypeModal || showTemplateModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showAddTypeModal, showTemplateModal]);
  const [newType, setNewType] = useState({
    key: "",
    name: "",
    resourceType: "",
    abbreviation: "",
    category: "Custom",
    defaultPattern: "{Org}-{SUB}-{ResourceGroup}-{abbreviation}",
    minLength: 1,
    maxLength: 64,
    allowedCharacters: "Alphanumerics and hyphens",
    pattern: "^[a-zA-Z0-9-]{1,64}$",
    scope: "Resource group",
    taggable: true,
    is_override: false,
    caf_abbreviation: "",
    airgate_abbreviation: "",
    doc_url: "",
    description: "Custom user-defined Azure resource type."
  });

  const handleSelectCafItem = (cafItem) => {
    const isOverride = cafItem.is_override;
    const abbr = cafItem.airgate_abbreviation || cafItem.caf_abbreviation;
    setNewType({
      key: abbr,
      name: cafItem.name,
      resourceType: cafItem.provider,
      abbreviation: abbr,
      category: cafItem.category,
      defaultPattern: `{Org}-{SUB}-{ResourceGroup}-${abbr}`,
      minLength: cafItem.minLength || 1,
      maxLength: cafItem.maxLength || 64,
      allowedCharacters: cafItem.allowedCharacters || "Alphanumerics and hyphens",
      pattern: cafItem.pattern || `^[a-zA-Z0-9-_]{${cafItem.minLength || 1},${cafItem.maxLength || 64}}$`,
      scope: cafItem.scope || "Resource group",
      taggable: cafItem.taggable !== false,
      caf_abbreviation: cafItem.caf_abbreviation,
      airgate_abbreviation: cafItem.airgate_abbreviation,
      is_override: isOverride,
      doc_url: cafItem.doc_url || "",
      description: `${cafItem.name} (${cafItem.category}) - ${cafItem.scope} scope.`
    });
    setSelectedCafItem(cafItem);
    setCafSearchQuery("");
  };

  const namingRules = customer.namingRules || EMPTY_OBJ;
  const customPatterns = namingRules.customPatterns || EMPTY_OBJ;
  const unrestrictedTypes = namingRules.unrestrictedTypes || EMPTY_ARR;
  const subnetAllowed = namingRules.subnetNaming?.allowedNames || [];
  const [newSubnetName, setNewSubnetName] = useState("");

  const categories = ["All", ...new Set(catalog.map((c) => c.category || "General"))];

  const filteredCatalog = catalog.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.resourceType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
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


  // Handler for updating a type's custom pattern
  const handlePatternChange = (key, newPattern) => {
    const updated = {
      ...customer,
      namingRules: {
        ...namingRules,
        customPatterns: {
          ...customPatterns,
          [key]: newPattern
        }
      }
    };
    onUpdateCustomer(updated);
  };

  // Bulk Apply AirGate Patterns to All Resources
  const handleApplyAirGateToAll = () => {
    const updatedPatterns = { ...customPatterns };
    catalog.forEach((item) => {
      if (item.key === "vm") {
        updatedPatterns.vm_windows = DEFAULT_VM_WINDOWS_PATTERN;
        updatedPatterns.vm_linux = DEFAULT_VM_LINUX_PATTERN;
        updatedPatterns.vm = DEFAULT_VM_WINDOWS_PATTERN;
      } else {
        updatedPatterns[item.key] = item.defaultPattern || `{Org}-{SUB}-{ResourceGroup}-${item.abbreviation}`;
      }
    });
    onUpdateCustomer({
      ...customer,
      namingRules: { ...namingRules, customPatterns: updatedPatterns }
    });
    onShowToast("Applied AirGate standard patterns to all resource types!");
  };

  // Bulk Apply Microsoft CAF Patterns to All Resources
  const handleApplyCafToAll = () => {
    const updatedPatterns = { ...customPatterns };
    catalog.forEach((item) => {
      if (item.key === "vm") {
        updatedPatterns.vm_windows = "vm-{workload}-{env}";
        updatedPatterns.vm_linux = item.cafPattern || "vm-{workload}-{env}-{region}";
        updatedPatterns.vm = item.cafPattern || "vm-{workload}-{env}-{region}";
      } else {
        updatedPatterns[item.key] = item.cafPattern || `${item.abbreviation}-{workload}-{env}-{region}`;
      }
    });
    onUpdateCustomer({
      ...customer,
      namingRules: { ...namingRules, customPatterns: updatedPatterns }
    });
    onShowToast("Applied Microsoft CAF default patterns to all resource types!");
  };

  // Template Application Handler
  const handleApplyTemplate = (template) => {
    const newCustomPatterns = { ...customPatterns };

    if (template.patterns && Object.keys(template.patterns).length > 0) {
      Object.entries(template.patterns).forEach(([k, pat]) => {
        newCustomPatterns[k] = pat;
      });
    } else {
      catalog.forEach((item) => {
        newCustomPatterns[item.key] = item.defaultPattern || `{Org}-{SUB}-{ResourceGroup}-${item.abbreviation}`;
      });
    }

    let newUnrestricted = [...unrestrictedTypes];
    if (template.resourceKeys && template.resourceKeys.length > 0) {
      newUnrestricted = catalog
        .filter((item) => !template.resourceKeys.includes(item.key))
        .map((item) => item.key);
    } else {
      newUnrestricted = [];
    }

    const updated = {
      ...customer,
      namingRules: {
        ...namingRules,
        customPatterns: newCustomPatterns,
        unrestrictedTypes: newUnrestricted,
        subnetNaming: {
          ...namingRules.subnetNaming,
          allowedNames: template.subnetAllowed || subnetAllowed
        }
      }
    };

    onUpdateCustomer(updated);
    setShowTemplateModal(false);
    onShowToast(`Applied baseline template "${template.name}" to ${customer.name}!`);
  };

  // Save Current Workspace as Custom Template
  const handleSaveCurrentAsTemplate = () => {
    if (!newTemplateName.trim()) return;
    const newTpl = {
      id: `tpl-${Date.now()}`,
      name: newTemplateName.trim(),
      category: "Custom",
      badge: `${catalog.filter((i) => !unrestrictedTypes.includes(i.key)).length} Types`,
      description: newTemplateDesc.trim() || `Custom naming baseline saved from ${customer.name}.`,
      patterns: { ...customPatterns },
      resourceKeys: catalog.filter((i) => !unrestrictedTypes.includes(i.key)).map((i) => i.key),
      subnetAllowed: [...subnetAllowed]
    };
    const updatedList = saveCustomTemplate(newTpl);
    setCustomTemplates(updatedList);
    setSelectedTemplateId(newTpl.id);
    setNewTemplateName("");
    setNewTemplateDesc("");
    onShowToast(`Saved custom baseline template "${newTpl.name}"!`);
  };

  const handleDeleteTemplate = (id) => {
    const updated = deleteCustomTemplate(id);
    setCustomTemplates(updated);
    setSelectedTemplateId("airgate-core");
    onShowToast("Template removed.");
  };

  // Handler for toggling unrestricted / direct creation
  const handleToggleUnrestricted = (key) => {
    const isUnrestricted = unrestrictedTypes.includes(key);
    const newUnrestricted = isUnrestricted
      ? unrestrictedTypes.filter((k) => k !== key)
      : [...unrestrictedTypes, key];

    const updated = {
      ...customer,
      namingRules: {
        ...namingRules,
        unrestrictedTypes: newUnrestricted
      }
    };
    onUpdateCustomer(updated);
    onShowToast(
      isUnrestricted
        ? `Re-enforced naming policy for ${key.toUpperCase()}`
        : `Allowed direct creation for ${key.toUpperCase()} (unrestricted)`
    );
  };

  // Subnet Allowlist handlers
  const handleAddSubnetName = (name) => {
    if (!name) return;
    const candidates = name
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (candidates.length === 0) return;

    const toAdd = candidates.filter((c) => !subnetAllowed.includes(c));
    if (toAdd.length === 0) {
      setNewSubnetName("");
      onShowToast("Subnet(s) already in allowlist");
      return;
    }

    const updated = {
      ...customer,
      namingRules: {
        ...namingRules,
        subnetNaming: {
          ...namingRules.subnetNaming,
          allowedNames: [...subnetAllowed, ...toAdd]
        }
      }
    };
    onUpdateCustomer(updated);
    setNewSubnetName("");
    onShowToast(toAdd.length === 1 ? `Added subnet '${toAdd[0]}' to allowlist` : `Added ${toAdd.length} subnets to allowlist`);
  };

  const handleRemoveSubnetName = (name) => {
    const updated = {
      ...customer,
      namingRules: {
        ...namingRules,
        subnetNaming: {
          ...namingRules.subnetNaming,
          allowedNames: subnetAllowed.filter((n) => n !== name)
        }
      }
    };
    onUpdateCustomer(updated);
  };

  // Live Sandbox validation calculation
  const currentTestItem = catalog.find((i) => i.key === testTypeKey) || catalog[0];
  const isTestVm = testTypeKey === "vm" || (currentTestItem?.resourceType || "").toLowerCase().includes("virtualmachines");
  const effectiveTestPattern = isTestVm
    ? (testOsType === "Windows"
        ? (customPatterns.vm_windows || DEFAULT_VM_WINDOWS_PATTERN)
        : (customPatterns.vm_linux || customPatterns.vm || DEFAULT_VM_LINUX_PATTERN))
    : (customPatterns[testTypeKey] || namingRules.globalPattern || currentTestItem?.defaultPattern);
  const currentTestPattern = effectiveTestPattern;
  const isTestItemUnrestricted = unrestrictedTypes.includes(testTypeKey);
  const effectivePurpose = testPurpose || customer.purpose || (customer.purposes && customer.purposes[0]) || "core";
  const testValidation = validateCandidateName(
    testName,
    currentTestPattern,
    customer,
    currentTestItem,
    testRegion,
    effectivePurpose,
    { osType: isTestVm ? testOsType : undefined }
  );

  // Calculate platform violations across all active/enforced resources (memoized for high responsiveness)
  const platformViolations = useMemo(() => {
    const list = [];
    catalog
      .filter((item) => !unrestrictedTypes.includes(item.key))
      .forEach((item) => {
        const isVm = item.key === "vm" || (item.resourceType || "").toLowerCase().includes("virtualmachines");
        if (isVm) {
          // 1. Evaluate Windows VM (strict 15-char limit)
          const winPattern = customPatterns.vm_windows || DEFAULT_VM_WINDOWS_PATTERN;
          const winMeta = getEnrichedResourceMeta(item);
          const winSample = toSampleName(winPattern, customer, item, { purpose: effectivePurpose });
          const winSampleVal = validateAzurePlatformConstraints(winSample, winMeta, { osType: "Windows" });
          const winStructVal = validatePatternStructure(winPattern, winMeta, { osType: "Windows" });
          if (!winSampleVal.valid || !winStructVal.valid) {
            list.push({
              item: { ...item, name: `${item.name} (Windows - 15 char limit)`, key: "vm_windows" },
              pattern: winPattern,
              meta: winMeta,
              sampleName: winSample,
              sampleVal: winSampleVal,
              structVal: winStructVal,
              isValid: false,
              autoFix: null // strict warning only
            });
          }

          // 2. Evaluate Linux VM (64-char limit)
          const linuxPattern = customPatterns.vm_linux || customPatterns.vm || DEFAULT_VM_LINUX_PATTERN;
          const linuxMeta = getEnrichedResourceMeta(item);
          const linuxSample = toSampleName(linuxPattern, customer, item, { purpose: effectivePurpose });
          const linuxSampleVal = validateAzurePlatformConstraints(linuxSample, linuxMeta, { osType: "Linux" });
          const linuxStructVal = validatePatternStructure(linuxPattern, linuxMeta, { osType: "Linux" });
          if (!linuxSampleVal.valid || !linuxStructVal.valid) {
            list.push({
              item: { ...item, name: `${item.name} (Linux - 64 char limit)`, key: "vm_linux" },
              pattern: linuxPattern,
              meta: linuxMeta,
              sampleName: linuxSample,
              sampleVal: linuxSampleVal,
              structVal: linuxStructVal,
              isValid: false,
              autoFix: autoFixPatternForResource(linuxPattern, linuxMeta)
            });
          }
        } else {
          const airgatePattern = item.defaultPattern || `{Org}-{SUB}-{ResourceGroup}-${item.abbreviation}`;
          const pattern = customPatterns[item.key] || item.defaultPattern || airgatePattern;
          const meta = getEnrichedResourceMeta(item);
          const sampleName = toSampleName(pattern, customer, item, { purpose: effectivePurpose });
          const sampleVal = validateAzurePlatformConstraints(sampleName, meta);
          const structVal = validatePatternStructure(pattern, meta);
          const isValid = sampleVal.valid && structVal.valid;
          if (!isValid) {
            list.push({
              item,
              pattern,
              meta,
              sampleName,
              sampleVal,
              structVal,
              isValid,
              autoFix: autoFixPatternForResource(pattern, meta)
            });
          }
        }
      });
    return list;
  }, [catalog, unrestrictedTypes, customPatterns, customer, effectivePurpose]);

  const handleAutoFixAll = () => {
    const updatedPatterns = { ...customPatterns };
    platformViolations.forEach((v) => {
      if (v.autoFix && v.autoFix !== v.pattern) {
        updatedPatterns[v.item.key] = v.autoFix;
      }
    });
    const updated = {
      ...customer,
      namingRules: {
        ...namingRules,
        customPatterns: updatedPatterns
      }
    };
    onUpdateCustomer(updated);
    if (onShowToast) {
      onShowToast(`Auto-fixed ${platformViolations.length} resource pattern(s) to comply with Azure platform limits.`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Azure Platform Constraints Global Warning Banner */}
      {platformViolations.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            background: "var(--status-danger-bg)",
            border: "1px solid var(--status-danger-border)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "var(--status-danger-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--status-danger-text)"
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--status-danger-text)" }}>
                {platformViolations.length} Resource Naming Pattern{platformViolations.length > 1 ? "s" : ""} Violate Azure Platform Constraints
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Azure ARM will fail resource creation if names exceed length bounds or contain forbidden characters (e.g., Storage Accounts reject hyphens & uppercase).
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              fontWeight: "600",
              fontSize: "0.8rem"
            }}
            onClick={handleAutoFixAll}
          >
            <Zap size={15} /> Auto-Fix All Violations ({platformViolations.length})
          </button>
        </div>
      )}

      {/* 1. Global Pattern Bar & Dynamic Token Chips */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={20} color="var(--azure-cyan)" />
              Naming Convention Pattern Engine
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
              Build dynamic naming rules with smart tokens. Abbreviation tokens: <code>{`{Org}`}</code>, <code>{`{org}`}</code>, <code>{`{SUB}`}</code>, <code>{`{ENV}`}</code>, <code>{`{RG}`}</code>. Full-name tokens: <code>{`{ORGNAME}`}</code>, <code>{`{SUBNAME}`}</code>, <code>{`{ENVNAME}`}</code>, <code>{`{ResourceGroup}`}</code> (wildcards evaluate to <code>*</code> in Azure Policy).
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowTemplateModal(true)}
              title="Load a curated naming baseline (AirGate Core, AI Workloads, Microservices) or save custom template"
            >
              <LayoutTemplate size={16} />
              <span>Baselines & Templates</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddTypeModal(true)}>
              <Plus size={16} />
              <span>Add Resource Type</span>
            </button>
          </div>
        </div>

        {/* Token Chips */}
        <div>
          <span className="form-label" style={{ marginBottom: "8px" }}>Quick-Insert Tokens</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {AVAILABLE_TOKENS.map((t) => (
              <AuTokenChip
                key={t.token}
                token={t.token}
                example={t.example}
                description={t.description}
                onInsert={(tok) => {
                  navigator.clipboard.writeText(tok);
                  onShowToast(`Copied token ${tok} to clipboard!`);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 2. Interactive Live Sandbox Validator */}
      <AuHudCard
        kicker="INTERACTIVE TEST BENCH"
        title="Live Azure Resource Name Compliance Sandbox"
        meta="Real-time Cloud Adoption Framework (CAF) regex & ARM platform constraint evaluator"
        action={
          <AuButton
            variant="secondary"
            size="sm"
            onClick={() => {
              const sample = toSampleName(currentTestPattern, customer, currentTestItem, { region: testRegion, purpose: effectivePurpose });
              setTestName(sample);
              onShowToast(`Populated sample: ${sample}`);
            }}
            icon={<Sparkles size={13} style={{ color: "var(--accent-mint)" }} />}
          >
            Auto-Generate Sample
          </AuButton>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: isTestVm ? "220px 170px 170px 150px 1fr" : "220px 170px 150px 1fr", gap: "12px", alignItems: "flex-end" }}>
          <div>
            <AuSelect
              id="sandbox-resource-type"
              label="Resource Type"
              searchable={true}
              value={testTypeKey}
              onChange={setTestTypeKey}
              options={catalog.map((c) => ({
                value: c.key,
                label: c.name,
                badge: c.abbreviation
              }))}
            />
          </div>

          {isTestVm && (
            <div>
              <AuSelect
                id="sandbox-os-type"
                label="OS Platform"
                value={testOsType}
                onChange={setTestOsType}
                options={[
                  { value: "Windows", label: "Windows (15 max)", badge: "🪟 Win" },
                  { value: "Linux", label: "Linux (64 max)", badge: "🐧 Lnx" }
                ]}
              />
            </div>
          )}

          <div>
            <AuSelect
              id="sandbox-region"
              label="Region"
              value={testRegion}
              onChange={setTestRegion}
              options={Object.entries(customer.regions || {}).map(([loc, code]) => ({
                value: code,
                label: loc,
                badge: code
              }))}
            />
          </div>

          <div>
            <AuSelect
              id="sandbox-purpose"
              label="Purpose"
              value={testPurpose}
              onChange={setTestPurpose}
              options={(customer.purposes && customer.purposes.length > 0
                ? customer.purposes
                : ["hub", "core", "monitoring", "infrafw", "apps"]
              ).map((p) => ({ value: p, label: p }))}
            />
          </div>


          <div>
            <label className="form-label" htmlFor="sandbox-test-name">Test Candidate Name</label>
            <input
              id="sandbox-test-name"
              name="sandbox_test_name"
              aria-label="Enter candidate name to evaluate compliance"
              type="text"
              className="form-input form-input-mono"
              placeholder={`e.g. ${toSampleName(currentTestPattern, customer, currentTestItem, { region: testRegion, purpose: effectivePurpose })}`}
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </div>
        </div>

        {/* Validation Result Box */}
        {testName.trim() && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px 16px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              background: isTestItemUnrestricted
                ? "var(--bg-canvas)"
                : testValidation.valid
                ? "var(--accent-mint-tint)"
                : "var(--accent-rose-tint)",
              border: `1px solid ${
                isTestItemUnrestricted
                  ? "var(--border-hairline)"
                  : testValidation.valid
                  ? "var(--accent-mint)"
                  : "var(--accent-rose)"
              }`
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
              {isTestItemUnrestricted ? (
                <HelpCircle size={20} color="var(--text-muted)" style={{ marginTop: "2px", flexShrink: 0 }} />
              ) : testValidation.valid ? (
                <CheckCircle size={20} color="var(--accent-mint)" style={{ marginTop: "2px", flexShrink: 0 }} />
              ) : (
                <XCircle size={20} color="var(--accent-rose)" style={{ marginTop: "2px", flexShrink: 0 }} />
              )}

              <div>
                <div style={{ fontWeight: "700", fontSize: "0.9rem" }}>
                  {isTestItemUnrestricted
                    ? "UNRESTRICTED: Direct creation allowed without naming restrictions."
                    : testValidation.valid
                    ? "COMPLIANT: Allowed by Azure Policy & Valid Azure ARM Name"
                    : !testValidation.platformValid
                    ? "ARM PLATFORM REJECTION: Fails Azure Physical Constraints"
                    : "NON-COMPLIANT: Would be blocked or audited by Azure Policy"}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {testValidation.reason}
                </div>
                {testValidation.errors && testValidation.errors.length > 1 && (
                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "0.75rem", color: "var(--accent-rose)" }}>
                    {testValidation.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                )}
                {testValidation.warnings && testValidation.warnings.length > 0 && (
                  <div style={{ marginTop: "4px", fontSize: "0.75rem", color: "var(--accent-amber)" }}>
                    ⚠️ {testValidation.warnings.join("; ")}
                  </div>
                )}
              </div>
            </div>

            {testValidation.length !== undefined && !isTestItemUnrestricted && (
              <span
                className="au-badge"
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  borderColor:
                    testValidation.length > testValidation.maxLength ||
                    testValidation.length < testValidation.minLength
                      ? "var(--accent-rose)"
                      : "var(--accent-mint)",
                  color:
                    testValidation.length > testValidation.maxLength ||
                    testValidation.length < testValidation.minLength
                      ? "var(--accent-rose)"
                      : "var(--accent-mint)"
                }}
              >
                {testValidation.length} / {testValidation.maxLength} chars
              </span>
            )}
          </div>
        )}
      </AuHudCard>

      {/* 3. Subnet Allowlist Special Module */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Network size={18} color="var(--azure-cyan)" />
          <h3 style={{ fontSize: "1.05rem", fontWeight: "700" }}>Subnet Naming Allowlist</h3>
          <span className="chip chip-purple" style={{ marginLeft: "auto" }}>Standalone & Inline Array Rules</span>
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "14px" }}>
          In Azure Landing Zones, subnets require approved naming allowlists rather than open regex patterns to avoid breaking Azure reserved subnets (e.g., GatewaySubnet, AzureFirewallSubnet).
        </p>

        {/* Subnet Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
          {subnetAllowed.map((name) => (
            <span key={name} className="chip chip-emerald" style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
              <span>{name}</span>
              <button
                onClick={() => handleRemoveSubnetName(name)}
                style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", marginLeft: "4px" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        {/* Add Subnet Input & Quick Presets */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            id="naming-new-subnet-input"
            name="new_subnet_name"
            aria-label="Add new allowed subnet name"
            type="text"
            className="form-input form-input-mono"
            style={{ maxWidth: "300px" }}
            placeholder="Add subnet (e.g. snet-database)"
            value={newSubnetName}
            onChange={(e) => setNewSubnetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubnetName(newSubnetName);
            }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => handleAddSubnetName(newSubnetName)}>
            Add Subnet
          </button>

          <span style={{ color: "var(--text-dim)", fontSize: "0.8rem", margin: "0 6px" }}>| Quick Add:</span>
          {["GatewaySubnet", "AzureBastionSubnet", "AzureFirewallSubnet"].map((preset) => (
            <button
              key={preset}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              disabled={subnetAllowed.includes(preset)}
              onClick={() => handleAddSubnetName(preset)}
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Resource Types Catalogue & Pattern Rules */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: "700" }}>
              Resource Type Naming Rules ({filteredCatalog.length} Types)
            </h3>
            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Customize pattern per resource type, switch to CAF default, or exempt for direct creation.
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Bulk Apply Buttons */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: "0.75rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: "5px" }}
                onClick={handleApplyAirGateToAll}
                title="Reset all resource types to AirGate Standard pattern: {Org}-{SUB}-{ResourceGroup}-{abbr}"
              >
                <Sliders size={13} color="var(--azure-cyan)" />
                Apply AirGate to All
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: "0.75rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: "5px" }}
                onClick={handleApplyCafToAll}
                title="Switch all resource types to Microsoft CAF pattern: {abbr}-{workload}-{env}-{region}"
              >
                <RotateCcw size={13} color="var(--accent-purple)" />
                Apply Azure CAF to All
              </button>
            </div>

            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "12px", color: "var(--text-dim)" }} />
              <input
                id="naming-search-types"
                name="search_types"
                aria-label="Search resource types by name, key or provider"
                type="text"
                className="form-input"
                style={{ paddingLeft: "32px", width: "200px", fontSize: "0.85rem" }}
                placeholder="Search types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div style={{ minWidth: "180px" }}>
              <AuSelect
                id="naming-category-filter"
                aria-label="Filter resource types by category"
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={categories.map((cat) => ({ value: cat, label: cat }))}
              />
            </div>


            <AuExpandCollapseButton
              allExpanded={allCategoriesExpanded}
              onToggle={handleToggleAllCategories}
            />
          </div>
        </div>

        {/* Resource Cards Grouped by Category */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {categoryNames.length === 0 ? (
            <div className="glass-panel" style={{ padding: "30px", textAlign: "center", color: "var(--text-dim)" }}>
              No resource types matched your filter criteria.
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

                  {isExpanded && (
                    <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "16px" }}>
                      {items.map((item) => {
            const meta = getEnrichedResourceMeta(item);
            const isUnrestricted = unrestrictedTypes.includes(item.key);
            const isVm = item.key === "vm" || (item.resourceType || "").toLowerCase().includes("virtualmachines");
            const vmOs = vmOsMode; // "windows" | "linux"

            let patternKey = item.key;
            let airgatePattern = item.defaultPattern || `{Org}-{SUB}-{ResourceGroup}-${item.abbreviation}`;
            let cafPattern = item.cafPattern || `${item.abbreviation}-{workload}-{env}-{region}`;
            let pattern = customPatterns[item.key] || item.defaultPattern || airgatePattern;

            if (isVm) {
              if (vmOs === "windows") {
                patternKey = "vm_windows";
                airgatePattern = DEFAULT_VM_WINDOWS_PATTERN;
                pattern = customPatterns.vm_windows || DEFAULT_VM_WINDOWS_PATTERN;
              } else {
                patternKey = "vm_linux";
                airgatePattern = DEFAULT_VM_LINUX_PATTERN;
                pattern = customPatterns.vm_linux || customPatterns.vm || DEFAULT_VM_LINUX_PATTERN;
              }
            }

            const isAirGate = pattern === airgatePattern;
            const isCaf = pattern === cafPattern;
            const effectiveOsType = isVm ? (vmOs === "windows" ? "Windows" : "Linux") : undefined;
            const sampleName = toSampleName(pattern, customer, item, { purpose: effectivePurpose });

            const sampleVal = validateAzurePlatformConstraints(sampleName, meta, { osType: effectiveOsType });
            const structVal = validatePatternStructure(pattern, meta, { osType: effectiveOsType });
            const tokenSyntaxVal = validateNamingPattern(pattern);
            const hasError = !isUnrestricted && (!sampleVal.valid || !structVal.valid);
            const autoFixSuggestion = hasError && !isVm ? autoFixPatternForResource(pattern, meta) : null;
            const charCount = sampleName ? sampleName.length : 0;
            const effectiveMax = isVm && vmOs === "windows" ? 15 : (meta.maxLength || 64);
            const isLengthExceeded = charCount > effectiveMax;
            const isLengthTooShort = meta.minLength && charCount < meta.minLength;

            return (
              <div
                key={item.key}
                className="glass-panel"
                style={{
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  opacity: isUnrestricted ? 0.65 : 1,
                  border: isUnrestricted
                    ? "1px dashed var(--border-subtle)"
                    : hasError
                    ? "1px solid rgba(244, 63, 94, 0.5)"
                    : "1px solid var(--border-subtle)",
                  boxShadow: hasError ? "0 0 16px rgba(244, 63, 94, 0.12)" : undefined
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "700", fontSize: "1rem" }}>{item.name}</span>
                      <span className="chip chip-azure" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>
                        {item.abbreviation}
                      </span>
                      <span className="chip" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>
                        {item.category}
                      </span>

                      {/* OS Mode Toggle for VM */}
                      {isVm && (
                        <div
                          style={{
                            display: "inline-flex",
                            background: "rgba(0,0,0,0.35)",
                            borderRadius: "6px",
                            padding: "2px",
                            border: "1px solid var(--border-subtle)"
                          }}
                        >
                          <button
                            type="button"
                            id="vm-os-windows-toggle"
                            className={`btn btn-sm ${vmOs === "windows" ? "btn-outline-azure" : "btn-secondary"}`}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 8px",
                              height: "22px",
                              lineHeight: 1,
                              borderColor: vmOs === "windows" ? "var(--azure-cyan)" : "transparent",
                              fontWeight: vmOs === "windows" ? "700" : "normal"
                            }}
                            onClick={() => setVmOsMode("windows")}
                            title="Windows Virtual Machine (Strict 15-character NetBIOS limit)"
                          >
                            🪟 Windows (15 max)
                          </button>
                          <button
                            type="button"
                            id="vm-os-linux-toggle"
                            className={`btn btn-sm ${vmOs === "linux" ? "btn-outline-azure" : "btn-secondary"}`}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 8px",
                              height: "22px",
                              lineHeight: 1,
                              borderColor: vmOs === "linux" ? "var(--accent-purple)" : "transparent",
                              fontWeight: vmOs === "linux" ? "700" : "normal"
                            }}
                            onClick={() => setVmOsMode("linux")}
                            title="Linux Virtual Machine (Standard 64-character limit)"
                          >
                            🐧 Linux (64 max)
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginTop: "2px" }}
                      title={`Scope: ${meta.scope} | Allowed: ${meta.allowedCharacters} | Length: ${meta.minLength}–${effectiveMax} chars`}
                    >
                      {item.resourceType}
                    </div>

                    {/* Constraints Pill (Only shown when error / violation occurs to keep compliant cards clean) */}
                    {hasError && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                        <span
                          className="chip"
                          style={{
                            fontSize: "0.68rem",
                            padding: "2px 8px",
                            background: "rgba(244, 63, 94, 0.15)",
                            color: "var(--accent-rose)",
                            border: "1px solid rgba(244, 63, 94, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          title={
                            isVm && vmOs === "windows"
                              ? "Windows NetBIOS / Active Directory limitation: strict max 15 characters"
                              : `Scope: ${meta.scope} | Allowed: ${meta.allowedCharacters}`
                          }
                        >
                          <span style={{ fontWeight: "700" }}>
                            📏 Allowed: {meta.minLength}–{effectiveMax} chars
                          </span>
                          <span style={{ opacity: 0.5 }}>•</span>
                          <span>
                            {isVm && vmOs === "windows"
                              ? "Alphanumerics, hyphens (NetBIOS / AD limit)"
                              : meta.allowedCharacters}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Mode Selector */}
                  <button
                    className={`btn btn-sm ${isUnrestricted ? "btn-secondary" : "btn-outline-azure"}`}
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                    onClick={() => handleToggleUnrestricted(item.key)}
                  >
                    {isUnrestricted ? "⚪ Direct Creation" : "🟢 Enforced"}
                  </button>
                </div>

                {/* Pattern Input */}
                {!isUnrestricted && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span className="form-label" style={{ margin: 0 }}>Pattern Syntax</span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span
                          className={`chip ${isAirGate ? "chip-azure" : isCaf ? "chip-purple" : "chip"}`}
                          style={{
                            fontSize: "0.65rem",
                            padding: "2px 7px",
                            background: isAirGate
                              ? "rgba(6, 182, 212, 0.15)"
                              : isCaf
                              ? "rgba(168, 85, 247, 0.15)"
                              : "rgba(255, 255, 255, 0.08)",
                            color: isAirGate
                              ? "var(--azure-cyan)"
                              : isCaf
                              ? "#c084fc"
                              : "var(--text-muted)"
                          }}
                        >
                          {isAirGate ? "AirGate Standard" : isCaf ? "Azure CAF" : "Custom Pattern"}
                        </span>
                        <button
                          type="button"
                          className={`btn btn-sm ${isAirGate ? "btn-outline-azure" : "btn-secondary"}`}
                          style={{
                            fontSize: "0.7rem",
                            padding: "3px 8px",
                            height: "22px",
                            lineHeight: "1",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            borderColor: isAirGate ? "var(--azure-cyan)" : undefined
                          }}
                          onClick={() => handlePatternChange(patternKey, airgatePattern)}
                          title={`Apply AirGate standard pattern: ${airgatePattern}`}
                        >
                          {isAirGate && <Check size={11} />}
                          AirGate
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${isCaf ? "btn-outline-azure" : "btn-secondary"}`}
                          style={{
                            fontSize: "0.7rem",
                            padding: "3px 8px",
                            height: "22px",
                            lineHeight: "1",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            borderColor: isCaf ? "var(--accent-purple)" : undefined
                          }}
                          onClick={() => handlePatternChange(patternKey, cafPattern)}
                          title="Apply Microsoft CAF pattern: {abbr}-{workload}-{env}-{region}"
                        >
                          {isCaf && <Check size={11} />}
                          Azure CAF
                        </button>
                      </div>
                    </div>
                    <input
                      id={`pattern-input-${item.key}`}
                      name={`pattern_${item.key}`}
                      aria-label={`Naming pattern for ${item.name}${isVm ? ` (${vmOs})` : ""}`}
                      type="text"
                      className="form-input form-input-mono"
                      style={{
                        borderColor: hasError ? "var(--accent-rose)" : undefined,
                        background: hasError ? "rgba(244, 63, 94, 0.04)" : undefined
                      }}
                      value={pattern}
                      onChange={(e) => handlePatternChange(patternKey, e.target.value)}
                    />

                    {tokenSyntaxVal && tokenSyntaxVal.warnings.length > 0 && (
                      <div className="au-input-pill au-input-pill-warning" style={{ marginTop: "6px" }}>
                        <span>⚠</span>
                        <span>{tokenSyntaxVal.warnings[0]}</span>
                      </div>
                    )}

                    {/* Constraint Error Callout */}
                    {hasError && (
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          background: "var(--status-danger-bg)",
                          border: "1px solid var(--status-danger-border)",
                          fontSize: "0.75rem",
                          color: "var(--status-danger-text)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "2px", color: "var(--status-danger-text)" }} />
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: "var(--status-danger-text)" }}>Azure Constraint Violation:</strong>
                            <ul style={{ margin: "3px 0 0 14px", padding: 0 }}>
                              {[...structVal.errors, ...sampleVal.errors].slice(0, 2).map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {autoFixSuggestion && autoFixSuggestion !== pattern && (
                          <div
                            style={{
                              marginTop: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              paddingTop: "6px",
                              borderTop: "1px solid rgba(244, 63, 94, 0.2)"
                            }}
                          >
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                              Recommended pattern: <code style={{ color: "var(--azure-cyan)" }}>{autoFixSuggestion}</code>
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              style={{
                                fontSize: "0.7rem",
                                padding: "3px 8px",
                                height: "22px",
                                lineHeight: 1,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              onClick={() => handlePatternChange(item.key, autoFixSuggestion)}
                            >
                              <Zap size={11} /> Auto-Fix
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Sample Preview */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: hasError ? "rgba(244, 63, 94, 0.08)" : "rgba(0,0,0,0.32)",
                    border: hasError ? "1px solid rgba(244, 63, 94, 0.3)" : "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  {/* Top Row: Full-width Sample Candidate Name */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0 }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                      Example:
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.88rem",
                        color: isUnrestricted
                          ? "var(--text-dim)"
                          : hasError
                          ? "var(--accent-rose)"
                          : "var(--azure-cyan)",
                        fontWeight: "600",
                        textDecoration: hasError ? "line-through" : "none",
                        wordBreak: "break-all"
                      }}
                      title={sampleName}
                    >
                      {isUnrestricted ? "(Unrestricted / Any Name Allowed)" : sampleName}
                    </span>
                  </div>

                  {/* Bottom Row: Metrics & Minimalist Status Icon */}
                  {!isUnrestricted && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "6px",
                        borderTop: "1px solid rgba(255, 255, 255, 0.05)"
                      }}
                    >
                      <span
                        className="chip"
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 8px",
                          fontFamily: "var(--font-mono)",
                          background:
                            isLengthExceeded || isLengthTooShort
                              ? "rgba(244, 63, 94, 0.2)"
                              : "rgba(16, 185, 129, 0.12)",
                          color:
                            isLengthExceeded || isLengthTooShort
                              ? "var(--accent-rose)"
                              : "var(--accent-emerald)",
                          borderRadius: "4px"
                        }}
                        title={`Current length: ${charCount} chars (Min: ${meta.minLength}, Max: ${effectiveMax})`}
                      >
                        {charCount} / {effectiveMax} chars
                      </span>

                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: "600",
                          color: hasError ? "var(--accent-rose)" : "var(--accent-emerald)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title={hasError ? "Non-Compliant with Azure constraints" : "Compliant with Azure constraints"}
                      >
                        {hasError ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        <span>{hasError ? "Non-Compliant" : "Compliant"}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Add Custom Resource Type with CAF & AirGate Catalogue Autofill */}
      {showAddTypeModal && (
        <div className="modal-overlay" onClick={() => setShowAddTypeModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: "680px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-resource-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="add-resource-modal-title" style={{ fontSize: "1.15rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <BookOpen size={18} color="var(--azure-cyan)" />
                  Add Azure Resource Type
                </h2>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                  Search 200 Microsoft CAF & AirGate standards for instant autofill of abbreviations, providers & limitations.
                </span>
              </div>
              <button
                onClick={() => {
                  setShowAddTypeModal(false);
                  setSelectedCafItem(null);
                  setCafSearchQuery("");
                }}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* 1. Quick CAF Autocomplete Search */}
              <div style={{ position: "relative" }}>
                <label className="form-label" htmlFor="caf-search-input" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sparkles size={14} color="var(--azure-cyan)" />
                    Quick Pick from 200 CAF & AirGate Resources
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    Type to search by name, abbreviation or provider
                  </span>
                </label>
                <div style={{ position: "relative" }}>
                  <Search size={15} style={{ position: "absolute", left: "10px", top: "12px", color: "var(--text-dim)" }} />
                  <input
                    id="caf-search-input"
                    name="caf_search_query"
                    aria-label="Search 200 CAF and AirGate resources"
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: "32px", fontSize: "0.85rem" }}
                    placeholder="Search e.g. Databricks, OpenAI, Storage, Key Vault, Redis, PostgreSQL..."
                    value={cafSearchQuery}
                    onChange={(e) => setCafSearchQuery(e.target.value)}
                  />
                </div>

                {/* Autocomplete Dropdown List */}
                {cafSearchQuery.trim().length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: "4px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-glow)",
                      borderRadius: "8px",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      zIndex: 100,
                      maxHeight: "240px",
                      overflowY: "auto"
                    }}
                  >
                    {AZURE_NAMING_CATALOG.filter((item) => {
                      const q = cafSearchQuery.toLowerCase();
                      return (
                        item.name.toLowerCase().includes(q) ||
                        item.caf_abbreviation.toLowerCase().includes(q) ||
                        item.airgate_abbreviation.toLowerCase().includes(q) ||
                        item.provider.toLowerCase().includes(q) ||
                        item.category.toLowerCase().includes(q)
                      );
                    }).slice(0, 10).map((cafItem) => (
                      <div
                        key={cafItem.id}
                        onClick={() => handleSelectCafItem(cafItem)}
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "background 0.15s ease"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0, 120, 212, 0.2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div>
                          <div style={{ fontWeight: "600", fontSize: "0.85rem", color: "var(--text-main)" }}>
                            {cafItem.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                            {cafItem.provider}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {cafItem.is_override ? (
                            <span className="chip" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", fontSize: "0.7rem", padding: "2px 6px" }}>
                              AirGate: {cafItem.airgate_abbreviation}
                            </span>
                          ) : (
                            <span className="chip chip-azure" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                              CAF: {cafItem.caf_abbreviation}
                            </span>
                          )}
                          <span className="chip" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                            {cafItem.scope}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Platform Constraints & Governance Card */}
              {(selectedCafItem || newType.name) && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "8px",
                    background: "rgba(0, 120, 212, 0.08)",
                    border: "1px solid rgba(0, 120, 212, 0.25)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Sliders size={16} color="var(--azure-cyan)" />
                      <span style={{ fontWeight: "700", fontSize: "0.85rem" }}>
                        Azure Platform Limitations & Constraints
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span className="chip chip-azure" style={{ fontSize: "0.75rem" }}>
                        Scope: {newType.scope || "Resource group"}
                      </span>
                      <span
                        className="chip"
                        style={{
                          fontSize: "0.75rem",
                          background: newType.taggable ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: newType.taggable ? "#34d399" : "#fbbf24"
                        }}
                      >
                        {newType.taggable ? "✓ Supports Tags" : "⚠️ Untaggable Child"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "0.8rem" }}>
                    <div style={{ background: "rgba(0,0,0,0.25)", padding: "8px 10px", borderRadius: "6px" }}>
                      <span style={{ color: "var(--text-dim)", display: "block" }}>Length Limit:</span>
                      <span style={{ fontWeight: "600", fontFamily: "var(--font-mono)", color: "var(--azure-cyan)" }}>
                        {newType.minLength || 1} to {newType.maxLength || 64} characters
                      </span>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.25)", padding: "8px 10px", borderRadius: "6px" }}>
                      <span style={{ color: "var(--text-dim)", display: "block" }}>Allowed Characters:</span>
                      <span style={{ fontWeight: "600" }}>{newType.allowedCharacters || "Alphanumerics, hyphens"}</span>
                    </div>
                  </div>

                  {newType.is_override && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8rem"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <AlertTriangle size={15} color="#fbbf24" />
                        <span>
                          AirGate Standard: <strong>{newType.airgate_abbreviation}</strong> (Official Microsoft CAF: <code>{newType.caf_abbreviation}</code>)
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                          onClick={() =>
                            setNewType({
                              ...newType,
                              abbreviation: newType.caf_abbreviation,
                              key: newType.caf_abbreviation,
                              defaultPattern: newType.defaultPattern.replace(newType.abbreviation, newType.caf_abbreviation)
                            })
                          }
                        >
                          Use CAF ({newType.caf_abbreviation})
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-azure"
                          style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                          onClick={() =>
                            setNewType({
                              ...newType,
                              abbreviation: newType.airgate_abbreviation,
                              key: newType.airgate_abbreviation,
                              defaultPattern: newType.defaultPattern.replace(newType.abbreviation, newType.airgate_abbreviation)
                            })
                          }
                        >
                          Use AirGate ({newType.airgate_abbreviation})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Form Inputs */}
              <div>
                <label className="form-label" htmlFor="custom-res-display-name">Display Name</label>
                <input
                  id="custom-res-display-name"
                  name="custom_res_display_name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Azure Databricks Workspace"
                  value={newType.name}
                  onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" htmlFor="custom-res-key">Short Key</label>
                  <input
                    id="custom-res-key"
                    name="custom_res_key"
                    type="text"
                    className="form-input form-input-mono"
                    placeholder="e.g. dbw"
                    value={newType.key}
                    onChange={(e) => setNewType({ ...newType, key: e.target.value.toLowerCase() })}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="custom-res-abbr">Abbreviation</label>
                  <input
                    id="custom-res-abbr"
                    name="custom_res_abbr"
                    type="text"
                    className="form-input form-input-mono"
                    placeholder="e.g. dbw"
                    value={newType.abbreviation}
                    onChange={(e) => setNewType({ ...newType, abbreviation: e.target.value.toLowerCase() })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="custom-res-provider">Azure Resource Provider String</label>
                <input
                  id="custom-res-provider"
                  name="custom_res_provider"
                  type="text"
                  className="form-input form-input-mono"
                  placeholder="e.g. Microsoft.Databricks/workspaces"
                  value={newType.resourceType}
                  onChange={(e) => setNewType({ ...newType, resourceType: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" htmlFor="custom-res-minlen">Min Length</label>
                  <input
                    id="custom-res-minlen"
                    name="custom_res_minlen"
                    type="number"
                    className="form-input form-input-mono"
                    min="1"
                    max="260"
                    value={newType.minLength || 1}
                    onChange={(e) => setNewType({ ...newType, minLength: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="custom-res-maxlen">Max Length</label>
                  <input
                    id="custom-res-maxlen"
                    name="custom_res_maxlen"
                    type="number"
                    className="form-input form-input-mono"
                    min="1"
                    max="260"
                    value={newType.maxLength || 64}
                    onChange={(e) => setNewType({ ...newType, maxLength: parseInt(e.target.value, 10) || 64 })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="custom-res-chars">Allowed Characters Rule</label>
                <input
                  id="custom-res-chars"
                  name="custom_res_chars"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Alphanumerics, hyphens, underscores"
                  value={newType.allowedCharacters || ""}
                  onChange={(e) => setNewType({ ...newType, allowedCharacters: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="custom-res-pattern">Default Naming Pattern</label>
                <input
                  id="custom-res-pattern"
                  name="custom_res_pattern"
                  type="text"
                  className="form-input form-input-mono"
                  placeholder="{Org}-{SUB}-{ResourceGroup}-dbw"
                  value={newType.defaultPattern}
                  onChange={(e) => setNewType({ ...newType, defaultPattern: e.target.value })}
                />
              </div>

              {/* Sample Preview */}
              {newType.defaultPattern && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Example Name:</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85rem",
                      color: "var(--azure-cyan)",
                      fontWeight: "600"
                    }}
                  >
                    {toSampleName(newType.defaultPattern, customer, newType)}
                  </span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowAddTypeModal(false);
                  setSelectedCafItem(null);
                  setCafSearchQuery("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!newType.key || !newType.name || !newType.resourceType}
                onClick={() => {
                  onAddResourceType(newType);
                  setShowAddTypeModal(false);
                  setSelectedCafItem(null);
                  setCafSearchQuery("");
                  onShowToast(`Added resource type ${newType.name} (${newType.abbreviation}) to Naming Rules!`);
                }}
              >
                <Plus size={16} />
                Add Resource Type to Naming Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Curated Naming Baselines & Templates */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: "900px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="template-modal-title" style={{ fontSize: "1.15rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <LayoutTemplate size={18} color="var(--azure-cyan)" />
                  Curated Naming Baselines & Workload Templates
                </h2>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                  Load production-tested naming rules across your workloads or save custom baselines dynamically resolved for {customer.name}.
                </span>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "20px", alignItems: "start" }}>
              {/* Left Column: Template Selection List & Save Current */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", fontWeight: "600" }}>
                  Available Baselines
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[...BUILTIN_NAMING_TEMPLATES, ...customTemplates].map((tpl) => {
                    const isSelected = tpl.id === selectedTemplateId;
                    const isCustom = tpl.category === "Custom";

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          background: isSelected ? "rgba(0, 120, 212, 0.15)" : "rgba(255, 255, 255, 0.03)",
                          border: isSelected ? "1px solid var(--azure-cyan)" : "1px solid var(--border-subtle)",
                          boxShadow: isSelected ? "0 0 12px rgba(6, 182, 212, 0.2)" : "none",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontWeight: "700", fontSize: "0.9rem", color: isSelected ? "var(--azure-cyan)" : "var(--text-main)" }}>
                            {tpl.name}
                          </span>
                          <span
                            className="chip"
                            style={{
                              fontSize: "0.65rem",
                              padding: "2px 6px",
                              background: isCustom ? "rgba(168, 85, 247, 0.2)" : "rgba(6, 182, 212, 0.15)",
                              color: isCustom ? "#c084fc" : "var(--azure-cyan)"
                            }}
                          >
                            {tpl.badge || tpl.category}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", margin: 0, lineHeight: "1.3" }}>
                          {tpl.description}
                        </p>
                        {isCustom && (
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                            <button
                              type="button"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--accent-rose)",
                                cursor: "pointer",
                                fontSize: "0.7rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete custom template "${tpl.name}"?`)) {
                                  handleDeleteTemplate(tpl.id);
                                }
                              }}
                            >
                              <Trash2 size={11} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Save Current Workspace as Custom Baseline */}
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "8px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px dashed var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginTop: "6px"
                  }}
                >
                  <span style={{ fontSize: "0.8rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", color: "var(--text-main)" }}>
                    <Save size={13} color="var(--azure-cyan)" />
                    Save Current Rules as Baseline
                  </span>
                  <input
                    id="new-template-name"
                    name="new_template_name"
                    aria-label="Custom baseline template name"
                    type="text"
                    className="form-input"
                    style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                    placeholder="Template Name (e.g. Acme ALZ v1)"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                  />
                  <input
                    id="new-template-desc"
                    name="new_template_desc"
                    aria-label="Custom baseline template description"
                    type="text"
                    className="form-input"
                    style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                    placeholder="Short description..."
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem", padding: "6px 10px", width: "100%" }}
                    disabled={!newTemplateName.trim()}
                    onClick={handleSaveCurrentAsTemplate}
                  >
                    <Bookmark size={13} />
                    Save Custom Baseline
                  </button>
                </div>
              </div>

              {/* Right Column: Template Deep-Dive & Live Dynamic Previews */}
              {(() => {
                const allTpls = [...BUILTIN_NAMING_TEMPLATES, ...customTemplates];
                const activeTpl = allTpls.find((t) => t.id === selectedTemplateId) || allTpls[0];
                if (!activeTpl) return null;

                // Pick key catalog items to show sample resolution
                const sampleItems = (activeTpl.resourceKeys && activeTpl.resourceKeys.length > 0)
                  ? catalog.filter((i) => activeTpl.resourceKeys.includes(i.key)).slice(0, 6)
                  : catalog.slice(0, 6);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: "700" }}>{activeTpl.name}</span>
                        <span className="chip chip-azure" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                          {activeTpl.badge || activeTpl.category}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "12px", lineHeight: "1.4" }}>
                        {activeTpl.description}
                      </p>

                      <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--text-dim)", flexWrap: "wrap" }}>
                        <span>
                          Enforced Types:{" "}
                          <strong style={{ color: "var(--azure-cyan)" }}>
                            {activeTpl.resourceKeys ? activeTpl.resourceKeys.length : catalog.length}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Unrestricted (Direct Creation):{" "}
                          <strong style={{ color: "var(--text-muted)" }}>
                            {activeTpl.resourceKeys ? catalog.length - activeTpl.resourceKeys.length : 0}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Subnets:{" "}
                          <strong style={{ color: "var(--azure-cyan)" }}>
                            {activeTpl.subnetAllowed ? activeTpl.subnetAllowed.length : 0}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Live Sample Previews for this Customer Profile */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-muted)" }}>
                          Live Name Compliance for {customer.name} ({customer.abbreviation}):
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                          {customer.subscriptionName || "Production"} ({customer.subscriptionCode || "AIP"})
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {sampleItems.map((item) => {
                          const customPat = activeTpl.patterns ? activeTpl.patterns[item.key] : null;
                          const patternToUse = customPat || item.defaultPattern || `{Org}-{SUB}-{ResourceGroup}-${item.abbreviation}`;
                          const sample = toSampleName(patternToUse, customer, item);

                          return (
                            <div
                              key={item.key}
                              style={{
                                padding: "8px 12px",
                                borderRadius: "6px",
                                background: "rgba(0, 0, 0, 0.35)",
                                border: "1px solid rgba(255, 255, 255, 0.05)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "var(--text-main)" }}>
                                  {item.name}
                                </span>
                                <span className="chip" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                                  {item.abbreviation}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "0.85rem",
                                  color: "var(--azure-cyan)",
                                  fontWeight: "600"
                                }}
                              >
                                {sample}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subnet Governance Preview */}
                    {activeTpl.subnetAllowed && activeTpl.subnetAllowed.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-muted)" }}>
                          Permitted Subnet Architecture:
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {activeTpl.subnetAllowed.map((snet) => (
                            <span
                              key={snet}
                              className="chip"
                              style={{
                                fontSize: "0.75rem",
                                padding: "3px 8px",
                                fontFamily: "var(--font-mono)",
                                background: "rgba(16, 185, 129, 0.12)",
                                color: "#34d399",
                                border: "1px solid rgba(16, 185, 129, 0.25)"
                              }}
                            >
                              {snet}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background: "rgba(14, 165, 233, 0.08)",
                        border: "1px solid rgba(14, 165, 233, 0.25)",
                        fontSize: "0.75rem",
                        color: "var(--azure-cyan)",
                        lineHeight: "1.4"
                      }}
                    >
                      💡 <strong>Dynamic customer resolution:</strong> Applying this template will bind formulas against {customer.name}'s codes ({`{Org}=`}{customer.abbreviation}, {`{SUB}=`}{customer.subscriptionCode || "AIP"}, {`{Region}=`}{Object.values(customer.regions || {})[0] || "cc"}).
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>
                Cancel
              </button>
              {(() => {
                const allTpls = [...BUILTIN_NAMING_TEMPLATES, ...customTemplates];
                const activeTpl = allTpls.find((t) => t.id === selectedTemplateId) || allTpls[0];
                return (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (activeTpl) {
                        handleApplyTemplate(activeTpl);
                      }
                    }}
                  >
                    <Check size={16} />
                    Apply {activeTpl ? `"${activeTpl.name}"` : "Template"} to {customer.name}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
