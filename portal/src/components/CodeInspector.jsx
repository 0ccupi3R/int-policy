import React, { useState } from "react";
import { generateBicep } from "../engine/bicepGenerator.js";
import { generateArmTemplate } from "../engine/armGenerator.js";
import { generateDeployPs1, generateDeploySh, downloadBicepFile, downloadZipBundle } from "../engine/bundleExporter.js";
import {
  generateBicepParameters,
  generateCompanionResourcesBicep,
  getBaselineTopology
} from "../engine/topologyGenerator.js";
import { Copy, Download, Archive, Check, FileCode } from "lucide-react";
import { AuHudCard, AuButton, AuBadge, AuCodeViewer } from "../theme";

export function CodeInspector({ customer, catalog, onShowToast }) {
  const [activeFileTab, setActiveFileTab] = useState("bicep");

  const bicepCode = generateBicep(customer, catalog);
  const { template, parameters } = generateArmTemplate(customer, catalog);
  const ps1Code = generateDeployPs1(customer);
  const shCode = generateDeploySh(customer);
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
    { id: "bicep", label: "main.bicep", badge: "Policy" },
    { id: "bicepparam", label: "resources.bicepparam", badge: "Topology" },
    { id: "resbicep", label: "resources.bicep", badge: "Provisioning" },
    { id: "arm", label: "main.json", badge: "ARM" },
    { id: "params", label: "parameters.json", badge: "Params" },
    { id: "ps1", label: "Deploy-Audit.ps1", badge: "PS" },
    { id: "sh", label: "deploy.sh", badge: "Bash" },
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
                await downloadZipBundle(customer, catalog);
                onShowToast("Downloaded complete ALZ deployment ZIP!");
              }}
              icon={<Archive size={13} />}
            >
              Export Full Bundle (.zip)
            </AuButton>
          </div>
        }
      >
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
