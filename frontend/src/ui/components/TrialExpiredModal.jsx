import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Lock, LogOut, Check, Zap, Crown, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "../../state/auth/useAuth.js";
import { apiRequest } from "../../api/client.js";
import { fetchTrialStatus } from "../../store/trialSlice.js";

export function TrialExpiredModal() {
  const { status: trialStatus } = useSelector((s) => s.trial);
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (trialStatus !== "expired") return null;

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const handleUpgrade = async () => {
    setLoading(true);
    setError("");
    try {
      await apiRequest("/settings/billing/subscription/", {
        method: "POST",
        json: { plan: selectedPlan },
      });
      // Refresh trial status in Redux to unlock
      await dispatch(fetchTrialStatus()).unwrap();
    } catch (err) {
      setError(err?.body?.message || "Failed to upgrade subscription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 580,
          width: "100%",
          background: "rgba(30, 41, 59, 0.75)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          padding: "40px 32px",
          textAlign: "center",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          animation: "scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        {/* Animated Glowing Lock Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(233, 69, 96, 0.15)",
            border: "1px solid rgba(233, 69, 96, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 30px rgba(233, 69, 96, 0.2)",
            position: "relative",
            animation: "pulseGlow 2s infinite alternate",
          }}
        >
          <Lock size={36} color="#E94560" />
        </div>

        <div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #fff 40%, #cbd5e1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 10,
            }}
          >
            Trial Period Expired
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#94a3b8",
              lineHeight: 1.6,
              maxWidth: 440,
              margin: "0 auto",
            }}
          >
            {isAdmin
              ? "Your 14-day free trial of Caltrack has expired. Upgrade your plan now to restore full access to your workspace and keep collaborating."
              : "Your organization's 14-day free trial of Caltrack has expired. Please contact your system administrator to upgrade the plan and restore access."}
          </p>
        </div>

        {isAdmin && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Plan selection grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Pro Plan card */}
              <div
                onClick={() => setSelectedPlan("pro")}
                style={{
                  background: selectedPlan === "pro" ? "rgba(93, 95, 239, 0.15)" : "rgba(15, 23, 42, 0.3)",
                  border: selectedPlan === "pro" ? "2px solid #5d5fef" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: "20px 16px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Zap size={16} color={selectedPlan === "pro" ? "#5d5fef" : "#94a3b8"} />
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Pro Plan</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
                  $29<span style={{ fontSize: 12, fontWeight: 500, color: "#64748b" }}>/mo</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                  For growing teams needing GPS and scheduling.
                </div>
              </div>

              {/* Enterprise Plan card */}
              <div
                onClick={() => setSelectedPlan("enterprise")}
                style={{
                  background: selectedPlan === "enterprise" ? "rgba(124, 58, 237, 0.15)" : "rgba(15, 23, 42, 0.3)",
                  border: selectedPlan === "enterprise" ? "2px solid #7c3aed" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: "20px 16px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Crown size={16} color={selectedPlan === "enterprise" ? "#7c3aed" : "#94a3b8"} />
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Enterprise</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
                  $99<span style={{ fontSize: 12, fontWeight: 500, color: "#64748b" }}>/mo</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                  For large organizations needing custom scaling.
                </div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#f87171",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontSize: 12,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Upgrade Action Button */}
            <button
              onClick={handleUpgrade}
              disabled={loading}
              style={{
                width: "100%",
                background: selectedPlan === "pro" ? "linear-gradient(135deg, #5d5fef 0%, #3b82f6 100%)" : "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                border: "none",
                borderRadius: 14,
                padding: "16px 24px",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: selectedPlan === "pro" ? "0 10px 25px rgba(93, 95, 239, 0.25)" : "0 10px 25px rgba(124, 58, 237, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.filter = "brightness(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.filter = "none";
              }}
            >
              {loading ? (
                <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <Check size={16} />
              )}
              {loading ? "Upgrading Workspace..." : `Upgrade to ${selectedPlan === "pro" ? "Pro" : "Enterprise"} Plan`}
            </button>
          </div>
        )}

        {/* Separator / Logout section */}
        <div
          style={{
            width: "100%",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            paddingTop: 24,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => logout()}
            style={{
              background: "none",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 12,
              padding: "10px 20px",
              color: "#94a3b8",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            <LogOut size={14} />
            Sign Out of Account
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseGlow {
          from { box-shadow: 0 0 20px rgba(233, 69, 96, 0.15); border-color: rgba(233, 69, 96, 0.25); }
          to   { box-shadow: 0 0 35px rgba(233, 69, 96, 0.35); border-color: rgba(233, 69, 96, 0.55); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
