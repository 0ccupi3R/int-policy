import React from "react";
import { ChevronRight, ChevronLeft, Check, Sparkles, Layers, ArrowRight } from "lucide-react";
import { AuButton, AuBadge } from "../theme";

export function GuidedStepper({ activeTab, onSelectTab, customer }) {
  const isBrownfield = customer?.environmentParadigm === "brownfield";

  const steps = [
    {
      id: "topology",
      num: "01",
      title: "Topology & Scopes",
      hint: isBrownfield
        ? "Review discovered tenant subscriptions, management groups, and resource groups."
        : "Scaffold core platform subscriptions (4-Sub Core or 5-Sub Full) and configure RG tag overrides."
    },
    {
      id: "naming",
      num: "02",
      title: "Naming Studio",
      hint: isBrownfield
        ? "Inspect auto-inferred legacy naming patterns and approve regex conventions."
        : "Configure type-specific dynamic naming rules ({Org}-{SUB}-{RG}-{abbr}) and test sandbox."
    },
    {
      id: "tagging",
      num: "03",
      title: "Tag Governance",
      hint: isBrownfield
        ? "Perform gap audit against CAF baselines and establish remediation tag sets."
        : "Apply 1-click CAF baseline tags (Owner, CostCenter, Env) across Subscription, RG, and Resource scopes."
    },
    {
      id: "catalogue",
      num: "04",
      title: "Resource Catalog",
      hint: "Browse 200 Azure resource types, verify shortcodes, constraints, and mode: Indexed tagging support."
    },
    {
      id: "inspector",
      num: "05",
      title: "IaC & Policy Export",
      hint: isBrownfield
        ? "Export non-breaking Audit policy initiatives, remediation tasks, and in-place Apply-ResourceTags.ps1."
        : "Export clean-slate Bicep/ARM policies, bicepparam with resolved tag dictionaries, and full deployment ZIP."
    }
  ];

  const currentIndex = steps.findIndex((s) => s.id === activeTab);
  const activeStep = steps[currentIndex] || steps[0];

  const handleNext = () => {
    if (currentIndex < steps.length - 1) {
      onSelectTab(steps[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectTab(steps[currentIndex - 1].id);
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        flexWrap: "wrap",
        border: isBrownfield
          ? "1px solid rgba(245, 158, 11, 0.3)"
          : "1px solid rgba(16, 185, 129, 0.3)"
      }}
    >
      {/* Left: Stepper Breadcrumb / Pills */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
          {isBrownfield ? (
            <span className="au-badge au-badge-amber" style={{ fontSize: "0.68rem" }}>
              <Layers size={11} style={{ marginRight: "3px" }} />
              BROWNFIELD
            </span>
          ) : (
            <span className="au-badge au-badge-mint" style={{ fontSize: "0.68rem" }}>
              <Sparkles size={11} style={{ marginRight: "3px" }} />
              GREENFIELD
            </span>
          )}
        </div>

        {steps.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isCompleted = idx < currentIndex;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onSelectTab(step.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: isActive
                    ? (isBrownfield ? "var(--accent-amber-tint)" : "var(--accent-mint-tint)")
                    : "transparent",
                  border: isActive
                    ? (isBrownfield ? "1px solid var(--accent-amber)" : "1px solid var(--accent-mint)")
                    : "1px solid transparent",
                  borderRadius: "var(--radius-xs)",
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: isActive
                    ? (isBrownfield ? "var(--accent-amber)" : "var(--accent-mint)")
                    : (isCompleted ? "var(--text-secondary)" : "var(--text-muted)"),
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.74rem",
                  transition: "all var(--ease-snappy)"
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    background: isActive
                      ? (isBrownfield ? "var(--accent-amber)" : "var(--accent-mint)")
                      : (isCompleted ? "var(--border-subtle)" : "rgba(255, 255, 255, 0.05)"),
                    color: isActive ? "#061A1D" : "inherit"
                  }}
                >
                  {isCompleted ? <Check size={10} /> : step.num}
                </span>
                <span style={{ fontWeight: isActive ? 600 : 500 }}>{step.title}</span>
              </button>

              {idx < steps.length - 1 && (
                <ChevronRight size={13} style={{ color: "var(--text-dim)", margin: "0 -2px" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right: Step Guidance & Next/Previous Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span
          className="au-mono-meta"
          style={{
            fontSize: "0.74rem",
            color: "var(--text-secondary)",
            maxWidth: "380px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
          title={activeStep.hint}
        >
          {activeStep.hint}
        </span>

        <div style={{ display: "flex", gap: "6px" }}>
          <AuButton
            variant="secondary"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            icon={<ChevronLeft size={13} />}
            title="Go to previous workflow step"
          >
            Prev
          </AuButton>

          <AuButton
            variant="primary"
            size="sm"
            onClick={handleNext}
            disabled={currentIndex === steps.length - 1}
            icon={<ArrowRight size={13} />}
            title="Advance to next workflow step"
          >
            Next
          </AuButton>
        </div>
      </div>
    </div>
  );
}
