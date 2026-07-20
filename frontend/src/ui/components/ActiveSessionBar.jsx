import React from "react";
import { Coffee, Camera, Square, Play } from "lucide-react";
import { formatDuration } from "../../hooks/useTimeTracking";

export default function ActiveSessionBar({
  openLog,
  openBreak,
  elapsed,
  breakElapsed,
  busy,
  canModify,
  breakType,
  setBreakType,
  onStartBreak,
  onEndBreak,
  onClockOut,
  onJobPhoto,
  onSOS,
  sosSending,
  sosConfirmed,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: 100,
        padding: "8px 10px 8px 24px",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            lineHeight: 1,
          }}
        >
          {openBreak
            ? `On Break (${openBreak.break_type?.toUpperCase()})`
            : openLog?.task
            ? "Working Time"
            : "Active Session"}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
            marginTop: 2,
            textShadow: "0 2px 10px rgba(255,255,255,0.2)",
          }}
        >
          {openBreak ? formatDuration(breakElapsed) : formatDuration(elapsed)}
        </div>
      </div>
      <div
        style={{
          width: 1,
          height: 32,
          background: "rgba(255,255,255,0.1)",
        }}
      ></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!openBreak ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(245, 158, 11, 0.1)",
                borderRadius: 100,
                padding: "4px 12px 4px 6px",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              <button
                onClick={onStartBreak}
                disabled={busy || !canModify}
                title="Start Break"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: "none",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: busy || !canModify ? "not-allowed" : "pointer",
                  opacity: busy || !canModify ? 0.5 : 1,
                  boxShadow: "0 2px 10px rgba(245, 158, 11, 0.4)",
                  transition: "transform 0.2s",
                }}
              >
                <Coffee size={14} />
              </button>
              <select
                value={breakType}
                onChange={(e) => setBreakType(e.target.value)}
                disabled={busy || !canModify}
                style={{
                  background: "transparent",
                  color: "#fcd34d",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "none",
                  outline: "none",
                  cursor: busy || !canModify ? "not-allowed" : "pointer",
                  appearance: "none",
                  paddingRight: 4,
                }}
              >
                <option value="tea" style={{ background: "#1e293b", color: "white" }}>
                  ☕ Tea
                </option>
                <option value="lunch" style={{ background: "#1e293b", color: "white" }}>
                  🍱 Lunch
                </option>
                <option value="other" style={{ background: "#1e293b", color: "white" }}>
                  💤 Other
                </option>
              </select>
            </div>
            {onJobPhoto && (
              <button
                onClick={onJobPhoto}
                title="Job Photo"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
                }
              >
                <Camera size={16} />
              </button>
            )}
            <button
              onClick={onClockOut}
              disabled={busy || !canModify}
              title="Clock Out"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: busy || !canModify ? "not-allowed" : "pointer",
                opacity: busy || !canModify ? 0.5 : 1,
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                if (!busy && canModify) {
                  e.currentTarget.style.background = "#ef4444";
                  e.currentTarget.style.color = "white";
                }
              }}
              onMouseOut={(e) => {
                if (!busy && canModify) {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                  e.currentTarget.style.color = "#fca5a5";
                }
              }}
            >
              <Square size={14} fill="currentColor" />
            </button>
            <button
              onClick={onSOS}
              disabled={sosSending || !canModify}
              title="SOS"
              style={{
                padding: "0 16px",
                height: 40,
                borderRadius: 100,
                background: sosConfirmed
                  ? "#059669"
                  : "linear-gradient(135deg, #ef4444, #be123c)",
                color: "white",
                border: "none",
                fontWeight: 900,
                fontSize: 11,
                cursor: sosSending || !canModify ? "not-allowed" : "pointer",
                letterSpacing: "0.08em",
                opacity: sosSending || !canModify ? 0.5 : 1,
                boxShadow: sosConfirmed
                  ? "none"
                  : "0 4px 15px rgba(225, 29, 72, 0.4)",
                animation:
                  !sosConfirmed && !sosSending && canModify
                    ? "sosPulse 2s infinite"
                    : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sosConfirmed ? "✓ SENT" : sosSending ? "…" : "SOS"}
            </button>
          </>
        ) : (
          <button
            onClick={onEndBreak}
            disabled={busy || !canModify}
            style={{
              padding: "0 24px",
              height: 40,
              borderRadius: 100,
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "white",
              border: "none",
              fontSize: 12,
              fontWeight: 900,
              cursor: busy || !canModify ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 15px rgba(16,185,129,0.4)",
              opacity: busy || !canModify ? 0.5 : 1,
            }}
          >
            <Play size={14} fill="currentColor" /> RESUME WORK
          </button>
        )}
      </div>
    </div>
  );
}
