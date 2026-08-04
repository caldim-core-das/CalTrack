import React from "react"
import { Download, FileText, Loader2 } from "lucide-react"
import { formatCurrency } from "./formatCurrency.js"

export function PayoutCard({
  transaction = {},
  onDownloadPayslip = () => {},
  downloading = false,
  isDark = false
}) {
  const status = (transaction.status || "PENDING").toUpperCase()
  const isCredited = status === "CREDITED"
  const isReversed = status === "REVERSED" || status === "FAILED" || status === "CANCELLED"
  const isPending = status === "PENDING"

  // Relative date or clean date string
  const rawDate = transaction.created_at || ""
  const dateDisplay = rawDate ? rawDate.slice(0, 10) + " " + rawDate.slice(11, 16) : "Recent"

  // Status Badge styling & accessible label
  const statusMeta = isCredited
    ? { label: "Credited", bg: isDark ? "rgba(21, 128, 61, 0.2)" : "#dcfce7", color: isDark ? "#4ade80" : "#15803d", aria: "Status: Credited" }
    : isReversed
    ? { label: "Reversed", bg: isDark ? "rgba(185, 28, 28, 0.2)" : "#fee2e2", color: isDark ? "#f87171" : "#b91c1c", aria: "Status: Reversed" }
    : { label: "Pending", bg: isDark ? "rgba(180, 83, 9, 0.2)" : "#fef3c7", color: isDark ? "#fbbf24" : "#b45309", aria: "Status: Pending" }

  // Payslip button tooltip & label
  const buttonTooltip = isCredited
    ? "Download Payslip PDF"
    : isReversed
    ? "Reversed — no payslip"
    : "Available once credited"

  const grossAmt = formatCurrency(transaction.gross_amount)
  const pfAmt = formatCurrency(transaction.pf_deduction)
  const esiAmt = formatCurrency(transaction.esi_deduction)
  const netAmt = formatCurrency(transaction.net_credit_amount)

  return (
    <div
      data-testid={`payout-card-${transaction.id}`}
      style={{
        background: isDark ? "#111827" : "#ffffff",
        border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`,
        borderRadius: 16,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.3)" : "0 2px 10px rgba(0,0,0,0.02)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease"
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: isDark ? "#f9fafb" : "#0f172a" }}>
            Service Payout • <span style={{ color: "#4f46e5" }}>{transaction.booking_reference || `#${transaction.id}`}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#6b7280" : "#94a3b8", marginTop: 2 }}>
            {dateDisplay}
          </div>
        </div>

        {/* Status badge with accessible text */}
        <span
          role="status"
          aria-label={statusMeta.aria}
          style={{
            padding: "3px 9px",
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: statusMeta.bg,
            color: statusMeta.color
          }}
        >
          {statusMeta.label}
        </span>
      </div>

      {/* Financial Breakdown & Net Credit Row */}
      <div
        style={{
          display: "flex",
          justify: "space-between",
          alignItems: "center",
          background: isDark ? "#1f2937" : "#f8fafc",
          padding: "8px 12px",
          borderRadius: 10
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#9ca3af" : "#64748b" }}>
          Gross {grossAmt} → PF {pfAmt} → ESI {esiAmt}
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: isCredited ? "#059669" : isDark ? "#9ca3af" : "#64748b" }}>
          {netAmt}
        </div>
      </div>

      {/* Full-width Payslip PDF button */}
      <button
        type="button"
        data-testid={`payslip-btn-${transaction.id}`}
        disabled={!isCredited || downloading}
        title={buttonTooltip}
        onClick={() => isCredited && onDownloadPayslip(transaction)}
        style={{
          width: "100%",
          padding: "9px 14px",
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 800,
          border: "none",
          cursor: isCredited && !downloading ? "pointer" : "not-allowed",
          background: isCredited ? "#4f46e5" : isDark ? "#1f2937" : "#e2e8f0",
          color: isCredited ? "#ffffff" : isDark ? "#6b7280" : "#94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.15s ease"
        }}
      >
        {downloading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileText size={14} />
        )}
        <span>
          {isCredited
            ? "Payslip PDF"
            : isReversed
            ? "Reversed — no payslip"
            : "Available once credited"}
        </span>
      </button>
    </div>
  )
}
