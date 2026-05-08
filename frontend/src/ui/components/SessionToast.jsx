/**
 * SessionToast.jsx
 * Lightweight toast that appears when the JWT session expires.
 * Automatically dismisses after 5 seconds.
 * Does NOT change any existing UI — it floats over everything.
 */
import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"

export function SessionToast() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timer
    const show = () => {
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), 5000)
    }
    window.addEventListener("quicktims:session-expired", show)
    return () => {
      window.removeEventListener("quicktims:session-expired", show)
      clearTimeout(timer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#1e1b4b",
        color: "#e0e7ff",
        padding: "12px 22px",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
        fontWeight: 600,
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
        animation: "toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        fontFamily: "inherit",
        maxWidth: "90vw",
      }}
    >
      <ShieldCheck size={18} color="#818cf8" />
      Session expired — please sign in again.
      <button
        onClick={() => setVisible(false)}
        style={{
          background: "none",
          border: "none",
          color: "#818cf8",
          cursor: "pointer",
          marginLeft: 8,
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
