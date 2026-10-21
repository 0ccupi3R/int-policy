import React, { useState } from "react";
import { Terminal, Upload, CheckCircle2, AlertTriangle, FileCode, Layers, Sparkles, Copy, Check } from "lucide-react";
import { AuModal, AuButton, AuBadge } from "../theme";
import { inferBrownfieldNamingPatterns } from "../engine/patternInferenceEngine.js";
import sampleInventory from "../data/sampleBrownfieldInventory.json";

const DISCOVERY_SCRIPT_POWERSHELL = `# ------------------------------------------------------------------------------
# Azure Landing Zone Studio: Brownfield Tenant Discovery Script
# Run in Azure Cloud Shell or PowerShell connected to your Azure Tenant
# ------------------------------------------------------------------------------
Write-Host "Starting Azure ALZ Tenant Discovery..." -ForegroundColor Cyan

$subs = Get-AzSubscription | Select-Object @{N="id";E={$_.Id}}, @{N="name";E={$_.Name}}, @{N="subscriptionId";E={$_.Id}}, @{N="state";E={$_.State}}, @{N="tags";E={$_.Tags}}
$rgs = Get-AzResourceGroup | Select-Object @{N="id";E={$_.ResourceId}}, @{N="name";E={$_.ResourceGroupName}}, @{N="subscriptionId";E={$_.SubscriptionId}}, @{N="location";E={$_.Location}}, @{N="tags";E={$_.Tags}}
$resources = Search-AzGraph -Query "Resources | project id, name, type, location, resourceGroup, subscriptionId, tags" -First 1000

$inventory = @{
  version = "1.0.0"
  discoveredAt = (Get-Date -Format "o")
  subscriptions = $subs
  resourceGroups = $rgs
  resources = $resources
}

$inventory | ConvertTo-Json -Depth 10 | Set-Content "alz-brownfield-inventory.json"
Write-Host "Discovery Complete! Saved inventory to alz-brownfield-inventory.json" -ForegroundColor Green
`;

const DISCOVERY_SCRIPT_CLI = `# ------------------------------------------------------------------------------
# Azure CLI / Graph Query Discovery (Bash / Cloud Shell)
# ------------------------------------------------------------------------------
az graph query -q "Resources | project id, name, type, location, resourceGroup, subscriptionId, tags" --first 1000 > alz-brownfield-inventory.json
echo "Discovered resources exported to alz-brownfield-inventory.json"
`;

export function BrownfieldIngestionModal({
  isOpen,
  customer,
  onClose,
  onIngestSuccess,
  onShowToast
}) {
  const [jsonText, setJsonText] = useState("");
  const [copiedType, setCopiedType] = useState(null);
  const [parseError, setParseError] = useState("");
  const [previewStats, setPreviewStats] = useState(null);

  if (!isOpen) return null;

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
    const subs = payload.subscriptions || [];
    const rgs = payload.resourceGroups || [];
    const res = payload.resources || (Array.isArray(payload.data) ? payload.data : []);

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
      rawPayload: payload
    });
  };

  const handleExecuteIngestion = () => {
    if (!previewStats) return;

    const payload = previewStats.rawPayload;
    const rawSubs = payload.subscriptions || [];
    const rawRgs = payload.resourceGroups || [];
    const rawResources = payload.resources || [];

    // 1. Build Subscriptions & Topology Structure
    const defaultSubId = (customer.subscriptionCode || "SHD").toLowerCase();
    const subIdMap = {};

    const subscriptions = (rawSubs.length > 0 ? rawSubs : [{ id: `sub-${defaultSubId}`, name: customer.subscriptionName || "SharedServices", subscriptionId: defaultSubId }]).map((sub, sIdx) => {
      const subKey = sub.id || sub.subscriptionId || `sub-${sIdx + 1}`;
      const subCode = (sub.name || customer.subscriptionCode || `SUB${sIdx + 1}`).slice(0, 4).toUpperCase();

      subIdMap[sub.subscriptionId || sub.id] = subKey;

      return {
        id: subKey,
        name: sub.name || `Discovered Sub ${sIdx + 1}`,
        code: subCode,
        environment: customer.environment || "prod",
        location: customer.defaultRegion || "eastus",
        tags: sub.tags || {},
        resourceGroups: []
      };
    });

    // 2. Map Resource Groups into Subscriptions
    const defaultSub = subscriptions[0];
    const rgMap = {};

    rawRgs.forEach((rg, rgIdx) => {
      const parentSub = subscriptions.find((s) => s.id === subIdMap[rg.subscriptionId]) || defaultSub;
      const rgObj = {
        id: rg.name || `rg-${rgIdx + 1}`,
        purpose: (rg.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "core",
        name: rg.name,
        location: rg.location || customer.defaultRegion || "eastus",
        tags: rg.tags || {},
        resources: []
      };
      parentSub.resourceGroups.push(rgObj);
      rgMap[rg.name] = rgObj;
    });

    // 3. Map Leaf Resources into Resource Groups
    rawResources.forEach((res, resIdx) => {
      let targetRg = rgMap[res.resourceGroup];
      if (!targetRg) {
        // Fallback: create RG on the fly if not declared
        targetRg = {
          id: res.resourceGroup || `rg-discovered-${resIdx + 1}`,
          purpose: "workload",
          name: res.resourceGroup || `rg-discovered-${resIdx + 1}`,
          location: res.location || customer.defaultRegion || "eastus",
          tags: {},
          resources: []
        };
        defaultSub.resourceGroups.push(targetRg);
        rgMap[res.resourceGroup] = targetRg;
      }

      targetRg.resources.push({
        id: res.id || `res-${resIdx + 1}`,
        name: res.name,
        resourceType: res.type,
        resourceTypeKey: (res.type || "").split("/").pop().toLowerCase(),
        purpose: targetRg.purpose,
        instance: (res.name.match(/\d{2}$/) || ["01"])[0],
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

    subscriptions.forEach((s) => {
      Object.entries(s.tags || {}).forEach(([k, v]) => registerTag(k, v, "subscription"));
    });
    rawRgs.forEach((rg) => {
      Object.entries(rg.tags || {}).forEach(([k, v]) => registerTag(k, v, "resourceGroup"));
    });
    rawResources.forEach((r) => {
      Object.entries(r.tags || {}).forEach(([k, v]) => registerTag(k, v, "resource"));
    });

    const discoveredTags = Object.values(discoveredTagsMap).map((t) => ({
      key: t.key,
      sampleValues: Array.from(t.sampleValues).slice(0, 5),
      foundInScopes: Array.from(t.foundInScopes),
      count: t.count
    }));

    // 5. Update Customer Workspace
    const updatedCustomer = {
      ...customer,
      environmentParadigm: "brownfield",
      namingEffect: "Audit",
      topology: { subscriptions },
      namingRules: {
        ...customer.namingRules,
        inferredPatterns
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
    onClose();
    if (onShowToast) {
      onShowToast(`Successfully ingested ${rawResources.length} resources across ${subscriptions.length} subscriptions!`);
    }
  };

  return (
    <AuModal
      isOpen={isOpen}
      onClose={onClose}
      kicker="BROWNFIELD DISCOVERY & INGESTION"
      title={`Discover & Import Tenant: ${customer.name}`}
      maxWidth="780px"
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
        <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={15} style={{ color: "var(--accent-amber)" }} />
              <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                Step 1: Run Discovery Script in Cloud Shell or CLI
              </strong>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="au-btn au-btn-secondary au-btn-xs"
                onClick={() => handleCopyScript(DISCOVERY_SCRIPT_POWERSHELL, "PowerShell")}
              >
                {copiedType === "PowerShell" ? <Check size={11} /> : <Copy size={11} />}
                <span>Copy PowerShell (.ps1)</span>
              </button>

              <button
                type="button"
                className="au-btn au-btn-secondary au-btn-xs"
                onClick={() => handleCopyScript(DISCOVERY_SCRIPT_CLI, "CLI")}
              >
                {copiedType === "CLI" ? <Check size={11} /> : <Copy size={11} />}
                <span>Copy Azure CLI</span>
              </button>

              <button
                type="button"
                className="au-btn au-btn-primary au-btn-xs"
                onClick={handleLoadSample}
              >
                <Sparkles size={11} />
                <span>Load Sample Tenant</span>
              </button>
            </div>
          </div>

          <pre
            style={{
              background: "rgba(0, 0, 0, 0.4)",
              padding: "10px 12px",
              borderRadius: "var(--radius-xs)",
              fontSize: "0.72rem",
              fontFamily: "var(--font-mono)",
              color: "var(--text-dim)",
              overflowX: "auto",
              margin: 0
            }}
          >
            {`# Azure Resource Graph one-liner export:\nSearch-AzGraph -Query "Resources | project id, name, type, location, resourceGroup, subscriptionId, tags" | ConvertTo-Json -Depth 10 > alz-brownfield-inventory.json`}
          </pre>
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
            placeholder='Paste JSON output here or click "Load Sample Tenant" above...'
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
