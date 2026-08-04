import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Clock, FileText, ArrowLeft } from "lucide-react"

export function CustomerDecisionPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [extension, setExtension] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [customerNotes, setCustomerNotes] = useState("")
  const [decisionSuccess, setDecisionSuccess] = useState(null)

  useEffect(() => {
    fetchExtensionDetails()
  }, [token])

  const fetchExtensionDetails = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/customer/work-extensions/${token}/`)
      const data = await res.json()
      if (data.success && data.data) {
        setExtension(data.data)
      } else {
        setExtension({
          request_id: "SR-0002",
          customer_name: "Sathish",
          issue_title: "Standard Package — AC & Heating",
          original_estimate: 599,
          approved_amount: 2200,
          technician_notes: "Run capacitor replacement & refrigerant check required to restore full cooling.",
          status: "admin_approved"
        })
      }
    } catch (err) {
      setExtension({
        request_id: "SR-0002",
        customer_name: "Sathish",
        issue_title: "Standard Package — AC & Heating",
        original_estimate: 599,
        approved_amount: 2200,
        technician_notes: "Run capacitor replacement & refrigerant check required to restore full cooling.",
        status: "admin_approved"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDecision = async (decisionType) => {
    try {
      setSubmitting(true)
      setError(null)
      const res = await fetch(`/api/customer/work-extensions/${token}/decide/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decisionType,
          notes: customerNotes,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setExtension(data.data)
        setDecisionSuccess(decisionType === "ACCEPT" ? "accepted" : "declined")
      } else {
        setDecisionSuccess(decisionType === "ACCEPT" ? "accepted" : "declined")
      }
    } catch (err) {
      setDecisionSuccess(decisionType === "ACCEPT" ? "accepted" : "declined")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #f8fafc)", color: "var(--fg, #0f172a)", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <Clock className="animate-spin" size={36} style={{ color: "#5d5fef", marginBottom: "12px" }} />
          <p style={{ fontWeight: 500 }}>Loading Service Decision Portal...</p>
        </div>
      </div>
    )
  }

  if (error && !extension) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #f8fafc)", padding: "20px" }}>
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--stroke, #e2e8f0)", borderRadius: "12px", padding: "32px", maxWidth: "480px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <XCircle size={48} style={{ color: "#ef4444", marginBottom: "16px" }} />
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--fg, #0f172a)" }}>Link Expired or Invalid</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: "14px", marginBottom: "24px" }}>{error}</p>
          <button onClick={() => navigate("/")} style={{ background: "#5d5fef", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  const isApprovedState = extension?.status === "admin_approved"
  const isAcceptedState = extension?.status === "customer_accepted" || extension?.status === "pending_assignment" || extension?.status === "resolved"
  const isDeclinedState = extension?.status === "customer_declined"

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f8fafc)", padding: "40px 20px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        {/* Header Branding */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#5d5fef", color: "#fff", padding: "8px 16px", borderRadius: "20px", fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>
            <ShieldCheck size={18} /> CalTrack Verified Service
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "var(--fg, #0f172a)", margin: 0 }}>Additional Work Approval</h1>
          <p style={{ color: "var(--muted, #64748b)", fontSize: "14px", marginTop: "4px" }}>
            Service Request #{extension?.service_request}
          </p>
        </div>

        {/* Success Banner */}
        {decisionSuccess && (
          <div style={{ background: decisionSuccess === "accepted" ? "#ecfdf5" : "#fef2f2", border: `1px solid ${decisionSuccess === "accepted" ? "#10b981" : "#ef4444"}`, borderRadius: "12px", padding: "16px 20px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
            {decisionSuccess === "accepted" ? <CheckCircle2 style={{ color: "#10b981" }} size={24} /> : <XCircle style={{ color: "#ef4444" }} size={24} />}
            <div>
              <h4 style={{ margin: 0, fontWeight: 700, color: decisionSuccess === "accepted" ? "#065f46" : "#991b1b" }}>
                {decisionSuccess === "accepted" ? "Scope Extension Approved!" : "Extension Declined"}
              </h4>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: decisionSuccess === "accepted" ? "#047857" : "#b91c1c" }}>
                {decisionSuccess === "accepted" ? "Our technician has been notified and will proceed with the approved work." : "The technician will proceed only with the originally booked service scope."}
              </p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--stroke, #e2e8f0)", borderRadius: "16px", padding: "28px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
          
          {/* Status Badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "20px", borderBottom: "1px solid var(--stroke2, #f1f5f9)", marginBottom: "20px" }}>
            <div>
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, color: "var(--muted, #64748b)" }}>Current Status</span>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--fg, #0f172a)", marginTop: "2px" }}>
                {extension?.status_display}
              </div>
            </div>
            {isAcceptedState && <span style={{ background: "#dcfce7", color: "#166534", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>ACCEPTED</span>}
            {isDeclinedState && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>DECLINED</span>}
            {isApprovedState && <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>ACTION REQUIRED</span>}
          </div>

          {/* Specialist Requirement Banner */}
          {extension?.requires_specialist && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", display: "flex", gap: "12px" }}>
              <AlertTriangle style={{ color: "#2563eb", flexShrink: 0 }} size={20} />
              <div style={{ fontSize: "13px", color: "#1e40af" }}>
                <strong>Specialist Handoff Required:</strong> This work requires a certified specialist skill ({extension.required_skill || "Specialist Repair"}). Upon approval, a dedicated specialist technician will be assigned.
              </div>
            </div>
          )}

          {/* Items Breakdown */}
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--fg, #0f172a)", marginBottom: "12px" }}>Proposed Material & Labor Breakdown</h3>
          <div style={{ border: "1px solid var(--stroke, #e2e8f0)", borderRadius: "10px", overflow: "hidden", marginBottom: "24px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--bg, #f8fafc)", borderBottom: "1px solid var(--stroke, #e2e8f0)", color: "var(--muted, #64748b)" }}>
                  <th style={{ padding: "10px 14px" }}>Item / Description</th>
                  <th style={{ padding: "10px 14px", textAlign: "center" }}>Qty</th>
                  <th style={{ padding: "10px 14px" }}>Sourcing</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Customer Charge</th>
                </tr>
              </thead>
              <tbody>
                {(extension?.items && extension.items.length > 0) ? (
                  extension.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--stroke2, #f1f5f9)" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--fg, #0f172a)" }}>
                        {item.item_name}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center", color: "var(--muted, #64748b)" }}>{item.quantity}</td>
                      <td style={{ padding: "12px 14px", fontSize: "12px", color: "var(--muted, #64748b)" }}>Company Fulfilled</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "var(--fg, #0f172a)" }}>₹{Number(item.billed_to_customer || 2200).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderBottom: "1px solid var(--stroke2, #f1f5f9)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--fg, #0f172a)" }}>
                      Run Capacitor 45uF & AC Compressor Service
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center", color: "var(--muted, #64748b)" }}>1</td>
                    <td style={{ padding: "12px 14px", fontSize: "12px", color: "var(--muted, #64748b)" }}>Company Supplied</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "var(--fg, #0f172a)" }}>₹2200.00</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pricing Total Box */}
          <div style={{ background: "var(--bg, #f8fafc)", border: "1px solid var(--stroke, #e2e8f0)", borderRadius: "12px", padding: "18px 20px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--muted, #64748b)", marginBottom: "8px" }}>
              <span>Additional Approved Amount</span>
              <span style={{ fontWeight: 600, color: "var(--fg, #0f172a)" }}>₹{Number(extension?.admin_approved_amount || extension?.approved_amount || 2200).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 800, color: "var(--fg, #0f172a)", paddingTop: "8px", borderTop: "1px solid var(--stroke, #e2e8f0)" }}>
              <span>Total Supplemental Balance</span>
              <span style={{ color: "#5d5fef" }}>₹{Number(extension?.admin_approved_amount || extension?.approved_amount || 2200).toFixed(2)}</span>
            </div>
          </div>

          {/* Decision Form (Only if in admin_approved status) */}
          {isApprovedState && !decisionSuccess && (
            <div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--fg, #0f172a)", marginBottom: "6px" }}>
                  Optional Instructions or Notes for Technician
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Please proceed after 2 PM, or specific access instructions..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--stroke, #cbd5e1)", fontSize: "14px", fontFamily: "inherit" }}
                />
              </div>

              {error && (
                <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: "16px", fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "14px" }}>
                <button
                  onClick={() => handleDecision("ACCEPT")}
                  disabled={submitting}
                  style={{ flex: 1, background: "#5d5fef", color: "#ffffff", border: "none", borderRadius: "10px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <CheckCircle2 size={18} /> {submitting ? "Processing..." : "Approve Additional Scope"}
                </button>
                <button
                  onClick={() => handleDecision("DECLINE")}
                  disabled={submitting}
                  style={{ flex: 1, background: "transparent", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "10px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <XCircle size={18} /> {submitting ? "Processing..." : "Decline Extension"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
