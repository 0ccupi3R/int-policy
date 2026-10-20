import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass-card"
          style={{
            padding: "32px",
            margin: "24px 0",
            borderLeft: "4px solid var(--accent-rose)",
            background: "linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(17, 24, 39, 0.9) 100%)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <AlertTriangle size={28} color="var(--accent-rose)" />
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#f87171" }}>
                Component Rendering Error
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                {this.props.fallbackTitle || "An unexpected error occurred while rendering this tab."}
              </p>
            </div>
          </div>

          <div
            style={{
              padding: "12px 16px",
              background: "#080c14",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8rem",
              color: "#fca5a5",
              marginBottom: "20px",
              overflowX: "auto"
            }}
          >
            {this.state.error?.toString()}
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={this.handleReset}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
