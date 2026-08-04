import React, { useState } from "react"
import { AlertCircle, CheckCircle2, DollarSign, TrendingUp } from "lucide-react"
import { formatCurrency } from "./formatCurrency.js"

export function EarningsStatsGrid({ summary = {}, isDark = false }) {
  const [showDeductionTooltip, setShowDeductionTooltip] = useState(false)

  const pfDeducted = Number(summary.pf_deducted || 0)
  const esiDeducted = Number(summary.esi_deducted || 0)
  const tdsDeducted = Number(summary.tds_deducted || 0)
  const combinedPfEsi = (pfDeducted + esiDeducted).toFixed(2)

  const cardStyle = {
    background: isDark ? "#111827" : "#ffffff",
    border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`,
    borderRadius: 16,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    position: "relative"
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {/* 1. Net Earnings */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "rgba(5, 150, 105, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <DollarSign size={14} color="#059669" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b" }}>
            Net earnings
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#059669", letterSpacing: "-0.02em" }}>
          {formatCurrency(summary.net_credited)}
        </div>
      </div>

      {/* 2. Jobs Completed */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "rgba(2, 132, 199, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <CheckCircle2 size={14} color="#0284c7" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b" }}>
            Jobs completed
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#f9fafb" : "#0f172a", letterSpacing: "-0.02em" }}>
          {summary.completed_jobs_count || 0}
        </div>
      </div>

      {/* 3. Gross Share */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "rgba(79, 70, 229, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <TrendingUp size={14} color="#4f46e5" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b" }}>
            Gross share
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#f9fafb" : "#0f172a", letterSpacing: "-0.02em" }}>
          {formatCurrency(summary.gross_earnings)}
        </div>
      </div>

      {/* 4. Deductions (PF/ESI combined, tap/hover for TDS) */}
      <div
        style={{ ...cardStyle, cursor: "pointer" }}
        onMouseEnter={() => setShowDeductionTooltip(true)}
        onMouseLeave={() => setShowDeductionTooltip(false)}
        onClick={() => setShowDeductionTooltip(v => !v)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "rgba(225, 29, 72, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <AlertCircle size={14} color="#e11d48" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b" }}>
              Deductions
            </span>
          </div>
        </div>

        <div style={{ fontSize: 16, fontWeight: 900, color: "#e11d48", letterSpacing: "-0.02em" }}>
          -{formatCurrency(combinedPfEsi)}
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#6b7280" : "#94a3b8" }}>
          PF: {formatCurrency(pfDeducted)} | ESI: {formatCurrency(esiDeducted)}
        </div>

        {/* Hover/Tap Tooltip with TDS breakdown */}
        {showDeductionTooltip && (
          <div
            style={{
              position: "absolute",
              bottom: "105%",
              right: 0,
              width: 180,
              background: isDark ? "#1f2937" : "#0f172a",
              color: "#ffffff",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 10,
              fontWeight: 700,
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ fontSize: 9, textTransform: "uppercase", opacity: 0.7 }}>Statutory Breakdown</div>
            <div>PF: {formatCurrency(pfDeducted)}</div>
            <div>ESI: {formatCurrency(esiDeducted)}</div>
            <div>TDS Tax: {formatCurrency(tdsDeducted)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
