import React, { useState } from "react";
import { Terminal, Upload, CheckCircle2, AlertTriangle, FileCode, Layers, Sparkles, Copy, Check } from "lucide-react";
import { AuModal, AuButton, AuBadge } from "../theme";
import { inferBrownfieldNamingPatterns } from "../engine/patternInferenceEngine.js";
import sampleInventory from "../data/sampleBrownfieldInventory.json";

const DISCOVERY_SCRIPT_POWERSHELL = `# ------------------------------------------------------------------------------
# Azure Landing Zone Studio: Brownfield Tenant Discovery Script (PowerShell)
# Run in Azure Cloud Shell or PowerShell connected to your Azure Tenant
# ------------------------------------------------------------------------------
Write-Host "Verifying Azure PowerShell modules..." -ForegroundColor Cyan

# 1. Install required modules if missing
if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
    Write-Host "Installing Az.Accounts module..." -ForegroundColor Yellow
    Install-Module -Name Az.Accounts -Scope CurrentUser -Force -AllowClobber
}
if (-not (Get-Module -ListAvailable -Name Az.Resources)) {
    Write-Host "Installing Az.Resources module..." -ForegroundColor Yellow
    Install-Module -Name Az.Resources -Scope CurrentUser -Force -AllowClobber
}

# 2. Verify Azure Login
$ctx = Get-AzContext
if (-not $ctx) {
    Write-Host "Please authenticate to your target Azure Tenant..." -ForegroundColor Yellow
    Connect-AzAccount
    $ctx = Get-AzContext
}

Write-Host "Discovering Subscriptions, Resource Groups, and Resources..." -ForegroundColor Cyan

$sub = $ctx | Select-Object @{N="id";E={$_.Subscription.Id}}, @{N="subscriptionId";E={$_.Subscription.Id}}, @{N="name";E={$_.Subscription.Name}}, @{N="state";E={$_.Subscription.State}}, @{N="tags";E={$_.Subscription.Tags}}
$rgs = Get-AzResourceGroup | Select-Object @{N="id";E={$_.ResourceId}}, @{N="name";E={$_.ResourceGroupName}}, @{N="subscriptionId";E={$_.SubscriptionId}}, @{N="location";E={$_.Location}}, @{N="tags";E={$_.Tags}}
$resources = Get-AzResource | Select-Object @{N="id";E={$_.ResourceId}}, @{N="name";E={$_.Name}}, @{N="type";E={$_.ResourceType}}, @{N="resourceGroup";E={$_.ResourceGroupName}}, @{N="location";E={$_.Location}}, @{N="subscriptionId";E={$_.SubscriptionId}}, @{N="tags";E={$_.Tags}}

$inventory = @{
    version = "1.0.0"
    discoveredAt = (Get-Date -Format "o")
    subscriptions = @($sub)
    resourceGroups = @($rgs)
    resources = @($resources)
}

$inventory | ConvertTo-Json -Depth 10 | Set-Content "alz-brownfield-inventory.json"
Write-Host "Discovery Complete! Saved $($rgs.Count) RGs and $($resources.Count) Resources to alz-brownfield-inventory.json" -ForegroundColor Green
`;

const DISCOVERY_SCRIPT_CLI = `# ------------------------------------------------------------------------------
# Azure Landing Zone Studio: Brownfield Tenant Discovery Script (Azure CLI)
# Run in Azure Cloud Shell, Bash, zsh, or macOS/Linux Terminal
# ------------------------------------------------------------------------------
python3 -c "
import subprocess, json, datetime

try:
    sub = json.loads(subprocess.check_output(['az', 'account', 'show', '-o', 'json']))
except Exception:
    print('Error: Not logged in. Please run \"az login\" first.')
    exit(1)

print('Discovering Azure tenant resources...')
rgs = json.loads(subprocess.check_output(['az', 'group', 'list', '-o', 'json']))
res = json.loads(subprocess.check_output(['az', 'resource', 'list', '-o', 'json']))

inventory = {
    'version': '1.0.0',
    'discoveredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'subscriptions': [{
        'id': sub['id'],
        'subscriptionId': sub['id'],
        'name': sub.get('name', 'Subscription'),
        'state': sub.get('state', 'Enabled'),
        'tags': sub.get('tags') or {}
    }],
    'resourceGroups': [{
        'id': g['id'],
        'name': g['name'],
        'location': g['location'],
        'subscriptionId': sub['id'],
        'tags': g.get('tags') or {}
    } for g in rgs],
    'resources': [{
        'id': r['id'],
        'name': r['name'],
        'type': r['type'],
        'resourceGroup': r.get('resourceGroup', ''),
        'location': r['location'],
        'subscriptionId': sub['id'],
        'tags': r.get('tags') or {}
    } for r in res]
}

with open('alz-brownfield-inventory.json', 'w') as f:
    json.dump(inventory, f, indent=2)

print(f'Discovery Complete! Saved {len(inventory[\"resourceGroups\"])} RGs and {len(inventory[\"resources\"])} Resources to alz-brownfield-inventory.json')
"
`;

const DISCOVERY_SCRIPT_GRAPH = `# ------------------------------------------------------------------------------
# Azure Resource Graph One-Liner (Azure CLI or Cloud Shell)
# Auto-processed by Policy Studio: extracts RGs & Subscriptions from resource IDs
# ------------------------------------------------------------------------------
az graph query -q "Resources | project id, name, type, location, resourceGroup, subscriptionId, tags" --first 1000 > alz-brownfield-inventory.json
echo "Discovered resources exported to alz-brownfield-inventory.json"
`;

/**
 * Normalizes any uploaded payload format:
 * 1. Standard schema: { subscriptions, resourceGroups, resources }
 * 2. Azure Resource Graph output: { count, data: [ ... ] }
 * 3. Flat resource list: [ { id, name, type, resourceGroup, tags }, ... ]
 */
function normalizeDiscoveryPayload(payload, customer = {}) {
  if (!payload || typeof payload !== "object") {
    return { subscriptions: [], resourceGroups: [], resources: [] };
  }

  // 1. Extract raw resources list
  let rawResources = [];
  if (Array.isArray(payload)) {
    rawResources = payload;
  } else if (Array.isArray(payload.data)) {
    rawResources = payload.data;
  } else if (Array.isArray(payload.resources)) {
    rawResources = payload.resources;
  }

  // 2. Extract declared subscriptions & resource groups
  const declaredSubs = Array.isArray(payload.subscriptions) ? payload.subscriptions : [];
  const declaredRgs = Array.isArray(payload.resourceGroups) ? payload.resourceGroups : [];

  const defaultSubId = (customer?.subscriptionCode || "SHD").toLowerCase();
  const defaultSubName = customer?.subscriptionName || "Discovered Tenant Subscription";
  const defaultRegion = customer?.defaultRegion || "canadacentral";

  // 3. Map declared resource groups
  const rgMap = {};
  declaredRgs.forEach((rg) => {
    if (rg && rg.name) {
      rgMap[rg.name.toLowerCase()] = {
        id: rg.id || rg.name,
        name: rg.name,
        location: rg.location || defaultRegion,
        subscriptionId: rg.subscriptionId || defaultSubId,
        tags: rg.tags || {}
      };
    }
  });

  // 4. Map declared subscriptions
  const subMap = {};
  declaredSubs.forEach((sub) => {
    const sId = sub.id || sub.subscriptionId;
    if (sId) {
      subMap[sId.toLowerCase()] = {
        id: sId,
        subscriptionId: sId,
        name: sub.name || defaultSubName,
        state: sub.state || "Enabled",
        tags: sub.tags || {}
      };
    }
  });

  // 5. If RGs or Subs are missing, auto-derive them from resources
  rawResources.forEach((res) => {
    const rgNameFromId = res.id?.match(/resourceGroups\/([^/]+)/i)?.[1];
    const rgName = rgNameFromId || res.resourceGroup;
    const subIdFromId = res.id?.match(/subscriptions\/([^/]+)/i)?.[1];
    const subId = res.subscriptionId || subIdFromId || defaultSubId;

    if (rgName && !rgMap[rgName.toLowerCase()]) {
      rgMap[rgName.toLowerCase()] = {
        id: rgName,
        name: rgName,
        location: res.location || defaultRegion,
        subscriptionId: subId,
        tags: {}
      };
    }

    if (subId && !subMap[subId.toLowerCase()]) {
      subMap[subId.toLowerCase()] = {
        id: subId,
        subscriptionId: subId,
        name: defaultSubName,
        state: "Enabled",
        tags: {}
      };
    }
  });

  // Fallback: If still no subscription, create default
  if (Object.keys(subMap).length === 0) {
    subMap[defaultSubId] = {
      id: `sub-${defaultSubId}`,
      subscriptionId: defaultSubId,
      name: defaultSubName,
      state: "Enabled",
      tags: {}
    };
  }

  const finalSubs = Object.values(subMap);
  const finalRgs = Object.values(rgMap);

  return {
    subscriptions: finalSubs,
    resourceGroups: finalRgs,
    resources: rawResources
  };
}

export function BrownfieldIngestionModal({
  isOpen,
  customer,
  onClose,
  onIngestSuccess,
  onShowToast
}) {
  const [jsonText, setJsonText] = useState("");
  const [activeScriptTab, setActiveScriptTab] = useState("powershell"); // "powershell" | "cli" | "graph"
  const [copiedType, setCopiedType] = useState(null);
  const [parseError, setParseError] = useState("");
  const [previewStats, setPreviewStats] = useState(null);

  if (!isOpen) return null;

  const currentScriptContent =
    activeScriptTab === "powershell"
      ? DISCOVERY_SCRIPT_POWERSHELL
      : activeScriptTab === "cli"
        ? DISCOVERY_SCRIPT_CLI
        : DISCOVERY_SCRIPT_GRAPH;

  const handleCopyScript = (scriptText, type) => {
    navigator.clipboard.writeText(scriptText);
    setCopiedType(type);
    if (onShowToast) onShowToast(`Copied ${type} discovery script to clipboard!`);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleLoadSample = () => {
    const raw = JSON.stringify(sampleInventory, null, 2);
    setJsonText(raw);
    analyzePayload(sampleInventory);
    if (onShowToast) onShowToast("Loaded Woodgrove sample brownfield tenant inventory!");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        setJsonText(text);
        const parsed = JSON.parse(text);
        analyzePayload(parsed);
      } catch (err) {
        setParseError(`JSON parse error: ${err.message}`);
        setPreviewStats(null);
      }
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e) => {
    const text = e.target.value;
    setJsonText(text);
    if (!text.trim()) {
      setPreviewStats(null);
      setParseError("");
      return;
    }
    try {
      const parsed = JSON.parse(text);
      analyzePayload(parsed);
      setParseError("");
    } catch (err) {
      setParseError(`Invalid JSON syntax: ${err.message}`);
      setPreviewStats(null);
    }
  };

  const analyzePayload = (payload) => {
    setParseError("");
    const normalized = normalizeDiscoveryPayload(payload, customer);
    const subs = normalized.subscriptions;
    const rgs = normalized.resourceGroups;
    const res = normalized.resources;

    // Extract unique tag keys
    const tagKeySet = new Set();
    [...subs, ...rgs, ...res].forEach((item) => {
      if (item.tags && typeof item.tags === "object") {
        Object.keys(item.tags).forEach((k) => tagKeySet.add(k));
      }
    });

    setPreviewStats({
      subscriptionsCount: subs.length,
      rgsCount: rgs.length,
      resourcesCount: res.length,
      tagKeysCount: tagKeySet.size,
      normalizedPayload: normalized,
      rawPayload: payload
    });
  };

  const handleExecuteIngestion = () => {
    if (!previewStats) return;

    const normalized = previewStats.normalizedPayload;
    const rawSubs = normalized.subscriptions;
    const rawRgs = normalized.resourceGroups;
    const rawResources = normalized.resources;

    // 1. Build Subscriptions & Topology Structure
    const subIdMap = {};
    const subscriptions = rawSubs.map((sub, sIdx) => {
      const subKey = sub.id || sub.subscriptionId || `sub-${sIdx + 1}`;
      const subCode = (sub.name || customer.subscriptionCode || `SUB${sIdx + 1}`).slice(0, 4).toUpperCase();

      subIdMap[sub.subscriptionId || sub.id] = subKey;
      if (sub.subscriptionId) subIdMap[sub.subscriptionId.toLowerCase()] = subKey;
      if (sub.id) subIdMap[sub.id.toLowerCase()] = subKey;

      return {
        id: subKey,
        name: sub.name || `Discovered Sub ${sIdx + 1}`,
        code: subCode,
        environment: customer.environment || "prod",
        location: customer.defaultRegion || "canadacentral",
        tags: sub.tags || {},
        resourceGroups: []
      };
    });

    // 2. Map Resource Groups into Subscriptions
    const defaultSub = subscriptions[0];
    const rgMap = {};

    rawRgs.forEach((rg, rgIdx) => {
      const parentSub =
        (rg.subscriptionId &&
          subscriptions.find(
            (s) =>
              s.id === subIdMap[rg.subscriptionId] ||
              s.id === subIdMap[rg.subscriptionId.toLowerCase()]
          )) ||
        defaultSub;

      const rgObj = {
        id: rg.name || `rg-${rgIdx + 1}`,
        purpose: (rg.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "core",
        name: rg.name,
        location: rg.location || customer.defaultRegion || "canadacentral",
        tags: rg.tags || {},
        resources: []
      };
      parentSub.resourceGroups.push(rgObj);
      rgMap[rg.name.toLowerCase()] = rgObj;
      rgMap[rgObj.id] = rgObj;
    });

    // 3. Map Leaf Resources into Resource Groups
    rawResources.forEach((res, resIdx) => {
      const rgNameFromId = res.id?.match(/resourceGroups\/([^/]+)/i)?.[1];
      const rgName = (rgNameFromId || res.resourceGroup || "").toLowerCase();
      let targetRg = rgMap[rgName];

      if (!targetRg) {
        // Fallback: create RG on the fly if not declared
        const displayRgName = rgNameFromId || res.resourceGroup || `rg-discovered-${resIdx + 1}`;
        targetRg = {
          id: displayRgName,
          purpose: (displayRgName).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "workload",
          name: displayRgName,
          location: res.location || customer.defaultRegion || "canadacentral",
          tags: {},
          resources: []
        };
        defaultSub.resourceGroups.push(targetRg);
        rgMap[displayRgName.toLowerCase()] = targetRg;
      }

      targetRg.resources.push({
        id: res.id || `res-${resIdx + 1}`,
        name: res.name,
        resourceType: res.type,
        resourceTypeKey: (res.type || "").split("/").pop().toLowerCase(),
        purpose: targetRg.purpose,
        instance: (res.name?.match(/\d{2}$/) || ["01"])[0],
        tags: res.tags || {}
      });
    });

    // 4. Run Reverse-Engineering Naming Pattern Inference
    const { inferredPatterns } = inferBrownfieldNamingPatterns(rawResources, customer);

    // 4b. Aggregate Discovered Tags across tenant
    const discoveredTagsMap = {};
    const registerTag = (key, val, scope) => {
      if (!key) return;
      if (!discoveredTagsMap[key]) {
        discoveredTagsMap[key] = {
          key,
          sampleValues: new Set(),
          foundInScopes: new Set(),
          count: 0
        };
      }
      if (val !== undefined && val !== null && val !== "") {
        discoveredTagsMap[key].sampleValues.add(String(val));
      }
      discoveredTagsMap[key].foundInScopes.add(scope);
      discoveredTagsMap[key].count++;
    };

    // Register Subscription Tags
    rawSubs.forEach((sub) => {
      Object.entries(sub.tags || {}).forEach(([k, v]) => registerTag(k, v, "subscription"));
    });

    // Register RG Tags
    rawRgs.forEach((rg) => {
      Object.entries(rg.tags || {}).forEach(([k, v]) => registerTag(k, v, "resourceGroup"));
    });

    // Register Resource Tags
    rawResources.forEach((res) => {
      Object.entries(res.tags || {}).forEach(([k, v]) => registerTag(k, v, "resource"));
    });

    const discoveredTags = Object.values(discoveredTagsMap).map((item) => ({
      key: item.key,
      sampleValues: Array.from(item.sampleValues).slice(0, 5),
      foundInScopes: Array.from(item.foundInScopes),
      count: item.count
    }));

    // 5. Update Customer Workspace
    const updatedCustomer = {
      ...customer,
      topology: { subscriptions },
      namingRules: {
        ...customer.namingRules,
        inferredPatterns: inferredPatterns
      },
      brownfieldMetadata: {
        importedAt: new Date().toISOString(),
        totalDiscoveredResources: rawResources.length,
        discoveredSubscriptionsCount: subscriptions.length,
        inferredPatternsCount: Object.keys(inferredPatterns).length,
        discoveredTagsCount: discoveredTags.length,
        discoveredTags
      }
    };

    onIngestSuccess(updatedCustomer);
  };

  return (
    <AuModal
      isOpen={isOpen}
      onClose={onClose}
      title="Brownfield Discovery Ingestion: Live Tenant Scan"
      width="840px"
      footer={
        <>
          <AuButton variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </AuButton>
          <AuButton
            variant="primary"
            size="sm"
            disabled={!previewStats}
            onClick={handleExecuteIngestion}
            icon={<CheckCircle2 size={14} />}
          >
            Ingest Discovered Tenant & Build Topology
          </AuButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Step 1: Run Discovery Script */}
        <label htmlFor="brownfield-json-input" className="form-label" style={{ margin: 0 }}>
          Step 1: Choose Discovery Method & Run in Azure Cloud Shell / CLI
          {/* <div>
            <button
              type="button"
              className="au-btn au-btn-primary au-btn-xs"
              onClick={handleLoadSample}
            >
              <Sparkles size={11} />
              <span>Load Sample Tenant</span>
            </button>
          </div> */}
        </label>
        <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

              {/* <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                Step 1: Choose Discovery Method & Run in Azure Cloud Shell / CLI
              </strong> */}
            </div>


          </div>

          {/* Script Type Selector Tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`au-btn au-btn-xs ${activeScriptTab === "powershell" ? "au-btn-primary" : "au-btn-secondary"}`}
              onClick={() => setActiveScriptTab("powershell")}
            >
              <span>PowerShell (.ps1)</span>
            </button>
            <button
              type="button"
              className={`au-btn au-btn-xs ${activeScriptTab === "cli" ? "au-btn-primary" : "au-btn-secondary"}`}
              onClick={() => setActiveScriptTab("cli")}
            >
              <span>Azure CLI (Python)</span>
            </button>
            <button
              type="button"
              className={`au-btn au-btn-xs ${activeScriptTab === "graph" ? "au-btn-primary" : "au-btn-secondary"}`}
              onClick={() => setActiveScriptTab("graph")}
            >
              <span>Resource Graph (One-Liner)</span>
            </button>
          </div>

          {/* Integrated Code Block with Anchored Header */}
          <div style={{ borderRadius: "var(--radius-xs)", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div
              style={{
                background: "rgba(0, 0, 0, 0.55)",
                padding: "6px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
              }}
            >
              <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {activeScriptTab === "powershell" ? "PowerShell Script" : activeScriptTab === "cli" ? "Bash / Python Discovery Script" : "Resource Graph One-Liner"}
              </span>

              <button
                type="button"
                className="au-btn au-btn-secondary au-btn-xs"
                style={{ padding: "2px 8px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "5px" }}
                onClick={() =>
                  handleCopyScript(
                    currentScriptContent,
                    activeScriptTab === "powershell"
                      ? "PowerShell"
                      : activeScriptTab === "cli"
                        ? "Azure CLI"
                        : "Resource Graph"
                  )
                }
              >
                {copiedType ? <Check size={11} style={{ color: "var(--accent-mint)" }} /> : <Copy size={11} />}
                <span>{copiedType ? "Copied!" : "Copy Script"}</span>
              </button>
            </div>

            <pre
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "10px 12px",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
                overflowX: "auto",
                maxHeight: "180px",
                margin: 0,
                borderRadius: 0
              }}
            >
              {currentScriptContent}
            </pre>
          </div>
        </div>

        {/* Step 2: Upload or Paste JSON */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <label htmlFor="brownfield-json-input" className="form-label" style={{ margin: 0 }}>
              Step 2: Upload or Paste Discovery JSON (alz-brownfield-inventory.json)
            </label>

            <label
              htmlFor="brownfield-file-upload"
              className="au-btn au-btn-secondary au-btn-xs"
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <Upload size={11} />
              <span>Choose File...</span>
              <input
                id="brownfield-file-upload"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <textarea
            id="brownfield-json-input"
            rows={7}
            className="form-input form-input-mono"
            style={{ fontSize: "0.75rem", width: "100%", resize: "vertical" }}
            placeholder='Paste JSON output here (supports unified schema, az graph query output, or raw resource array) or click "Load Sample Tenant" above...'
            value={jsonText}
            onChange={handleTextChange}
          />

          {parseError && (
            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-crimson)", fontSize: "0.75rem" }}>
              <AlertTriangle size={13} />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Step 3: Pre-flight Summary Card */}
        {previewStats && (
          <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "var(--radius-sm)", padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={15} style={{ color: "var(--accent-amber)" }} />
                <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                  Discovered Tenant Inventory Summary
                </strong>
              </div>
              <span className="au-badge au-badge-amber" style={{ fontSize: "0.68rem" }}>Ready to Ingest</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "8px 10px", borderRadius: "var(--radius-xs)" }}>
                <span className="au-mono-meta" style={{ fontSize: "0.68rem" }}>Subscriptions</span>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {previewStats.subscriptionsCount}
                </div>
              </div>

              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "8px 10px", borderRadius: "var(--radius-xs)" }}>
                <span className="au-mono-meta" style={{ fontSize: "0.68rem" }}>Resource Groups</span>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {previewStats.rgsCount}
                </div>
              </div>

              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "8px 10px", borderRadius: "var(--radius-xs)" }}>
                <span className="au-mono-meta" style={{ fontSize: "0.68rem" }}>Leaf Resources</span>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-mint)" }}>
                  {previewStats.resourcesCount}
                </div>
              </div>

              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "8px 10px", borderRadius: "var(--radius-xs)" }}>
                <span className="au-mono-meta" style={{ fontSize: "0.68rem" }}>Discovered Tags</span>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-amber)" }}>
                  {previewStats.tagKeysCount}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuModal>
  );
}
