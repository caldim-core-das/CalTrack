import React from "react"
import { Download, History, Loader2, Wallet, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { formatCurrency } from "./formatCurrency.js"

export function WalletBalanceHero({
  balance = "0.00",
  availableBalance = null,
  pendingBalance = null,
  nextSettlementDate = null,
  onDownload = () => {},
  onHistory = () => {},
  downloading = false,
  hasCreditedTx = false,
  isDark = false
}) {
  const hasBalanceSplit = availableBalance !== null && pendingBalance !== null

  return (
    <div
      style={{
        background: isDark
          ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)"
          : "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
        borderRadius: 20,
        padding: "20px 22px",
        color: "#ffffff",
        boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Decorative background glow */}
      <div
        style={{
          position: "absolute",
          right: "-20px",
          top: "-20px",
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.08)",
          pointerEvents: "none"
        }}
      />

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255, 255, 255, 0.75)"
            }}
          >
            Wallet Balance
          </span>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 900,
              margin: "4px 0 0 0",
              letterSpacing: "-0.03em",
              color: "#ffffff"
            }}
          >
            {formatCurrency(balance)}
          </h2>
        </div>

        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Wallet size={22} color="#ffffff" />
        </div>
      </div>

      {/* Available / Pending balance split */}
      {hasBalanceSplit && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            background: "rgba(0,0,0,0.18)",
            borderRadius: 12,
            padding: "10px 12px"
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>
              Available
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#a5f3a0" }}>
              {formatCurrency(availableBalance)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>
              Pending settlement
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>
              {formatCurrency(pendingBalance)}
            </div>
          </div>
        </div>
      )}

      {/* Next settlement date chip */}
      {nextSettlementDate && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={12} color="rgba(255,255,255,0.7)" />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
            Next settlement: <strong style={{ color: "#fff" }}>{nextSettlementDate}</strong>
          </span>
        </div>
      )}

      {/* Action buttons side-by-side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          type="button"
          disabled={!hasCreditedTx || downloading}
          onClick={onDownload}
          title={!hasCreditedTx ? "No credited transactions available to download payslip" : "Download latest payslip PDF"}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "none",
            background: !hasCreditedTx ? "rgba(255, 255, 255, 0.3)" : "#ffffff",
            color: !hasCreditedTx ? "rgba(255, 255, 255, 0.7)" : "#4f46e5",
            fontSize: 12,
            fontWeight: 800,
            cursor: !hasCreditedTx || downloading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 0.2s ease",
            boxShadow: hasCreditedTx ? "0 4px 12px rgba(0, 0, 0, 0.15)" : "none"
          }}
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          <span>Download payslip</span>
        </button>

        <button
          type="button"
          onClick={onHistory}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1.5px solid rgba(255, 255, 255, 0.4)",
            background: "transparent",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 0.2s ease"
          }}
        >
          <History size={14} />
          <span>History</span>
        </button>
      </div>
    </div>
  )
}
