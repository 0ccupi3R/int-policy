import React, { useState } from "react";
import { ShieldCheck, Download, Plus, Settings, Archive, Sparkles, ChevronDown, Sun, Moon, Palette } from "lucide-react";
import { downloadBicepFile, downloadZipBundle } from "../engine/bundleExporter.js";

export function Header({
  customers,
  activeCustomer,
  onSelectCustomer,
  onOpenCustomerModal,
  onBumpVersion,
  catalog,
  onShowToast,
  themeMode,
  onToggleThemeMode,
  themePalette,
  onSelectPalette
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
            id="active-customer-select"
            name="active_customer_id"
            aria-label="Active customer workspace selector"
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
            aria-haspopup="true"
            aria-expanded={showVersionMenu}
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
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                zIndex: 60,
                boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
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

        {/* Multi-Palette Theme Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "var(--bg-surface-elevated)",
            padding: "2px 6px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)"
          }}
        >
          {/* Palette Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Palette size={13} style={{ color: "var(--text-muted)", marginLeft: "4px" }} />
            <select
              aria-label="Theme visual palette selector"
              value={themePalette}
              onChange={(e) => {
                onSelectPalette(e.target.value);
                const nameMap = {
                  linear: "Linear / Stripe Slate",
                  catppuccin: "Catppuccin Latte",
                  nord: "Nord Arctic Frost",
                  stone: "Warm Ceramic Stone",
                  azure: "Azure Fluent",
                  primer: "GitHub Primer",
                  cloudscape: "Cloudscape Console"
                };
                onShowToast(`Switched palette to ${nameMap[e.target.value] || e.target.value}`);
              }}
              className="form-input"
              style={{
                fontSize: "0.78rem",
                padding: "4px 6px",
                width: "auto",
                border: "none",
                background: "transparent",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              <optgroup label="Modern Internet (Zero Eye Strain)">
                <option value="linear">Linear / Stripe Slate</option>
                <option value="catppuccin">Catppuccin Latte (Warm Paper)</option>
                <option value="nord">Nord Arctic Frost</option>
                <option value="stone">Warm Ceramic (Stone)</option>
              </optgroup>
              <optgroup label="Calibrated Cloud Consoles">
                <option value="azure">Azure Fluent</option>
                <option value="primer">GitHub Primer</option>
                <option value="cloudscape">Cloudscape Console</option>
              </optgroup>
            </select>
          </div>

          <div style={{ width: "1px", height: "16px", background: "var(--border-subtle)" }} />

          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={() => {
              onToggleThemeMode();
              onShowToast(`Switched to ${themeMode === "dark" ? "Light" : "Dark"} mode`);
            }}
            className="btn btn-sm"
            style={{
              padding: "4px 8px",
              background: "transparent",
              border: "none",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: "600"
            }}
            title={`Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`}
            aria-label={`Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`}
          >
            {themeMode === "dark" ? (
              <>
                <Moon size={14} style={{ color: "var(--azure-cyan)" }} />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun size={14} style={{ color: "var(--accent-amber)" }} />
                <span>Light</span>
              </>
            )}
          </button>
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
