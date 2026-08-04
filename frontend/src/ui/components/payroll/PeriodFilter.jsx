import React from "react"

const PERIOD_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" }
]

export function PeriodFilter({ value = "month", onChange = () => {}, isDark = false }) {
  return (
    <div
      aria-label="Filter payouts by period"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
        background: isDark ? "#1e2937" : "#f1f5f9",
        padding: 4,
        borderRadius: 14
      }}
    >
      {PERIOD_OPTIONS.map((opt) => {
        const isActive = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            data-testid={`period-filter-${opt.id}`}
            aria-pressed={isActive}
            onClick={() => onChange(opt.id)}
            style={{
              padding: "8px 4px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 800,
              border: isActive ? "none" : `1px solid ${isDark ? "#374151" : "#cbd5e1"}`,
              background: isActive
                ? isDark
                  ? "#374151"
                  : "#ffffff"
                : "transparent",
              color: isActive
                ? isDark
                  ? "#f9fafb"
                  : "#0f172a"
                : isDark
                ? "#9ca3af"
                : "#64748b",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              whiteSpace: "nowrap",
              textAlign: "center"
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
