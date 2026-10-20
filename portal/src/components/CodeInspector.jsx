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

export function CodeInspector({ customer, catalog, onShowToast }) {
  const [activeFileTab, setActiveFileTab] = useState("bicep");
  const [hasCopied, setHasCopied] = useState(false);

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

  switch (activeFileTab) {
    case "bicep":
      currentContent = bicepCode;
      currentFilename = "main.bicep";
      break;
    case "bicepparam":
      currentContent = bicepParamsCode;
      currentFilename = "resources.bicepparam";
      break;
    case "resbicep":
      currentContent = companionBicepCode;
      currentFilename = "resources.bicep";
      break;
    case "arm":
      currentContent = armJson;
      currentFilename = "main.json";
      break;
    case "params":
      currentContent = paramsJson;
      currentFilename = "parameters.json";
      break;
    case "ps1":
      currentContent = ps1Code;
      currentFilename = "Deploy-Audit.ps1";
      break;
    case "sh":
      currentContent = shCode;
      currentFilename = "deploy.sh";
      break;
    case "json":
      currentContent = customerJson;
      currentFilename = "customer-profile.json";
      break;
    default:
      currentContent = bicepCode;
      currentFilename = "main.bicep";
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setHasCopied(true);
    onShowToast(`Copied ${currentFilename} to clipboard!`);
    setTimeout(() => setHasCopied(false), 2000);
  };

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
  const byteSize = new Blob([currentContent]).size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* File Tabs & Actions */}
      <div className="glass-panel" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          {/* File Selector Tabs */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              { id: "bicep", label: "main.bicep", badge: "Policy Bicep" },
              { id: "bicepparam", label: "resources.bicepparam", badge: "Topology Params" },
              { id: "resbicep", label: "resources.bicep", badge: "Provisioning" },
              { id: "arm", label: "main.json", badge: "ARM Template" },
              { id: "params", label: "parameters.json", badge: "Policy Params" },
              { id: "ps1", label: "Deploy-Audit.ps1", badge: "PowerShell" },
              { id: "sh", label: "deploy.sh", badge: "Bash" },
              { id: "json", label: "customer.json", badge: "Config" }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`btn btn-sm ${activeFileTab === tab.id ? "btn-primary" : "btn-secondary"}`}
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
                onClick={() => setActiveFileTab(tab.id)}
              >
                <FileCode size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {hasCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{hasCopied ? "Copied!" : "Copy Code"}</span>
            </button>

            <button className="btn btn-secondary btn-sm" onClick={handleDownloadSingle}>
              <Download size={14} />
              <span>Download File</span>
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                downloadBicepFile(customer, catalog);
                onShowToast("Downloaded Bicep template!");
              }}
            >
              <Download size={14} />
              <span>Download Bicep</span>
            </button>

            <button
              className="btn btn-outline-azure btn-sm"
              onClick={async () => {
                onShowToast("Generating full ZIP bundle...");
                await downloadZipBundle(customer, catalog);
                onShowToast("Downloaded complete deployment ZIP!");
              }}
            >
              <Archive size={14} />
              <span>Download Bundle (.zip)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Code Viewer Container */}
      <div className="code-container">
        <div className="code-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: "600", color: "var(--azure-cyan)" }}>{currentFilename}</span>
            <span className="chip" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
              {lineCount} Lines
            </span>
            <span className="chip" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
              {(byteSize / 1024).toFixed(1)} KB
            </span>
          </div>

          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            Customer: {customer.name} | Version: v{customer.version}
          </span>
        </div>

        <pre className="code-pre">
          <code>{currentContent}</code>
        </pre>
      </div>
    </div>
  );
}
