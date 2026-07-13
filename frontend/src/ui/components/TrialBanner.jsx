import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Sparkles, ShieldAlert, Clock } from "lucide-react";
import { routes } from "../routes.js";
import { apiRequest } from "../../api/client.js";

export function TrialBanner() {
  const { status, daysRemaining } = useSelector((s) => s.trial);
  const navigate = useNavigate();

  if (!status || status === "converted") return null;

  const isExpired = status === "expired";
  const isUrgent  = daysRemaining <= 3;

  // Premium style configurations
  const theme = {
    not_started: {
      accent: "#5d5fef",
      btnGrad: "linear-gradient(135deg, #5d5fef 0%, #4749e8 100%)",
      label: "Unlock premium workforce management with a free 14-day trial",
      btnLabel: "Start Free Trial",
      icon: <Sparkles size={16} className="animate-sparkle-glow" style={{ color: "#5d5fef" }} />
    },
    active: {
      accent: "#5d5fef",
      btnGrad: "linear-gradient(135deg, #5d5fef 0%, #4749e8 100%)",
      label: `Free trial active: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`,
      btnLabel: "Upgrade Now",
      icon: <Sparkles size={16} className="animate-sparkle-glow" style={{ color: "#5d5fef" }} />
    },
    urgent: {
      accent: "#f59e0b",
      btnGrad: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      label: daysRemaining === 0 ? "Trial expires today!" : `Trial ending soon: only ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left!`,
      btnLabel: "Upgrade Now",
      icon: <Clock size={16} className="animate-spin-slow" style={{ color: "#f59e0b" }} />
    },
    expired: {
      accent: "#e94560",
      btnGrad: "linear-gradient(135deg, #e94560 0%, #d6344d 100%)",
      label: "Your free trial has ended — upgrade to restore full access",
      btnLabel: "Restore Access",
      icon: <ShieldAlert size={16} style={{ color: "#e94560" }} />
    }
  };

  const currentStatus = isExpired ? "expired" : status === "not_started" ? "not_started" : isUrgent ? "urgent" : "active";
  const cfg = theme[currentStatus] || theme.active;

  const handleUpgradeClick = async () => {
    try { await apiRequest("/trial/upgrade-click/", { method: "POST" }); } catch {}
    navigate(routes.settings_billing);
  };

  return (
    <div
      style={{
        padding: "12px 24px",
        perspective: "1000px",
        display: "flex",
        justifyContent: "center",
        zIndex: 9999,
        background: "transparent",
        pointerEvents: "none",
      }}
    >
      <div
        id="trial-banner"
        style={{
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 20,
          padding: "10px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          maxWidth: 960,
          width: "100%",
          boxShadow: "0 15px 35px -5px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          transformStyle: "preserve-3d",
          transform: "translateZ(0px) rotateX(0deg) rotateY(0deg)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s",
          animation: "floatCapsule 0.6s cubic-bezier(0.16, 1, 0.3, 1) both, borderCycle 4s linear infinite",
          pointerEvents: "auto",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateZ(15px) rotateX(3deg) rotateY(-1deg) translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateZ(0px) rotateX(0deg) rotateY(0deg)";
          e.currentTarget.style.boxShadow = "0 15px 35px -5px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, transform: "translateZ(10px)" }}>
          {cfg.icon}
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "-0.2px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "textCycle 4s linear infinite",
            }}
          >
            {cfg.label}
            {!isExpired && status !== "not_started" && (
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  animation: "pulseDot 1.2s infinite alternate, dotCycle 4s linear infinite",
                }}
              />
            )}
          </span>
        </div>

        <button
          id="trial-banner-upgrade-btn"
          className="btn"
          onClick={handleUpgradeClick}
          style={{
            background: cfg.btnGrad,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            padding: "8px 22px",
            borderRadius: 10,
            whiteSpace: "nowrap",
            border: "none",
            cursor: "pointer",
            transform: "translateZ(15px)",
            boxShadow: `0 4px 14px rgba(255,255,255,0.05)`,
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            animation: "buttonCycle 4s linear infinite",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateZ(20px) scale(1.03)";
            e.currentTarget.style.filter = "brightness(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateZ(15px) scale(1)";
            e.currentTarget.style.filter = "none";
          }}
        >
          {cfg.btnLabel}
        </button>

        <style>{`
          @keyframes floatCapsule {
            from { transform: translateY(-50px) scale(0.95); opacity: 0; }
            to   { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes borderCycle {
            0%, 100% { border-color: rgba(93, 95, 239, 0.4); box-shadow: 0 15px 35px -5px rgba(93, 95, 239, 0.15); }
            25%      { border-color: rgba(236, 72, 153, 0.4); box-shadow: 0 15px 35px -5px rgba(236, 72, 153, 0.15); }
            50%      { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 15px 35px -5px rgba(245, 158, 11, 0.15); }
            75%      { border-color: rgba(16, 185, 129, 0.4); box-shadow: 0 15px 35px -5px rgba(16, 185, 129, 0.15); }
          }
          @keyframes textCycle {
            0%, 100% { color: #818cf8; }
            25%      { color: #f472b6; }
            50%      { color: #fbbf24; }
            75%      { color: #34d399; }
          }
          @keyframes dotCycle {
            0%, 100% { background: #818cf8; box-shadow: 0 0 10px #818cf8; }
            25%      { background: #f472b6; box-shadow: 0 0 10px #f472b6; }
            50%      { background: #fbbf24; box-shadow: 0 0 10px #fbbf24; }
            75%      { background: #34d399; box-shadow: 0 0 10px #34d399; }
          }
          @keyframes buttonCycle {
            0%, 100% { box-shadow: 0 4px 14px rgba(93, 95, 239, 0.4); }
            25%      { box-shadow: 0 4px 14px rgba(236, 72, 153, 0.4); }
            50%      { box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4); }
            75%      { box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); }
          }
          @keyframes pulseDot {
            from { transform: scale(0.8); opacity: 0.4; }
            to   { transform: scale(1.4); opacity: 1; }
          }
          .animate-sparkle-glow {
            animation: sparkleGlow 1.5s ease-in-out infinite alternate;
          }
          @keyframes sparkleGlow {
            from { transform: scale(0.9) rotate(0deg); opacity: 0.8; }
            to   { transform: scale(1.15) rotate(15deg); opacity: 1; }
          }
          .animate-spin-slow {
            animation: spinSlow 12s linear infinite;
          }
          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
