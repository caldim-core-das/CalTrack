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
    <>
      <div
        id="trial-banner"
        className="premium-trial-capsule"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "none",
          borderRadius: 14,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          transformStyle: "preserve-3d",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
          transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          height: 38,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", transform: "translateZ(10px)" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "-0.2px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              animation: "textCycle 5s linear infinite",
              whiteSpace: "nowrap",
            }}
          >
            {cfg.label}
            {!isExpired && status !== "not_started" && (
              <span
                style={{
                  display: "inline-block",
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  animation: "pulseDot 1.2s infinite alternate, dotCycle 5s linear infinite",
                }}
              />
            )}
          </span>
        </div>

        <button
          id="trial-banner-upgrade-btn"
          className="btn premium-upgrade-button"
          onClick={handleUpgradeClick}
          style={{
            background: cfg.btnGrad,
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            padding: "5px 14px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            border: "none",
            cursor: "pointer",
            transform: "translateZ(15px)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            animation: "buttonCycle 5s linear infinite",
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
          .premium-trial-capsule {
            animation: bannerBob 6s ease-in-out infinite, borderCycle 5s linear infinite;
          }
          .premium-trial-capsule::before {
            content: "";
            position: absolute;
            top: 0;
            left: -150%;
            width: 50%;
            height: 100%;
            background: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.02) 20%,
              rgba(255, 255, 255, 0.12) 50%,
              rgba(255, 255, 255, 0.02) 80%,
              rgba(255, 255, 255, 0) 100%
            );
            transform: skewX(-25deg);
            pointer-events: none;
            animation: glassShimmer 5s ease-in-out infinite;
          }
          .premium-trial-capsule:hover {
            transform: translateZ(12px) rotateX(2deg) rotateY(-1deg);
            box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.15), 
                        0 0 15px rgba(255, 255, 255, 0.05);
          }
          @keyframes bannerBob {
            0% { transform: translateY(0px) rotateX(0.2deg); }
            50% { transform: translateY(-2px) rotateX(-0.2deg); }
            100% { transform: translateY(0px) rotateX(0.2deg); }
          }
          @keyframes glassShimmer {
            0% { left: -150%; }
            35% { left: 150%; }
            100% { left: 150%; }
          }
          @keyframes borderCycle {
            0% { 
              background: rgba(93, 95, 239, 0.08);
              box-shadow: 0 4px 12px -2px rgba(93, 95, 239, 0.15); 
            }
            20% { 
              background: rgba(236, 72, 153, 0.08);
              box-shadow: 0 4px 12px -2px rgba(236, 72, 153, 0.15); 
            }
            40% { 
              background: rgba(245, 158, 11, 0.08);
              box-shadow: 0 4px 12px -2px rgba(245, 158, 11, 0.15); 
            }
            60% { 
              background: rgba(16, 185, 129, 0.08);
              box-shadow: 0 4px 12px -2px rgba(16, 185, 129, 0.15); 
            }
            80% { 
              background: rgba(6, 182, 212, 0.08);
              box-shadow: 0 4px 12px -2px rgba(6, 182, 212, 0.15); 
            }
            100% { 
              background: rgba(93, 95, 239, 0.08);
              box-shadow: 0 4px 12px -2px rgba(93, 95, 239, 0.15); 
            }
          }
          @keyframes textCycle {
            0% { color: #818cf8; }
            20% { color: #f472b6; }
            40% { color: #fbbf24; }
            60% { color: #34d399; }
            80% { color: #22d3ee; }
            100% { color: #818cf8; }
          }
          @keyframes dotCycle {
            0% { background: #818cf8; box-shadow: 0 0 8px #818cf8; }
            20% { background: #f472b6; box-shadow: 0 0 8px #f472b6; }
            40% { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; }
            60% { background: #34d399; box-shadow: 0 0 8px #34d399; }
            80% { background: #22d3ee; box-shadow: 0 0 8px #22d3ee; }
            100% { background: #818cf8; box-shadow: 0 0 8px #818cf8; }
          }
          @keyframes buttonCycle {
            0% { box-shadow: 0 2px 8px rgba(93, 95, 239, 0.3); }
            20% { box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3); }
            40% { box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3); }
            60% { box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); }
            80% { box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3); }
            100% { box-shadow: 0 2px 8px rgba(93, 95, 239, 0.3); }
          }
          @keyframes pulseDot {
            from { transform: scale(0.8); opacity: 0.4; }
            to   { transform: scale(1.4); opacity: 1; }
          }
          @media (max-width: 1024px) {
            .premium-trial-capsule {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}
