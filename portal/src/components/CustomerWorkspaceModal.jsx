import React, { useState, useEffect } from "react";
import { Building2, MapPin, Sliders, Save, Trash2 } from "lucide-react";
import { AuModal, AuButton, AuSelect } from "../theme";

export function CustomerWorkspaceModal({
  isOpen,
  mode,
  customer,
  onClose,
  onSave,
  onDelete,
  canDelete
}) {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    abbreviation: "",
    subscriptionName: "",
    subscriptionCode: "",
    environment: "prod",
    version: "1.0.0",
    description: "",
    regionsText: "canadacentral: cc, canadaeast: ce",
    purposesText: "hub, core, monitoring, infrafw, apps",
    namingEffect: "Audit",
    subnetEffect: "Audit",
    tagEffect: "Audit",
    enforcementMode: "Default"
  });

  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    let initial;
    if (customer && mode === "edit") {
      const regionsStr = Object.entries(customer.regions || {})
        .map(([loc, code]) => `${loc}: ${code}`)
        .join(", ");

      const purposesStr = customer.purposes && customer.purposes.length > 0
        ? customer.purposes.join(", ")
        : "hub, core, monitoring, infrafw, apps";

      initial = {
        id: customer.id,
        name: customer.name || "",
        abbreviation: customer.abbreviation || "",
        subscriptionName: customer.subscriptionName || "",
        subscriptionCode: customer.subscriptionCode || "",
        environment: customer.environment || "prod",
        version: customer.version || "1.0.0",
        description: customer.description || "",
        regionsText: regionsStr || "canadacentral: cc, canadaeast: ce",
        purposesText: purposesStr,
        namingEffect: customer.namingEffect || "Audit",
        subnetEffect: customer.subnetEffect || "Audit",
        tagEffect: customer.tagEffect || "Audit",
        enforcementMode: customer.enforcementMode || "Default"
      };
    } else {
      initial = {
        id: `cust-${Date.now().toString().slice(-4)}`,
        name: "New Enterprise",
        abbreviation: "corp",
        subscriptionName: "LandingZone-Core",
        subscriptionCode: "CORE",
        environment: "prod",
        version: "1.0.0",
        description: "New customer landing zone policy workspace",
        regionsText: "canadacentral: cc, canadaeast: ce",
        purposesText: "hub, core, monitoring, infrafw, apps",
        namingEffect: "Audit",
        subnetEffect: "Audit",
        tagEffect: "Audit",
        enforcementMode: "Default"
      };
    }
    setFormData(initial);
    setInitialData(initial);
  }, [customer, mode, isOpen]);

  const isDirty = initialData !== null && JSON.stringify(formData) !== JSON.stringify(initialData);


  // Dismiss modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    // Parse regions text: "canadacentral: cc, canadaeast: ce"
    const parsedRegions = {};
    formData.regionsText.split(",").forEach((item) => {
      const [loc, code] = item.split(":").map((s) => s.trim().toLowerCase());
      if (loc && code) parsedRegions[loc] = code;
    });

    // Parse purposes text: "hub, core, monitoring, infrafw, apps"
    const parsedPurposes = formData.purposesText
      ? formData.purposesText.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : ["hub", "core", "monitoring", "infrafw", "apps"];

    const updated = {
      ...(customer && mode === "edit" ? customer : {}),
      id: formData.id,
      name: formData.name,
      abbreviation: formData.abbreviation.toLowerCase(),
      subscriptionName: formData.subscriptionName,
      subscriptionCode: formData.subscriptionCode.toUpperCase(),
      environment: formData.environment.toLowerCase(),
      version: formData.version,
      description: formData.description,
      regions: Object.keys(parsedRegions).length ? parsedRegions : { canadacentral: "cc" },
      purposes: parsedPurposes.length ? parsedPurposes : ["hub", "core", "monitoring", "infrafw", "apps"],
      purpose: parsedPurposes[0] || "core",
      namingEffect: formData.namingEffect,
      subnetEffect: formData.subnetEffect,
      tagEffect: formData.tagEffect,
      enforcementMode: formData.enforcementMode,
      geoRestrictions: (customer && customer.geoRestrictions) || {
        enabled: true,
        allowedLocations: ["canadacentral", "canadaeast"],
        effect: "Audit"
      },
      tagInheritance: (customer && customer.tagInheritance) || {
        enabled: true,
        effect: "modify",
        subToRg: ["CostCenter", "Owner"],
        rgToResource: ["Environment", "CostCenter", "Workload", "Owner"],
        defaultResourceNA: ["DataClassification", "Criticality"]
      }
    };

    onSave(updated, mode);
    onClose();
  };

  return (
    <AuModal
      isOpen={isOpen}
      onClose={onClose}
      isDirty={isDirty}
      kicker="ENTERPRISE WORKSPACE"
      title={mode === "create" ? "Create Customer Workspace" : `Edit Profile: ${customer?.name}`}
      maxWidth="720px"

      footer={
        <>
          {mode === "edit" && canDelete && (
            <AuButton
              type="button"
              variant="danger"
              size="sm"
              style={{ marginRight: "auto" }}
              onClick={() => {
                if (confirm(`Are you sure you want to delete workspace for ${formData.name}?`)) {
                  onDelete(formData.id);
                  onClose();
                }
              }}
              icon={<Trash2 size={14} />}
            >
              Delete Workspace
            </AuButton>
          )}

          <AuButton type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </AuButton>

          <AuButton type="button" variant="primary" size="sm" onClick={handleSubmit} icon={<Save size={14} />}>
            {mode === "create" ? "Create Workspace" : "Save Changes"}
          </AuButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Customer Organization Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label className="form-label" htmlFor="cust-name">Customer Name</label>
            <input
              id="cust-name"
              name="customer_name"
              type="text"
              required
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Contoso Health"
            />
            <span className="form-hint">Used for {`{ORGNAME}`} and {`{OrgName}`} tokens (Full Name)</span>
          </div>

          <div>
            <label className="form-label" htmlFor="cust-abbr">Customer Abbreviation</label>
            <input
              id="cust-abbr"
              name="customer_abbreviation"
              type="text"
              required
              className="form-input"
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
              placeholder="e.g. contoso or cust01"
            />
            <span className="form-hint">Used for {`{Org}`}, {`{org}`}, {`{ORG}`} tokens (Abbr)</span>
          </div>
        </div>

        {/* Subscription & Environment */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <div>
            <label className="form-label" htmlFor="cust-sub-name">Subscription Name</label>
            <input
              id="cust-sub-name"
              name="subscription_name"
              type="text"
              required
              className="form-input"
              value={formData.subscriptionName}
              onChange={(e) => setFormData({ ...formData, subscriptionName: e.target.value })}
              placeholder="e.g. Connectivity"
            />
            <span className="form-hint">Used for {`{SUBNAME}`} (Full Name)</span>
          </div>

          <div>
            <label className="form-label" htmlFor="cust-sub-code">Sub Code / Abbr</label>
            <input
              id="cust-sub-code"
              name="subscription_code"
              type="text"
              required
              className="form-input"
              value={formData.subscriptionCode}
              onChange={(e) => setFormData({ ...formData, subscriptionCode: e.target.value })}
              placeholder="e.g. CON, MGT, PRDA"
            />
            <span className="form-hint">Used for {`{SUB}`}, {`{sub}`} (Code)</span>
          </div>

          <div>
            <label className="form-label" htmlFor="cust-version">Version</label>
            <input
              id="cust-version"
              name="workspace_version"
              type="text"
              required
              className="form-input"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              placeholder="e.g. 1.0.0"
            />
          </div>
        </div>

        {/* Regions Mapping */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <MapPin size={13} style={{ color: "var(--accent-primary)" }} />
            <label className="form-label" htmlFor="cust-regions" style={{ margin: 0 }}>Azure Regions Mapping</label>
          </div>
          <input
            id="cust-regions"
            name="regions_mapping"
            type="text"
            required
            className="form-input form-input-mono"
            value={formData.regionsText}
            onChange={(e) => setFormData({ ...formData, regionsText: e.target.value })}
            placeholder="canadacentral: cc, canadaeast: ce, eastus: eus"
          />
          <span className="form-hint">Comma-separated pairs: `azureRegionName: shortCode`</span>
        </div>

        {/* Workload & Network Purposes */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <Sliders size={13} style={{ color: "var(--accent-primary)" }} />
            <label className="form-label" htmlFor="cust-purposes" style={{ margin: 0 }}>Workload & Network Purposes</label>
          </div>
          <input
            id="cust-purposes"
            name="workload_purposes"
            type="text"
            className="form-input form-input-mono"
            value={formData.purposesText}
            onChange={(e) => setFormData({ ...formData, purposesText: e.target.value })}
            placeholder="hub, core, monitoring, infrafw, apps"
          />
          <span className="form-hint">Comma-separated purpose list for {`{purpose}`} and {`{Purpose}`} tokens in subnets and resources</span>
        </div>

        {/* Default Policy Effects (Safety Controls) */}
        <div style={{ background: "var(--bg-canvas)", padding: "12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <Sliders size={13} style={{ color: "var(--accent-mint)" }} />
            <span className="au-mono-meta" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              DEFAULT POLICY ENFORCEMENT EFFECTS
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div>
              <AuSelect
                id="cust-naming-effect"
                label="Naming Effect"
                value={formData.namingEffect}
                onChange={(val) => setFormData({ ...formData, namingEffect: val })}
                options={[
                  { value: "Audit", label: "Audit (Safe)" },
                  { value: "Deny", label: "Deny (Enforce)" },
                  { value: "Disabled", label: "Disabled" }
                ]}
              />
            </div>

            <div>
              <AuSelect
                id="cust-subnet-effect"
                label="Subnet Effect"
                value={formData.subnetEffect}
                onChange={(val) => setFormData({ ...formData, subnetEffect: val })}
                options={[
                  { value: "Audit", label: "Audit (Safe)" },
                  { value: "Deny", label: "Deny (Enforce)" },
                  { value: "Disabled", label: "Disabled" }
                ]}
              />
            </div>

            <div>
              <AuSelect
                id="cust-tag-effect"
                label="Tag Effect"
                value={formData.tagEffect}
                onChange={(val) => setFormData({ ...formData, tagEffect: val })}
                options={[
                  { value: "Audit", label: "Audit (Safe)" },
                  { value: "Deny", label: "Deny (Enforce)" },
                  { value: "Disabled", label: "Disabled" }
                ]}
              />
            </div>
          </div>

        </div>
      </form>
    </AuModal>
  );
}
