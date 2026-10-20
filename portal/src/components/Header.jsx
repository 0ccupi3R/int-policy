import React, { useState } from "react";
import { ShieldCheck, Download, Plus, Settings, Archive, Sparkles, ChevronDown } from "lucide-react";
import { downloadBicepFile, downloadZipBundle } from "../engine/bundleExporter.js";

export function Header({
  customers,
  activeCustomer,
  onSelectCustomer,
  onOpenCustomerModal,
  onBumpVersion,
  catalog,
  onShowToast
}) {
  const [showVersionMenu, setShowVersionMenu] = useState(false);

  const handleDownloadBicep = () => {
    downloadBicepFile(activeCustomer, catalog);
    onShowToast(`Downloaded ${activeCustomer.name} Bicep template!`);
  };

  const handleDownloadZip = async () => {
    onShowToast("Packaging deployment bundle...");
    await downloadZipBundle(activeCustomer, catalog);
    onShowToast(`Downloaded ${activeCustomer.name} complete ALZ bundle (.zip)!`);
  };

  return (
    <header className="header-bar">
      <div className="logo-group">
        <div className="logo-icon">
          <ShieldCheck size={22} />
        </div>
        <div className="logo-text">
          <h1>Azure Policy Studio</h1>
          <span>Landing Zone Architect</span>
        </div>
      </div>

      <div className="header-actions">
        {/* Customer Workspace Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            className="form-input"
            style={{ width: "auto", minWidth: "180px", cursor: "pointer", fontWeight: "600" }}
            value={activeCustomer.id}
            onChange={(e) => onSelectCustomer(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subscriptionCode})
              </option>
            ))}
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenCustomerModal("edit")}
            title="Edit Customer Profile & Settings"
          >
            <Settings size={15} />
            <span>Profile</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenCustomerModal("create")}
            title="Create New Customer Workspace"
          >
            <Plus size={15} />
            <span>New Customer</span>
          </button>
        </div>

        {/* Semantic Version Badge & Quick Bump */}
        <div style={{ position: "relative" }}>
          <button
            className="chip chip-purple"
            style={{ cursor: "pointer", border: "1px solid rgba(139, 92, 246, 0.4)", padding: "6px 12px" }}
            onClick={() => setShowVersionMenu(!showVersionMenu)}
            title="Click to bump version"
          >
            <Sparkles size={12} />
            <span>v{activeCustomer.version || "1.0.0"}</span>
            <ChevronDown size={12} />
          </button>

          {showVersionMenu && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "6px",
                background: "#162032",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                zIndex: 60,
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                minWidth: "150px"
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onBumpVersion("patch");
                  setShowVersionMenu(false);
                }}
              >
                + Bump Patch (x.x.+1)
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", width: "100%" }}
                onClick={() => {
                  onBumpVersion("minor");
                  setShowVersionMenu(false);
                }}
              >
                + Bump Minor (x.+1.0)
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <button className="btn btn-outline-azure" onClick={handleDownloadZip} title="Download complete deployment package as ZIP">
          <Archive size={16} />
          <span>ZIP Package</span>
        </button>

        <button className="btn btn-primary" onClick={handleDownloadBicep} title="Download Bicep policy template">
          <Download size={16} />
          <span>Download Bicep</span>
        </button>
      </div>
    </header>
  );
}
