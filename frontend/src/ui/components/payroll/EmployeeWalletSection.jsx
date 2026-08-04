import React, { useState, useEffect, useCallback } from "react"
import { AlertCircle, User, X, ShieldCheck, ShieldAlert, FileDown } from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"
import { WalletBalanceHero } from "./WalletBalanceHero.jsx"
import { PeriodFilter } from "./PeriodFilter.jsx"
import { EarningsStatsGrid } from "./EarningsStatsGrid.jsx"
import { PayoutCard } from "./PayoutCard.jsx"

// Simple pulsing gray loading skeleton
function WalletSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <div className="animate-pulse" style={{ height: 200, borderRadius: 20, background: "rgba(156, 163, 175, 0.2)" }} />
      <div className="animate-pulse" style={{ height: 40, borderRadius: 14, background: "rgba(156, 163, 175, 0.2)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse" style={{ height: 80, borderRadius: 16, background: "rgba(156, 163, 175, 0.2)" }} />
        ))}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="animate-pulse" style={{ height: 120, borderRadius: 16, background: "rgba(156, 163, 175, 0.2)" }} />
      ))}
    </div>
  )
}

// Payout eligibility banner
function EligibilityBanner({ eligibility, isDark }) {
  if (!eligibility) return null
  const { eligible, blockers = [] } = eligibility

  if (eligible) {
    return (
      <div
        style={{
          background: isDark ? "rgba(16, 185, 129, 0.1)" : "#ecfdf5",
          border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "#6ee7b7"}`,
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
      >
        <ShieldCheck size={16} color="#059669" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
          Payout eligible — bank account & KYC verified ✓
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: isDark ? "rgba(245, 158, 11, 0.1)" : "#fffbeb",
        border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.3)" : "#fcd34d"}`,
        borderRadius: 12,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldAlert size={16} color="#d97706" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#d97706" }}>
          Payout not yet enabled
        </span>
      </div>
      <ul style={{ margin: 0, padding: "0 0 0 24px", display: "flex", flexDirection: "column", gap: 2 }}>
        {blockers.map((b, i) => (
          <li key={i} style={{ fontSize: 11, color: isDark ? "#fbbf24" : "#92400e", fontWeight: 600 }}>
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EmployeeWalletSection({ isDark = false }) {
  const { user } = useAuth()
  const [period, setPeriod] = useState("month")
  const [loading, setLoading] = useState(true)
  const [walletData, setWalletData] = useState(null)
  const [error, setError] = useState(null)
  const [toastError, setToastError] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [downloadingStatement, setDownloadingStatement] = useState(false)

  const employeeName =
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.username ||
    "Partner Employee"

  const fetchWallet = useCallback(async (p) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest(`/payroll/my-wallet/?period=${p}`)
      if (res?.success && res?.data) {
        setWalletData(res.data)
      } else {
        setError(res?.error || "Failed to load wallet data.")
      }
    } catch (err) {
      setError(err?.message || "Error connecting to server.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWallet(period)
  }, [period, fetchWallet])

  // Single transaction payslip download
  const handleDownloadPayslip = async (tx) => {
    if (!tx || tx.status !== "CREDITED") return
    setDownloadingId(tx.id)
    setToastError(null)
    try {
      const token = localStorage.getItem("qt_access") || ""
      const resp = await fetch(`/api/payroll/download-payslip/${tx.id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!resp.ok) throw new Error("Payslip download failed. Please try again.")
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Payslip-TXN-${tx.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setToastError(e?.message || "Failed to download payslip PDF.")
    } finally {
      setDownloadingId(null)
    }
  }

  // Wallet statement download (CSV or PDF)
  const handleDownloadStatement = async (fmt = "csv") => {
    setDownloadingStatement(true)
    setToastError(null)
    try {
      const token = localStorage.getItem("qt_access") || ""
      const resp = await fetch(`/api/payroll/statement/?period=${period}&format=${fmt}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!resp.ok) throw new Error("Statement download failed. Please try again.")
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `wallet-statement-${period}.${fmt}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setToastError(e?.message || "Failed to download statement.")
    } finally {
      setDownloadingStatement(false)
    }
  }

  const transactions = walletData?.transactions || []
  const latestCreditedTx = transactions.find((tx) => tx.status === "CREDITED")

  const totalBalance = walletData?.total_balance || "0.00"
  const availableBalance = walletData?.available_balance ?? null
  const pendingBalance = walletData?.pending_balance ?? null
  const nextSettlementDate = walletData?.next_settlement_date ?? null
  const payoutEligibility = walletData?.payout_eligibility ?? null

  const summary = walletData?.period_summary || {}

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        margin: "0 auto",
        padding: "16px 20px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 18
      }}
    >
      {/* Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: isDark ? "#818cf8" : "#4f46e5"
            }}
          >
            My earnings
          </span>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: isDark ? "#f9fafb" : "#0f172a",
              margin: "2px 0 0 0"
            }}
          >
            {employeeName}
          </h1>
        </div>

        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: isDark ? "#1f2937" : "#e0e7ff",
            color: isDark ? "#818cf8" : "#4f46e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 14,
            border: `2px solid ${isDark ? "#374151" : "#c7d2fe"}`
          }}
        >
          <User size={20} />
        </div>
      </div>

      {/* Toast Notification */}
      {toastError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            padding: "10px 14px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} />
            <span>{toastError}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hero Balance Card */}
      <WalletBalanceHero
        balance={totalBalance}
        availableBalance={availableBalance}
        pendingBalance={pendingBalance}
        nextSettlementDate={nextSettlementDate}
        onDownload={() => handleDownloadPayslip(latestCreditedTx)}
        onHistory={() => handleDownloadStatement("csv")}
        downloading={downloadingId === latestCreditedTx?.id}
        hasCreditedTx={!!latestCreditedTx}
        isDark={isDark}
      />

      {/* Payout Eligibility Banner */}
      <EligibilityBanner eligibility={payoutEligibility} isDark={isDark} />

      {/* Time Filter Pill Buttons */}
      <PeriodFilter value={period} onChange={setPeriod} isDark={isDark} />

      {/* Main Content */}
      {loading ? (
        <WalletSkeleton />
      ) : error ? (
        <div
          style={{
            background: isDark ? "rgba(220, 38, 38, 0.1)" : "#fef2f2",
            border: `1px solid ${isDark ? "rgba(220, 38, 38, 0.2)" : "#fecaca"}`,
            borderRadius: 16,
            padding: 20,
            textAlign: "center",
            color: "#dc2626",
            fontSize: 13,
            fontWeight: 700
          }}
        >
          {error}
        </div>
      ) : (
        <>
          {/* Earnings Stats Grid */}
          <EarningsStatsGrid summary={summary} isDark={isDark} />

          {/* Job Payouts List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: isDark ? "#f9fafb" : "#0f172a",
                  margin: 0
                }}
              >
                Job Payouts
              </h3>

              {/* Download statement button */}
              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleDownloadStatement("csv")}
                  disabled={downloadingStatement}
                  title="Download wallet statement as CSV"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: `1px solid ${isDark ? "#374151" : "#e2e8f0"}`,
                    background: isDark ? "#1f2937" : "#f8fafc",
                    color: isDark ? "#818cf8" : "#4f46e5",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: downloadingStatement ? "not-allowed" : "pointer"
                  }}
                >
                  <FileDown size={12} />
                  {downloadingStatement ? "Downloading…" : "Export CSV"}
                </button>
              )}
            </div>

            {transactions.length === 0 ? (
              <div
                style={{
                  background: isDark ? "#111827" : "#ffffff",
                  border: `1.5px dashed ${isDark ? "#374151" : "#cbd5e1"}`,
                  borderRadius: 16,
                  padding: "32px 20px",
                  textAlign: "center",
                  color: isDark ? "#9ca3af" : "#64748b",
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                No payouts yet for this period.
              </div>
            ) : (
              transactions.map((tx) => (
                <PayoutCard
                  key={tx.id}
                  transaction={tx}
                  onDownloadPayslip={handleDownloadPayslip}
                  downloading={downloadingId === tx.id}
                  isDark={isDark}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
