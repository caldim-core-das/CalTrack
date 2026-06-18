import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { routes } from "../routes.js";
import { apiRequest } from "../../api/client.js";

export function TrialBanner() {
  const { status, daysRemaining, isActive } = useSelector((s) => s.trial);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  if (!status || status === "converted") return null;

  if (status === "not_started") {
    return (
      <div
        id="trial-banner"
        style={{
          background: `linear-gradient(90deg, #5d5fef22, #5d5fef11)`,
          borderBottom: `1px solid #5d5fef44`,
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          animation: "fadeUp 0.3s ease both",
        }}
      >
        <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 600 }}>
          Unlock premium features with a free 14-day trial
        </span>
        <button
          id="trial-banner-upgrade-btn"
          className="btn btnPrimary"
          onClick={() => navigate(routes.settings_billing)}
          style={{
            background: "#5d5fef",
            fontSize: 11,
            padding: "6px 16px",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
        >
          Start Free Trial
        </button>
      </div>
    );
  }

  const isExpired = status === "expired";
  const isUrgent  = daysRemaining <= 3;

  const accent = isExpired ? "#E94560" : isUrgent ? "#f59e0b" : "#5d5fef";

  const handleUpgradeClick = async () => {
    try { await apiRequest("/trial/upgrade-click/", { method: "POST" }); } catch {}
    navigate(routes.settings_billing);
  };

  const label = isExpired
    ? "Your free trial has ended — upgrade to restore access"
    : daysRemaining === 0
    ? "Trial expires today!"
    : `Free trial: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;

  return (
    <div
      id="trial-banner"
      style={{
        background: `linear-gradient(90deg, ${accent}22, ${accent}11)`,
        borderBottom: `1px solid ${accent}44`,
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        animation: "fadeUp 0.3s ease both",
      }}
    >
      <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 600 }}>
        {label}
      </span>
      <button
        id="trial-banner-upgrade-btn"
        className="btn btnPrimary"
        onClick={handleUpgradeClick}
        style={{
          background: accent,
          fontSize: 11,
          padding: "6px 16px",
          borderRadius: 8,
          whiteSpace: "nowrap",
        }}
      >
        {isExpired ? "Restore Access" : "Upgrade Now"}
      </button>
    </div>
  );
}
