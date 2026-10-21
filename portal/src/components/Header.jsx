import React, { useState } from "react";
import { ShieldCheck, Download, Plus, Settings, Archive, Sparkles, ChevronDown, Sun, Moon, Layers } from "lucide-react";
import { downloadBicepFile, downloadZipBundle } from "../engine/bundleExporter.js";
import { AuButton, AuBadge, AuDropdown, AuSelect } from "../theme";

export function Header({
  customers,
  activeCustomer,
  onSelectCustomer,
  onOpenCustomerModal,
  onOpenBrownfieldModal,
  onBumpVersion,
  catalog,
  onShowToast,
  themeMode,
  onToggleThemeMode,
}) {


  const handleDownloadBicep = () => {
    downloadBicepFile(activeCustomer, catalog);
    onShowToast(`Downloaded ${activeCustomer.name} Bicep template!`);
  };

  const handleDownloadZip = async () => {
    onShowToast("Packaging deployment bundle...");
    await downloadZipBundle(activeCustomer, catalog);
    onShowToast(`Downloaded ${activeCustomer.name} complete ALZ bundle (.zip)!`);
  };

  const isBrownfield = activeCustomer.environmentParadigm === "brownfield";

  return (
    <header className="header-bar">
      {/* Brand & Monospace Kicker */}
      <div className="logo-group">
        <div className="logo-icon" style={{ background: isBrownfield ? "var(--accent-amber)" : "var(--accent-primary)", color: "#06252D" }}>
          <ShieldCheck size={20} />
        </div>
        <div className="logo-text">
          <div className="au-kicker" style={{ fontSize: "0.68rem", marginBottom: "0.1rem" }}>
            AZURE GOVERNANCE
          </div>
          <h1>Landing Zone Studio</h1>
        </div>

        {/* Tenant Breadcrumb & Paradigm Badge */}
        <div style={{ marginLeft: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isBrownfield ? (
            <span className="au-badge au-badge-amber" style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}>
              <Layers size={11} style={{ marginRight: "4px" }} />
              BROWNFIELD
            </span>
          ) : (
            <span className="au-badge au-badge-mint" style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}>
              <Sparkles size={11} style={{ marginRight: "4px" }} />
              GREENFIELD
            </span>
          )}
          <span className="au-mono-meta">·</span>
          <span className="au-mono-meta">
            {activeCustomer.tenantId ? `Tenant: ${activeCustomer.tenantId.slice(0, 8)}...` : "Default Tenant"}
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="header-actions">
        {/* Customer Workspace Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ minWidth: "205px" }}>
            <AuSelect
              id="active-customer-select"
              aria-label="Active customer workspace selector"
              value={activeCustomer.id}
              onChange={onSelectCustomer}
              options={customers.map((c) => ({
                value: c.id,
                label: c.name,
                badge: c.environmentParadigm === "brownfield" ? "BF" : "GF"
              }))}
            />
          </div>

          {isBrownfield && (
            <AuButton
              variant="secondary"
              size="sm"
              onClick={onOpenBrownfieldModal}
              title="Import & Discover Existing Tenant Infrastructure"
              icon={<Layers size={14} style={{ color: "var(--accent-amber)" }} />}
            >
              <span style={{ color: "var(--accent-amber)" }}>Ingest Tenant</span>
            </AuButton>
          )}

          <AuButton
            variant="secondary"
            size="sm"
            onClick={() => onOpenCustomerModal("edit")}
            title="Edit Customer Profile & Settings"
            icon={<Settings size={14} />}
          >
            Profile
          </AuButton>

          <AuButton
            variant="secondary"
            size="sm"
            onClick={() => onOpenCustomerModal("create")}
            title="Create New Customer Workspace"
            icon={<Plus size={14} />}
          >
            New
          </AuButton>
        </div>

        {/* Semantic Version Badge & Quick Bump Dropdown with Auto-Close */}
        <AuDropdown
          trigger={
            <div
              className="au-badge"
              style={{ cursor: "pointer", padding: "0.35rem 0.75rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              title="Click to bump version"
            >
              <Sparkles size={11} style={{ color: "var(--accent-primary)" }} />
              <span>v{activeCustomer.version || "1.0.0"}</span>
              <ChevronDown size={11} />
            </div>
          }
          items={[
            {
              id: "patch",
              label: "+ Bump Patch (x.x.+1)",
              onClick: () => onBumpVersion("patch"),
            },
            {
              id: "minor",
              label: "+ Bump Minor (x.+1.0)",
              onClick: () => onBumpVersion("minor"),
            },
          ]}
        />


        {/* Theme Toggle (Dark Command / Light Editorial) */}
        <AuButton
          variant="secondary"
          size="sm"
          onClick={() => {
            onToggleThemeMode();
            onShowToast(`Switched to ${themeMode === "dark" ? "Light Editorial" : "Dark Command"} mode`);
          }}
          title={`Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`}
          aria-label={`Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`}
          icon={themeMode === "dark" ? <Sun size={13} style={{ color: "var(--accent-amber)" }} /> : <Moon size={13} style={{ color: "var(--accent-teal)" }} />}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
            {themeMode === "dark" ? "LIGHT" : "DARK"}
          </span>
        </AuButton>

        {/* Action Buttons */}
        <AuButton
          variant="secondary"
          size="sm"
          onClick={handleDownloadZip}
          title="Download complete deployment package as ZIP"
          icon={<Archive size={14} />}
        >
          Export ZIP
        </AuButton>

        <AuButton
          variant="primary"
          size="sm"
          onClick={handleDownloadBicep}
          title="Download Bicep policy template"
          icon={<Download size={14} />}
        >
          Download Bicep
        </AuButton>
      </div>
    </header>
  );
}
