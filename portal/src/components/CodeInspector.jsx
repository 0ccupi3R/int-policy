import React, { useState } from "react";
import { generateBicep } from "../engine/bicepGenerator.js";
import { generateArmTemplate } from "../engine/armGenerator.js";
import {
  generateDeployPs1,
  generateDeploySh,
  generateApplyResourceTagsPs1,
  generateApplyResourceTagsSh,
  downloadBicepFile,
  downloadZipBundle
} from "../engine/bundleExporter.js";
import {
  generateBicepParameters,
  generateCompanionResourcesBicep,
  getBaselineTopology
} from "../engine/topologyGenerator.js";
import { Copy, Download, Archive, Check, FileCode, Layers, ShieldCheck } from "lucide-react";
import { AuHudCard, AuButton, AuBadge, AuCodeViewer } from "../theme";

export function CodeInspector({ customer, catalog, onShowToast }) {
  const [activeFileTab, setActiveFileTab] = useState("bicep");

  // Modular Policy Scope: "both" | "naming" | "tagging"
  const [policyScope, setPolicyScope] = useState(() => {
    if (customer.policyModules) {
      if (customer.policyModules.naming && !customer.policyModules.tags) return "naming";
      if (!customer.policyModules.naming && customer.policyModules.tags) return "tagging";
    }
    return "both";
  });

  const bicepCode = generateBicep(customer, catalog, { policyScope });
  const { template, parameters } = generateArmTemplate(customer, catalog, { policyScope });
  const ps1Code = generateDeployPs1(customer);
  const shCode = generateDeploySh(customer);
  const applyTagsPs1Code = generateApplyResourceTagsPs1(customer, catalog);
  const applyTagsShCode = generateApplyResourceTagsSh(customer, catalog);
  const customerJson = JSON.stringify(customer, null, 2);
  const armJson = JSON.stringify(template, null, 2);
  const paramsJson = JSON.stringify(parameters, null, 2);

  const topology = customer.topology || getBaselineTopology(customer);
  const bicepParamsCode = generateBicepParameters(customer, topology, catalog);
  const companionBicepCode = generateCompanionResourcesBicep(customer, topology);

  let currentContent = "";
  let currentFilename = "";
  let currentLang = "bicep";

  switch (activeFileTab) {
    case "bicep":
      currentContent = bicepCode;
      currentFilename = "main.bicep";
      currentLang = "bicep";
      break;
    case "bicepparam":
      currentContent = bicepParamsCode;
      currentFilename = "resources.bicepparam";
      currentLang = "bicep";
      break;
    case "resbicep":
      currentContent = companionBicepCode;
      currentFilename = "resources.bicep";
      currentLang = "bicep";
      break;
    case "arm":
      currentContent = armJson;
      currentFilename = "main.json";
      currentLang = "json";
      break;
    case "params":
      currentContent = paramsJson;
      currentFilename = "parameters.json";
      currentLang = "json";
      break;
    case "applyTagsPs1":
      currentContent = applyTagsPs1Code;
      currentFilename = "Apply-ResourceTags.ps1";
      currentLang = "powershell";
      break;
    case "applyTagsSh":
      currentContent = applyTagsShCode;
      currentFilename = "apply-tags.sh";
      currentLang = "bash";
      break;
    case "ps1":
      currentContent = ps1Code;
      currentFilename = "Deploy-Audit.ps1";
      currentLang = "powershell";
      break;
    case "sh":
      currentContent = shCode;
      currentFilename = "deploy.sh";
      currentLang = "bash";
      break;
    case "json":
      currentContent = customerJson;
      currentFilename = "customer-profile.json";
      currentLang = "json";
      break;
    default:
      currentContent = bicepCode;
      currentFilename = "main.bicep";
      currentLang = "bicep";
  }

  const handleDownloadSingle = () => {
    const blob = new Blob([currentContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Downloaded ${currentFilename}`);
  };

  const lineCount = currentContent.split("\n").length;
  const byteSize = `${(new Blob([currentContent]).size / 1024).toFixed(1)} KB`;

  const fileTabs = [
    { id: "bicep", label: "main.bicep", badge: policyScope === "both" ? "Policy Full" : policyScope === "naming" ? "Naming Only" : "Tags Only" },
    { id: "bicepparam", label: "resources.bicepparam", badge: "Topology" },
    { id: "resbicep", label: "resources.bicep", badge: "Provisioning" },
    { id: "arm", label: "main.json", badge: "ARM" },
    { id: "params", label: "parameters.json", badge: "Params" },
    { id: "applyTagsPs1", label: "Apply-ResourceTags.ps1", badge: "Tag Ops PS" },
    { id: "applyTagsSh", label: "apply-tags.sh", badge: "Tag Ops Bash" },
    { id: "ps1", label: "Deploy-Audit.ps1", badge: "PS Deploy" },
    { id: "sh", label: "deploy.sh", badge: "Bash Deploy" },
    { id: "json", label: "customer.json", badge: "Config" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* HUD Telemetry File Navigator */}
      <AuHudCard
        kicker="INFRASTRUCTURE AS CODE COMPILER"
        title="Artifact & Policy Template Inspector"
        meta={`Target Workspace: ${customer.name} · v${customer.version || "1.0.0"} · ${fileTabs.length} Artifacts Generated`}
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <AuButton
              variant="secondary"
              size="sm"
              onClick={handleDownloadSingle}
              icon={<Download size={13} />}
            >
              Download {currentFilename}
            </AuButton>

            <AuButton
              variant="primary"
              size="sm"
              onClick={async () => {
                onShowToast("Packaging full deployment ZIP bundle...");
                await downloadZipBundle(customer, catalog, { policyScope });
                onShowToast("Downloaded complete ALZ deployment ZIP!");
              }}
              icon={<Archive size={13} />}
            >
              Export Full Bundle (.zip)
            </AuButton>
          </div>
        }
      >
        {/* Policy Scope Selector Pill Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "14px",
            padding: "10px 14px",
            background: "var(--surface-bg-alt)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            <ShieldCheck size={14} style={{ color: "var(--accent-mint)" }} />
            <span>POLICY INITIATIVE SCOPE:</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`au-btn au-btn-sm ${policyScope === "both" ? "au-btn-primary" : "au-btn-secondary"}`}
              style={{ fontSize: "0.76rem", padding: "0.25rem 0.65rem" }}
              onClick={() => {
                setPolicyScope("both");
                onShowToast("Policy scope set to: Both Initiatives (Naming + Tag Governance)");
              }}
            >
              Both Initiatives (Full CAF)
            </button>
            <button
              type="button"
              className={`au-btn au-btn-sm ${policyScope === "naming" ? "au-btn-primary" : "au-btn-secondary"}`}
              style={{ fontSize: "0.76rem", padding: "0.25rem 0.65rem" }}
              onClick={() => {
                setPolicyScope("naming");
                onShowToast("Policy scope set to: Naming & Geo-Boundary Only");
              }}
            >
              Naming & Geo Only
            </button>
            <button
              type="button"
              className={`au-btn au-btn-sm ${policyScope === "tagging" ? "au-btn-primary" : "au-btn-secondary"}`}
              style={{ fontSize: "0.76rem", padding: "0.25rem 0.65rem" }}
              onClick={() => {
                setPolicyScope("tagging");
                onShowToast("Policy scope set to: Tag Governance Only");
              }}
            >
              Tag Governance Only
            </button>
          </div>
        </div>

        {/* File Selectors */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {fileTabs.map((tab) => {
            const isActive = activeFileTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`au-btn au-btn-sm ${isActive ? "au-btn-primary" : "au-btn-secondary"}`}
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}
                onClick={() => setActiveFileTab(tab.id)}
              >
                <FileCode size={13} />
                <span>{tab.label}</span>
                <span className={`au-badge ${isActive ? "au-badge-mint" : ""}`} style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </AuHudCard>

      {/* Code Viewer */}
      <AuCodeViewer
        code={currentContent}
        language={currentLang}
        filename={currentFilename}
        lineCount={lineCount}
        byteSize={byteSize}
        onCopy={() => onShowToast(`Copied ${currentFilename} to clipboard!`)}
      />
    </div>
  );
}
