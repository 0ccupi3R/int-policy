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
import NAMING_TOKENS_CONFIG from "../data/naming-tokens.json";
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
  AuWarningBanner,
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
  ChevronRight,
  Filter,
  ArrowDown,
  Braces,
  X,
  Star,
  ChevronLeft
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
  const [filterOnlyViolations, setFilterOnlyViolations] = useState(false);

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

  // Token Palette Drawer state
  const [tokenDrawerOpen, setTokenDrawerOpen] = useState(false);
  const [activePatternTarget, setActivePatternTarget] = useState(null); // { key, patternKey }

  // Token Delimiter mode state: "hyphen" | "underscore" | "none"
  const [tokenDelimiter, setTokenDelimiter] = useState(() => {
    try {
      return localStorage.getItem("alz_token_delimiter_mode") || "hyphen";
    } catch {
      return "hyphen";
    }
  });

  // Token Favorites state: array of token IDs
  const [tokenFavorites, setTokenFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("alz_naming_token_favorites");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return NAMING_TOKENS_CONFIG.filter((t) => t.isDefaultFavorite).map((t) => t.id);
  });

  // Token palette search query
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");

  const handleToggleFavorite = (tokenId, e) => {
    if (e) e.stopPropagation();
    setTokenFavorites((prev) => {
      const next = prev.includes(tokenId) ? prev.filter((id) => id !== tokenId) : [...prev, tokenId];
      try {
        localStorage.setItem("alz_naming_token_favorites", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleChangeDelimiter = (mode) => {
    setTokenDelimiter(mode);
    try {
      localStorage.setItem("alz_token_delimiter_mode", mode);
    } catch {
      // ignore
    }
  };

  const handleInsertToken = (tokenStr) => {
    if (activePatternTarget) {
      if (activePatternTarget.key === "newType") {
        setNewType((prev) => {
          const prevPat = prev.defaultPattern || "";
          let toAdd = tokenStr;
          if (tokenDelimiter === "hyphen") toAdd = `${tokenStr}-`;
          else if (tokenDelimiter === "underscore") toAdd = `${tokenStr}_`;
          return {
            ...prev,
            defaultPattern: prevPat ? `${prevPat}${tokenDelimiter === "none" ? "-" : ""}${toAdd}` : toAdd
          };
        });
        onShowToast(`Inserted ${tokenStr} into custom type pattern`);
        return;
      }

      const inputEl =
        document.getElementById(`pattern-input-${activePatternTarget.key}`) ||
        document.getElementById(`pattern-input-${activePatternTarget.patternKey}`);

      // 1. Primary ground truth: live DOM value from the focused input
      // 2. Secondary: customPatterns entry
      // 3. Fallback: item.defaultPattern or standard airgatePattern
      let currentPattern = "";
      if (inputEl && typeof inputEl.value === "string") {
        currentPattern = inputEl.value;
      } else if (customPatterns[activePatternTarget.patternKey]) {
        currentPattern = customPatterns[activePatternTarget.patternKey];
      } else {
        const foundItem = catalog.find((c) => c.key === activePatternTarget.key || c.key === activePatternTarget.patternKey);
        currentPattern = foundItem?.defaultPattern || (foundItem?.abbreviation ? `{Org}-{SUB}-{ResourceGroup}-${foundItem.abbreviation}` : `{Org}-{SUB}-{ResourceGroup}`);
      }

      let nextPattern = currentPattern;

      if (inputEl) {
        const start = inputEl.selectionStart ?? currentPattern.length;
        const end = inputEl.selectionEnd ?? currentPattern.length;

        // Apply delimiter setting, avoiding duplicate delimiters if adjacent character is already the same delimiter
        let formattedToken = tokenStr;
        if (tokenDelimiter === "hyphen") {
          const nextChar = currentPattern.charAt(end);
          formattedToken = nextChar === "-" ? tokenStr : `${tokenStr}-`;
        } else if (tokenDelimiter === "underscore") {
          const nextChar = currentPattern.charAt(end);
          formattedToken = nextChar === "_" ? tokenStr : `${tokenStr}_`;
        }

        nextPattern = currentPattern.slice(0, start) + formattedToken + currentPattern.slice(end);
        handlePatternChange(activePatternTarget.patternKey, nextPattern);

        setTimeout(() => {
          inputEl.focus();
          const newPos = start + formattedToken.length;
          inputEl.setSelectionRange(newPos, newPos);
        }, 15);
      } else {
        let formattedToken = tokenStr;
        if (tokenDelimiter === "hyphen") formattedToken = `${tokenStr}-`;
        else if (tokenDelimiter === "underscore") formattedToken = `${tokenStr}_`;

        nextPattern = currentPattern ? `${currentPattern}-${formattedToken}` : formattedToken;
        handlePatternChange(activePatternTarget.patternKey, nextPattern);
      }
      onShowToast(`Inserted ${tokenStr} into pattern`);
    } else {
      navigator.clipboard.writeText(tokenStr);
      onShowToast(`Copied ${tokenStr} to clipboard!`);
    }
  };

  // Dismiss modals and drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (tokenDrawerOpen) {
          setTokenDrawerOpen(false);
        }
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
    if (showAddTypeModal || showTemplateModal || tokenDrawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showAddTypeModal, showTemplateModal, tokenDrawerOpen]);

  const activeTargetItem = activePatternTarget
    ? catalog.find((c) => c.key === activePatternTarget.key || c.key === activePatternTarget.patternKey)
    : null;
  const activeTargetLabel =
    activePatternTarget?.key === "newType"
      ? "Custom Type"
      : activeTargetItem?.name || activePatternTarget?.key || "Select Input";

  const filteredTokens = useMemo(() => {
    if (!tokenSearchQuery.trim()) return NAMING_TOKENS_CONFIG;
    const q = tokenSearchQuery.toLowerCase();
    return NAMING_TOKENS_CONFIG.filter(
      (t) =>
        t.token.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [tokenSearchQuery]);

  const favoriteTokensList = useMemo(() => {
    return NAMING_TOKENS_CONFIG.filter((t) => tokenFavorites.includes(t.id));
  }, [tokenFavorites]);

  const tokenCategories = useMemo(() => {
    const cats = [];
    filteredTokens.forEach((t) => {
      if (!cats.includes(t.category)) cats.push(t.category);
    });
    return cats;
  }, [filteredTokens]);

  const catTokens = useMemo(() => {
    const map = {};
    filteredTokens.forEach((t) => {
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    });
    return map;
  }, [filteredTokens]);

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

  const categories = useMemo(() => ["All", ...new Set(catalog.map((c) => c.category || "General"))], [catalog]);


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
              catalogKey: item.key,
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
              catalogKey: item.key,
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
              catalogKey: item.key,
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

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.resourceType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        filterOnlyViolations || selectedCategory === "All" || item.category === selectedCategory;
      const matchesViolationFilter =
        !filterOnlyViolations ||
        platformViolations.some((v) => (v.catalogKey || v.item.key) === item.key);
      return matchesSearch && matchesCategory && matchesViolationFilter;
    });
  }, [catalog, searchQuery, selectedCategory, filterOnlyViolations, platformViolations]);

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

  // Auto-expand categories when filterOnlyViolations is enabled
  useEffect(() => {
    if (filterOnlyViolations && categoryNames.length > 0) {
      const next = {};
      categoryNames.forEach((c) => {
        next[c] = true;
      });
      setExpandedCategories((prev) => ({ ...prev, ...next }));
    }
  }, [filterOnlyViolations, categoryNames]);

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

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => {
      if (cat === "All") {
        return {
          value: "All",
          label:
            platformViolations.length > 0
              ? `All Categories (${catalog.length} types · ${platformViolations.length} failed)`
              : `All Categories (${catalog.length} types)`
        };
      }
      const catItems = catalog.filter((c) => (c.category || "General") === cat);
      const catFailed = catItems.filter((it) => platformViolations.some((v) => (v.catalogKey || v.item.key) === it.key)).length;
      return {
        value: cat,
        label:
          catFailed > 0
            ? `${cat} (${catItems.length} types · ${catFailed} failed)`
            : `${cat} (${catItems.length} types)`
      };
    });
  }, [categories, catalog, platformViolations]);

  const handleJumpToViolation = (targetKey) => {
    const targetViolation = platformViolations.find((v) => v.item.key === targetKey || v.catalogKey === targetKey) || platformViolations[0];
    const keyToJump = targetKey || targetViolation?.catalogKey || targetViolation?.item?.key;
    if (!keyToJump) return;

    const targetItem = catalog.find((c) => c.key === keyToJump);
    if (targetItem) {
      const cat = targetItem.category || "General";
      setExpandedCategories((prev) => ({ ...prev, [cat]: true }));
    }

    setTimeout(() => {
      const card = document.getElementById(`naming-card-${keyToJump}`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.outline = "2px solid var(--accent-rose)";
        card.style.boxShadow = "0 0 20px rgba(244, 63, 94, 0.55)";
        card.style.transition = "all 0.3s ease";
        setTimeout(() => {
          card.style.outline = "";
          card.style.boxShadow = "";
        }, 3000);
      }
    }, 150);
  };

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

  const handleApproveAllInferred = () => {
    if (!customer.namingRules?.inferredPatterns) return;
    const newCustomPatterns = { ...(customer.namingRules.customPatterns || {}) };
    const count = Object.keys(customer.namingRules.inferredPatterns).length;
    Object.entries(customer.namingRules.inferredPatterns).forEach(([key, val]) => {
      newCustomPatterns[key] = val.pattern;
    });

    const updated = {
      ...customer,
      namingRules: {
        ...customer.namingRules,
        customPatterns: newCustomPatterns,
        inferredPatterns: null
      }
    };
    onUpdateCustomer(updated);
    if (onShowToast) {
      onShowToast(`Approved and applied ${count} inferred naming patterns!`);
    }
  };

  const handleApproveSingleInferred = (typeKey, pattern) => {
    const newCustomPatterns = { ...(customer.namingRules?.customPatterns || {}) };
    newCustomPatterns[typeKey] = pattern;
    const remainingInferred = { ...(customer.namingRules?.inferredPatterns || {}) };
    delete remainingInferred[typeKey];

    const updated = {
      ...customer,
      namingRules: {
        ...customer.namingRules,
        customPatterns: newCustomPatterns,
        inferredPatterns: Object.keys(remainingInferred).length > 0 ? remainingInferred : null
      }
    };
    onUpdateCustomer(updated);
    if (onShowToast) {
      onShowToast(`Adopted inferred pattern for ${typeKey}: ${pattern}`);
    }
  };

  const handleDismissInferred = () => {
    const updated = {
      ...customer,
      namingRules: {
        ...customer.namingRules,
        inferredPatterns: null
      }
    };
    onUpdateCustomer(updated);
    if (onShowToast) {
      onShowToast("Dismissed inferred naming patterns.");
    }
  };

  return (
    <div
      className="naming-studio-root"
      style={{
        display: "flex",
        gap: tokenDrawerOpen ? "20px" : "0px",
        alignItems: "flex-start",
        position: "relative",
        transition: "gap 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      {/* 0. Contextual Token Palette Sticky Left Sidebar (Smoothly expands/collapses in-flow so inputs are NEVER occluded) */}
      <aside
        id="naming-token-palette-sidebar"
        aria-label="Smart Token Palette"
        style={{
          width: tokenDrawerOpen ? "320px" : "0px",
          minWidth: tokenDrawerOpen ? "320px" : "0px",
          opacity: tokenDrawerOpen ? 1 : 0,
          pointerEvents: tokenDrawerOpen ? "auto" : "none",
          overflow: "hidden",
          transition: "width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s, opacity 0.18s",
          position: "sticky",
          top: "80px",
          height: "calc(100vh - 100px)",
          maxHeight: "calc(100vh - 100px)",
          background: "var(--bg-surface)",
          border: tokenDrawerOpen ? "1px solid var(--border-hairline)" : "none",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          boxShadow: tokenDrawerOpen ? "0 8px 24px rgba(0, 0, 0, 0.35)" : "none",
          zIndex: 40
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--border-hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-canvas)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Braces size={16} style={{ color: "var(--accent-primary)" }} />
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-primary)" }}>
                SMART TOKENS
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                1-click insert at cursor
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTokenDrawerOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.74rem",
              borderRadius: "4px"
            }}
            title="Collapse Token Palette (Esc)"
          >
            <ChevronLeft size={14} />
            <span>Collapse</span>
          </button>
        </div>

        {/* Active Target Banner */}
        <div
          style={{
            padding: "8px 14px",
            background: "var(--bg-surface-elevated)",
            borderBottom: "1px solid var(--border-hairline)",
            fontSize: "0.72rem",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>
            Target: <strong style={{ color: "var(--accent-primary)" }}>{activeTargetLabel}</strong>
          </span>
          <span className="au-badge au-badge-subtle" style={{ fontSize: "0.64rem", padding: "1px 5px" }}>
            Auto-Inserts
          </span>
        </div>

        {/* Delimiter Auto-Append Segmented Control */}
        <div
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid var(--border-hairline)",
            background: "var(--bg-canvas)",
            display: "flex",
            flexDirection: "column",
            gap: "5px"
          }}
        >
          <div style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Auto-Append Separator:
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { id: "hyphen", label: "- Hyphen", preview: "{tok}-" },
              { id: "underscore", label: "_ Underscore", preview: "{tok}_" },
              { id: "none", label: "None", preview: "{tok}" }
            ].map((d) => {
              const isSelected = tokenDelimiter === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleChangeDelimiter(d.id)}
                  style={{
                    flex: 1,
                    padding: "4px 6px",
                    fontSize: "0.7rem",
                    fontFamily: "var(--font-mono)",
                    background: isSelected ? "var(--accent-tint)" : "var(--bg-surface)",
                    color: isSelected ? "var(--accent-primary)" : "var(--text-secondary)",
                    border: `1px solid ${isSelected ? "var(--accent-primary)" : "var(--border-hairline)"}`,
                    borderRadius: "4px",
                    cursor: "pointer",
                    textAlign: "center",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "all var(--ease-snappy)"
                  }}
                  title={`Append ${d.preview} when inserting tokens`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Token Search Filter */}
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-hairline)", position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: "22px", top: "16px", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-input form-input-mono"
            placeholder="Search tokens..."
            value={tokenSearchQuery}
            onChange={(e) => setTokenSearchQuery(e.target.value)}
            style={{ width: "100%", paddingLeft: "28px", fontSize: "0.75rem", height: "30px" }}
          />
        </div>

        {/* Scrollable Tokens & Favorites List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {/* Favorites Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <div style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--accent-amber)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "4px" }}>
                <Star size={11} fill="var(--accent-amber)" color="var(--accent-amber)" />
                Favorites ({favoriteTokensList.length})
              </div>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>★ toggle</span>
            </div>
            {favoriteTokensList.length === 0 ? (
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontStyle: "italic", padding: "6px" }}>
                Star any token below to pin here for quick access.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {favoriteTokensList.map((t) => (
                  <div
                    key={`fav-${t.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border-hairline)",
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleInsertToken(t.token)}
                      style={{
                        padding: "4px 8px",
                        background: "transparent",
                        border: "none",
                        color: "var(--accent-primary)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        fontSize: "0.74rem",
                        cursor: "pointer"
                      }}
                      title={`Insert ${t.token} (${t.desc})`}
                    >
                      {t.token}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(t.id, e)}
                      style={{
                        padding: "4px 5px",
                        background: "transparent",
                        border: "none",
                        color: "var(--accent-amber)",
                        cursor: "pointer"
                      }}
                      title="Remove from favorites"
                    >
                      <Star size={10} fill="var(--accent-amber)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Categorized Groups */}
          {tokenCategories.map((cat) => {
            const items = catTokens[cat] || [];
            if (items.length === 0) return null;

            return (
              <div key={cat}>
                <div style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                  {cat} ({items.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {items.map((t) => {
                    const isFav = tokenFavorites.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          background: "var(--bg-canvas)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: "4px",
                          transition: "all var(--ease-snappy)"
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleInsertToken(t.token)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            flex: 1,
                            minWidth: 0,
                            padding: 0
                          }}
                          title={`Insert ${t.token} (${t.desc})`}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.78rem", color: "var(--accent-primary)" }}>
                              {t.token}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                              → {t.sample}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.desc}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(t.id, e)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: isFav ? "var(--accent-amber)" : "var(--text-muted)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center"
                          }}
                          title={isFav ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star size={12} fill={isFav ? "var(--accent-amber)" : "none"} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Studio Content Area (Fluidly shifts beside sidebar with zero occlusion) */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "28px" }}>

        {/* Brownfield Inferred Naming Patterns Review Banner */}
        {customer.namingRules?.inferredPatterns && Object.keys(customer.namingRules.inferredPatterns).length > 0 && (
          <div
            className="glass-panel"
            style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)",
              border: "1px solid var(--accent-gold)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(245, 158, 11, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent-gold)"
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                      Brownfield Discovered Naming Patterns
                    </span>
                    <AuBadge variant="gold">
                      {Object.keys(customer.namingRules.inferredPatterns).length} Resource Types Inferred
                    </AuBadge>
                    <AuBadge variant="teal">LIVE TENANT REVERSE-ENGINEERED</AuBadge>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                    The Inference Engine deconstructed resource names from your live tenant discovery scan and mapped them to tokens ({'{Org}'}, {'{SUB}'}, {'{ENV}'}, {'{Instance}'}). Review and approve them to formalize your naming conventions.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <AuButton
                  variant="primary"
                  size="sm"
                  icon={<Check size={14} />}
                  onClick={() => handleApproveAllInferred()}
                >
                  Approve All Inferred ({Object.keys(customer.namingRules.inferredPatterns).length})
                </AuButton>
                <AuButton
                  variant="secondary"
                  size="sm"
                  icon={<XCircle size={14} />}
                  onClick={() => handleDismissInferred()}
                >
                  Dismiss
                </AuButton>
              </div>
            </div>

            {/* Grid of inferred pattern cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "10px" }}>
              {Object.entries(customer.namingRules.inferredPatterns).map(([typeKey, inf]) => {
                const catalogItem = catalog.find((c) => c.key === typeKey);
                const displayName = catalogItem ? catalogItem.name : typeKey.toUpperCase();
                return (
                  <div
                    key={typeKey}
                    style={{
                      padding: "10px 14px",
                      background: "var(--surface-bg)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "600", fontSize: "0.82rem", color: "var(--text-primary)" }}>
                        {displayName} ({typeKey})
                      </span>
                      <span
                        className={`au-badge ${inf.confidence === "HIGH" ? "au-badge-mint" : inf.confidence === "MEDIUM" ? "au-badge-gold" : ""}`}
                        style={{ fontSize: "0.68rem" }}
                      >
                        {inf.confidence} CONFIDENCE
                      </span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      Sample: <code style={{ color: "var(--text-secondary)" }}>{inf.sampleDiscovered}</code>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "4px" }}>
                      <code style={{ fontSize: "0.78rem", color: "var(--accent-mint)", fontWeight: "600" }}>
                        {inf.pattern}
                      </code>
                      <button
                        type="button"
                        className="au-btn au-btn-sm au-btn-secondary"
                        style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => handleApproveSingleInferred(typeKey, inf.pattern)}
                      >
                        Adopt
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Azure Platform Constraints Standardized Warning Banner */}
        {platformViolations.length > 0 && (
          <AuWarningBanner
            id="naming-platform-violations-banner"
            icon={<AlertTriangle size={20} />}
            title={`${platformViolations.length} Resource Naming Pattern${platformViolations.length > 1 ? "s" : ""} Violate Azure Platform Constraints`}
            description="Azure ARM will fail resource creation if names exceed length bounds or contain forbidden characters (e.g., Storage Accounts reject hyphens & uppercase)."
            actions={
              <>
                <button
                  type="button"
                  id="naming-filter-violations-btn"
                  className={`btn btn-sm ${filterOnlyViolations ? "btn-danger" : "btn-secondary"}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    fontWeight: "600",
                    fontSize: "0.8rem",
                    borderColor: filterOnlyViolations ? "var(--accent-rose)" : "rgba(244, 63, 94, 0.4)"
                  }}
                  onClick={() => {
                    setFilterOnlyViolations((prev) => {
                      const next = !prev;
                      if (next) setSelectedCategory("All");
                      return next;
                    });
                  }}
                  title={filterOnlyViolations ? "Show all resource types" : "Show only resource types that have naming violations"}
                >
                  {filterOnlyViolations ? (
                    <>
                      <X size={14} /> Clear Filter (Show All)
                    </>
                  ) : (
                    <>
                      <Filter size={14} /> Filter to Non-Compliant ({platformViolations.length})
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="naming-autofix-all-btn"
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
              </>
            }
          />
        )}

        {/* 1. Global Pattern Bar & Action Controls */}
        <div className="glass-panel" style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <Layers size={18} color="var(--accent-primary)" />
                Naming Convention Pattern Engine
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "3px", margin: 0 }}>
                Build dynamic naming rules with smart tokens ({`{org}`}, {`{sub}`}, {`{env}`}, {`{rg}`}, {`{abbr}`}). Click any input to reveal token drawer.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <AuButton
                variant={tokenDrawerOpen ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTokenDrawerOpen(!tokenDrawerOpen)}
                icon={<Braces size={14} />}
                title="Open or close the Smart Token Palette sidebar"
              >
                {tokenDrawerOpen ? "Close Tokens" : "Smart Tokens"}
              </AuButton>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowTemplateModal(true)}
                title="Load a curated naming baseline (AirGate Core, AI Workloads, Microservices) or save custom template"
              >
                <LayoutTemplate size={15} />
                <span>Baselines & Templates</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddTypeModal(true)}>
                <Plus size={15} />
                <span>Add Resource Type</span>
              </button>
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
                border: `1px solid ${isTestItemUnrestricted
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

              {/* Quick Non-Compliant Filter Pill if violations exist */}
              {platformViolations.length > 0 && (
                <button
                  type="button"
                  id="naming-toolbar-filter-violations"
                  className={`btn btn-sm ${filterOnlyViolations ? "btn-danger" : "btn-secondary"}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.8rem",
                    borderColor: filterOnlyViolations ? "var(--status-danger-border)" : "var(--border-subtle)",
                    background: filterOnlyViolations ? "rgba(244, 63, 94, 0.2)" : undefined,
                    color: filterOnlyViolations ? "var(--status-danger-text)" : undefined
                  }}
                  onClick={() => setFilterOnlyViolations((prev) => !prev)}
                  title="Filter catalog to show only non-compliant types"
                >
                  <Filter size={13} />
                  <span>Violations ({platformViolations.length})</span>
                </button>
              )}

              {/* Category Filter */}
              <div style={{ minWidth: "220px" }}>
                <AuSelect
                  id="naming-category-filter"
                  aria-label="Filter resource types by category"
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={categoryOptions}
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
                const catViolations = items.filter((it) => platformViolations.some((v) => (v.catalogKey || v.item.key) === it.key));
                const hasCatViolations = catViolations.length > 0;
                return (
                  <div
                    key={cat}
                    className="au-hud-card"
                    style={{
                      border: hasCatViolations ? "1px solid rgba(244, 63, 94, 0.35)" : "1px solid var(--border-hairline)",
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
                        background: hasCatViolations ? "rgba(244, 63, 94, 0.04)" : "rgba(255, 255, 255, 0.02)",
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
                        {hasCatViolations ? (
                          <span
                            className="au-badge au-badge-rose"
                            style={{
                              fontSize: "0.72rem",
                              padding: "0.15rem 0.55rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            title={`${catViolations.length} resource types in this category fail Azure ARM platform rules`}
                          >
                            <AlertTriangle size={11} />
                            {items.length} types ({catViolations.length} failed)
                          </span>
                        ) : (
                          <span className="au-badge au-badge-mint" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
                            {items.length} types
                          </span>
                        )}
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
                              id={`naming-card-${item.key}`}
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
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-secondary"
                                        style={{
                                          fontSize: "0.7rem",
                                          padding: "3px 8px",
                                          height: "22px",
                                          lineHeight: "1",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px"
                                        }}
                                        onClick={() => {
                                          setActivePatternTarget({ key: item.key, patternKey });
                                          setTokenDrawerOpen(true);
                                        }}
                                        title="Open Smart Token palette for this input"
                                      >
                                        <Braces size={11} />
                                        Tokens
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
                                      background: hasError ? "var(--accent-rose-tint)" : undefined
                                    }}
                                    value={pattern}
                                    onFocus={() => {
                                      setActivePatternTarget({ key: item.key, patternKey });
                                      setTokenDrawerOpen(true);
                                    }}
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
                {cafSearchQuery.trim().length > 0 && (() => {
                  const filtered = AZURE_NAMING_CATALOG.filter((item) => {
                    const q = cafSearchQuery.toLowerCase();
                    return (
                      item.name.toLowerCase().includes(q) ||
                      item.caf_abbreviation.toLowerCase().includes(q) ||
                      item.airgate_abbreviation.toLowerCase().includes(q) ||
                      item.provider.toLowerCase().includes(q) ||
                      item.category.toLowerCase().includes(q)
                    );
                  }).slice(0, 10);

                  return (
                    <div
                      className="au-autocomplete-menu"
                      role="listbox"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        maxHeight: "260px",
                        overflowY: "auto",
                        zIndex: 1060
                      }}
                    >
                      {filtered.length === 0 ? (
                        <div style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center" }}>
                          No matching resources found for "{cafSearchQuery}"
                        </div>
                      ) : (
                        filtered.map((cafItem) => (
                          <div
                            key={cafItem.id}
                            role="option"
                            className="au-autocomplete-item"
                            onClick={() => handleSelectCafItem(cafItem)}
                            style={{
                              padding: "9px 12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                          >
                            <div style={{ minWidth: 0, paddingRight: "8px" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.84rem", color: "var(--text-primary)" }}>
                                {cafItem.name}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                {cafItem.provider}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                              {cafItem.is_override ? (
                                <span className="au-badge au-badge-amber" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                  AirGate: {cafItem.airgate_abbreviation}
                                </span>
                              ) : (
                                <span className="au-badge au-badge-azure" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                  CAF: {cafItem.caf_abbreviation}
                                </span>
                              )}
                              <span className="au-badge au-badge-subtle" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                {cafItem.scope}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
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
                  onFocus={() => {
                    setActivePatternTarget({ key: "newType", patternKey: "newType" });
                    setTokenDrawerOpen(true);
                  }}
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
