import React from "react"
import { Clock, FileText, CheckCircle2, AlertCircle, XCircle, ArrowUp, Coffee } from "lucide-react"
import { formatDateTime } from "../components/kit.jsx"
import { API_BASE_URL } from "../../api/client.js"

function StatusBadge({ status, isActive }) {
  if (isActive) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 20,
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "white", fontSize: 10, fontWeight: 900,
        letterSpacing: "0.06em", textTransform: "uppercase",
        boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.8)", animation: "alPulse 1.5s infinite" }} />
        LIVE SESSION
      </span>
    )
  }
  const configs = {
    approved: { bg: "var(--al-approved-bg)", border: "var(--al-approved-border)", text: "var(--al-approved-text)", icon: <CheckCircle2 size={11} />, label: "Approved" },
    rejected: { bg: "var(--al-rejected-bg)", border: "var(--al-rejected-border)", text: "var(--al-rejected-text)", icon: <XCircle size={11} />, label: "Rejected" },
    submitted: { bg: "var(--al-review-bg)", border: "var(--al-review-border)", text: "var(--al-review-text)", icon: <AlertCircle size={11} />, label: "In Review" },
    draft: { bg: "var(--al-draft-bg)", border: "var(--al-draft-border)", text: "var(--al-draft-text)", icon: null, label: "Draft" },
  }
  const cfg = configs[status] || configs.draft
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      background: cfg.bg, border: `1.5px solid ${cfg.border}`,
      color: cfg.text, fontSize: 10, fontWeight: 900,
      letterSpacing: "0.05em", textTransform: "uppercase",
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 20, padding: 20,
      border: "1px solid var(--stroke)", marginBottom: 12,
      animation: "alShimmer 1.5s infinite",
    }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ width: 4, height: 64, borderRadius: 4, background: "var(--stroke)" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ width: "30%", height: 14, borderRadius: 8, background: "var(--stroke)" }} />
          <div style={{ width: "60%", height: 10, borderRadius: 8, background: "var(--al-shimmer-light)" }} />
          <div style={{ width: "40%", height: 10, borderRadius: 8, background: "var(--al-shimmer-light)" }} />
        </div>
        <div style={{ width: 80, height: 32, borderRadius: 12, background: "var(--stroke)" }} />
      </div>
    </div>
  )
}

function TimelineNode({ label, time, active }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: active
          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
          : "var(--al-node-bg)",
        border: active ? "none" : "2px solid var(--al-node-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: active ? "0 4px 12px rgba(99,102,241,0.3)" : "none",
      }}>
        <Clock size={13} style={{ color: active ? "white" : "var(--muted)" }} />
      </div>
      <div style={{ fontSize: 9, fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: active ? "#6366f1" : "var(--fg)" }}>{time || "—"}</div>
    </div>
  )
}

export default function AuditLedger({ logs, loading, elapsed, downloadLogPdf, submitLog, formatDuration, canModify = true }) {
  const host = API_BASE_URL.replace('/api', '')
  const getUrl = (p) => (p && p.startsWith('/') ? `${host}${p}` : p)

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px 40px", gap: 20,
        background: "var(--al-empty-bg)",
        borderRadius: 24, border: "2px dashed var(--al-empty-border)",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "var(--al-empty-icon-bg)",
          border: "2px solid var(--al-empty-icon-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Clock size={36} style={{ color: "#a5b4fc" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--fg)", marginBottom: 4 }}>No Records Found</div>
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Your attendance records will appear here after your first clock-in.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {logs.map(l => {
        const isActive = !l.clock_out
        const dur = isActive ? elapsed : l.worked_seconds
        const isOvertime = dur > 8 * 3600
        const clockInTime = l.clock_in ? formatDateTime(l.clock_in).split(",")[1]?.trim() : null
        const clockOutTime = l.clock_out ? formatDateTime(l.clock_out).split(",")[1]?.trim() : null
        const hasBreaks = l.breaks && l.breaks.length > 0
        const totalBreakMins = hasBreaks ? l.breaks.reduce((s, b) => s + (b.duration_minutes || 0), 0) : 0

        const accentColor = isActive
          ? "#6366f1"
          : l.status === "approved" ? "#10b981"
          : l.status === "rejected" ? "#ef4444"
          : l.status === "submitted" ? "#f59e0b"
          : "var(--stroke2)"

        return (
          <div
            key={l.id}
            style={{
              background: isActive ? "var(--al-active-card-bg)" : "var(--surface)",
              borderRadius: 20,
              border: `1px solid ${isActive ? "var(--al-active-card-border)" : "var(--stroke)"}`,
              overflow: "hidden",
              transition: "box-shadow 0.2s, transform 0.2s",
              boxShadow: isActive
                ? "0 4px 24px rgba(99,102,241,0.12)"
                : "0 1px 4px rgba(0,0,0,0.04)",
              position: "relative",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)" }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = isActive ? "0 4px 24px rgba(99,102,241,0.12)" : "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)" }}
          >
            {/* Left accent bar */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
              background: isActive
                ? "linear-gradient(to bottom, #6366f1, #8b5cf6)"
                : accentColor,
              borderRadius: "20px 0 0 20px",
            }} />

            <div style={{ padding: "18px 20px 18px 24px" }}>
              {/* Top row: date + status + duration */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "var(--fg)", letterSpacing: "-0.01em" }}>
                    {l.work_date}
                  </div>
                  {l.task && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
                      {l.task.title}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <div style={{
                    fontSize: 22, fontWeight: 900,
                    color: isActive ? "#6366f1" : isOvertime ? "#ef4444" : "var(--fg)",
                    letterSpacing: "-0.02em", lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {formatDuration(dur)}
                  </div>
                  {isOvertime && (
                    <div style={{
                      fontSize: 9, fontWeight: 900, color: "#ef4444",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                      <ArrowUp size={9} />
                      OT +{formatDuration(dur - 8 * 3600)}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <TimelineNode label="Clock In" time={clockInTime} active={true} />

                <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                  <div style={{
                    height: 3, width: "100%", borderRadius: 4,
                    background: isActive
                      ? "linear-gradient(90deg, #6366f1, #a5b4fc)"
                      : "var(--al-connector-bg)",
                    position: "relative",
                  }}>
                    {hasBreaks && (
                      <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        background: "var(--al-break-bg)", border: "1.5px solid var(--al-break-border)",
                        borderRadius: 10, padding: "1px 6px",
                        fontSize: 8, fontWeight: 900, color: "var(--al-break-text)",
                        whiteSpace: "nowrap",
                      }}>
                        ☕ {totalBreakMins}m break
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <div style={{
                      position: "absolute", right: -4,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#6366f1",
                      boxShadow: "0 0 0 3px rgba(99,102,241,0.25)",
                      animation: "alPulse 1.5s infinite",
                    }} />
                  )}
                </div>

                <TimelineNode label="Clock Out" time={clockOutTime} active={false} />
              </div>

              {/* Bottom row: breaks, verification photos, actions */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                  {hasBreaks && l.breaks.map((b, idx) => (
                    <span key={idx} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 12,
                      background: "var(--al-break-tag-bg)", border: "1px solid var(--al-break-tag-border)",
                      fontSize: 9, fontWeight: 900, color: "var(--al-break-tag-text)",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {b.break_type === "tea" ? "☕" : b.break_type === "lunch" ? "🍱" : "💤"}
                      {b.break_type}: {b.duration_minutes ? `${b.duration_minutes}m` : "active"}
                    </span>
                  ))}

                  {(l.clock_in_photo || l.clock_out_photo) && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {l.clock_in_photo && (
                        <a
                          href={getUrl(l.clock_in_photo)} target="_blank" rel="noreferrer"
                          title="Clock-in photo"
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            overflow: "hidden", border: "2px solid #e0e7ff",
                            display: "block", flexShrink: 0,
                            transition: "transform 0.2s, border-color 0.2s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15)"; e.currentTarget.style.borderColor = "#6366f1" }}
                          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "#e0e7ff" }}
                        >
                          <img src={getUrl(l.clock_in_photo)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Clock-in" />
                        </a>
                      )}
                      {l.clock_out_photo && (
                        <a
                          href={getUrl(l.clock_out_photo)} target="_blank" rel="noreferrer"
                          title="Clock-out photo"
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            overflow: "hidden", border: "2px solid #fde68a",
                            display: "block", flexShrink: 0,
                            transition: "transform 0.2s, border-color 0.2s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15)"; e.currentTarget.style.borderColor = "#f59e0b" }}
                          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "#fde68a" }}
                        >
                          <img src={getUrl(l.clock_out_photo)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Clock-out" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side: status + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <StatusBadge status={l.status} isActive={isActive} />
                    {l.face_match_status && l.face_match_status !== 'skipped' && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 3,
                        fontSize: 9, fontWeight: 900, textTransform: "uppercase",
                        color: l.face_match_status === 'matched' ? "var(--al-approved-text)" : "var(--al-rejected-text)"
                      }}>
                        {l.face_match_status === 'matched' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                        {l.face_match_status === 'matched' ? 'Verified' : 'Mismatch'}
                      </div>
                    )}
                    {l.status === 'rejected' && l.admin_notes && (
                      <div style={{
                        display: "flex", alignItems: "flex-start", gap: 3,
                        fontSize: 9, fontWeight: 900,
                        color: "var(--al-rejected-text)",
                        marginTop: 2,
                        maxWidth: 150,
                        textAlign: "right",
                        lineHeight: 1.2
                      }}>
                        <AlertCircle size={10} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{l.admin_notes}</span>
                      </div>
                    )}
                  </div>

                  {l.status === "draft" && l.clock_out && canModify && (
                    <button
                      onClick={() => submitLog(l.id)}
                      style={{
                        padding: "5px 12px", borderRadius: 10,
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        color: "white", border: "none",
                        fontSize: 9, fontWeight: 900, cursor: "pointer",
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                        transition: "opacity 0.2s, transform 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "scale(1.05)" }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)" }}
                    >
                      Submit
                    </button>
                  )}

                  {l.clock_out && (
                    <button
                      onClick={() => downloadLogPdf(l.id)}
                      title="Download PDF"
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: "var(--al-pdf-btn-bg)", border: "1px solid var(--al-pdf-btn-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", color: "#6366f1",
                        transition: "background 0.2s, border-color 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--al-pdf-btn-hover-bg)"; e.currentTarget.style.borderColor = "#6366f1" }}
                      onMouseLeave={e => { e.currentTarget.style.background = "var(--al-pdf-btn-bg)"; e.currentTarget.style.borderColor = "var(--al-pdf-btn-border)" }}
                    >
                      <FileText size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Rejection note */}
              {l.status === "rejected" && l.admin_notes && (
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: 10,
                  background: "var(--al-rejected-bg)", border: "1px solid var(--al-rejected-border)",
                  fontSize: 11, color: "var(--al-rejected-text)", fontWeight: 600,
                }}>
                  ⚠️ {l.admin_notes}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <style>{`
        /* ── AuditLedger light tokens ── */
        :root {
          --al-active-card-bg: linear-gradient(135deg, #fafaff, #f5f3ff);
          --al-active-card-border: #e0e7ff;
          --al-node-bg: linear-gradient(135deg, #f8fafc, #f1f5f9);
          --al-node-border: #e2e8f0;
          --al-connector-bg: linear-gradient(90deg, #e2e8f0, #f1f5f9);
          --al-break-bg: #fef3c7;
          --al-break-border: #fcd34d;
          --al-break-text: #92400e;
          --al-break-tag-bg: #fff7ed;
          --al-break-tag-border: #fed7aa;
          --al-break-tag-text: #9a3412;
          --al-approved-bg: linear-gradient(135deg, #ecfdf5, #d1fae5);
          --al-approved-border: #a7f3d0;
          --al-approved-text: #065f46;
          --al-rejected-bg: linear-gradient(135deg, #fef2f2, #fee2e2);
          --al-rejected-border: #fca5a5;
          --al-rejected-text: #991b1b;
          --al-review-bg: linear-gradient(135deg, #fffbeb, #fef3c7);
          --al-review-border: #fcd34d;
          --al-review-text: #92400e;
          --al-draft-bg: linear-gradient(135deg, #f8fafc, #f1f5f9);
          --al-draft-border: #cbd5e1;
          --al-draft-text: #475569;
          --al-empty-bg: linear-gradient(135deg, #fafafa, #f8fafc);
          --al-empty-border: #e2e8f0;
          --al-empty-icon-bg: linear-gradient(135deg, #eff6ff, #f5f3ff);
          --al-empty-icon-border: #e0e7ff;
          --al-pdf-btn-bg: #f8fafc;
          --al-pdf-btn-border: #e2e8f0;
          --al-pdf-btn-hover-bg: #eff6ff;
          --al-shimmer-light: #f8fafc;
        }

        /* ── AuditLedger dark tokens ── */
        :root[data-theme='dark'] {
          --al-active-card-bg: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06));
          --al-active-card-border: rgba(99,102,241,0.25);
          --al-node-bg: linear-gradient(135deg, #1e293b, #0f172a);
          --al-node-border: rgba(255,255,255,0.1);
          --al-connector-bg: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          --al-break-bg: rgba(251,191,36,0.15);
          --al-break-border: rgba(251,191,36,0.3);
          --al-break-text: #fbbf24;
          --al-break-tag-bg: rgba(251,191,36,0.1);
          --al-break-tag-border: rgba(251,191,36,0.25);
          --al-break-tag-text: #fbbf24;
          --al-approved-bg: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08));
          --al-approved-border: rgba(16,185,129,0.3);
          --al-approved-text: #34d399;
          --al-rejected-bg: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.08));
          --al-rejected-border: rgba(239,68,68,0.3);
          --al-rejected-text: #f87171;
          --al-review-bg: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.08));
          --al-review-border: rgba(245,158,11,0.3);
          --al-review-text: #fbbf24;
          --al-draft-bg: linear-gradient(135deg, rgba(100,116,139,0.12), rgba(71,85,105,0.08));
          --al-draft-border: rgba(100,116,139,0.25);
          --al-draft-text: #94a3b8;
          --al-empty-bg: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
          --al-empty-border: rgba(255,255,255,0.08);
          --al-empty-icon-bg: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
          --al-empty-icon-border: rgba(99,102,241,0.25);
          --al-pdf-btn-bg: rgba(255,255,255,0.05);
          --al-pdf-btn-border: rgba(255,255,255,0.1);
          --al-pdf-btn-hover-bg: rgba(99,102,241,0.15);
          --al-shimmer-light: rgba(255,255,255,0.03);
        }

        @keyframes alShimmer {
          0% { opacity: 1 }
          50% { opacity: 0.5 }
          100% { opacity: 1 }
        }
        @keyframes alPulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.4 }
        }
      `}</style>
    </div>
  )
}
