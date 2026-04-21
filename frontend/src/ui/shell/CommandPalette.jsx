import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Home, Clock, CheckSquare, CalendarDays, Banknote, CalendarRange, Users, BarChart3, Settings, LogOut } from "lucide-react"
import { routes } from "../routes.js"

const ACTIONS = [
  { id: "dashboard", label: "Go to Dashboard", shortcut: "G D", icon: <Home size={16} />, to: routes.dashboard },
  { id: "time", label: "Track Time", shortcut: "G T", icon: <Clock size={16} />, to: routes.time },
  { id: "tasks", label: "Manage Tasks", shortcut: "G K", icon: <CheckSquare size={16} />, to: routes.tasks },
  { id: "leaves", label: "Request Leave", shortcut: "G L", icon: <CalendarDays size={16} />, to: routes.leaves },
  { id: "payroll", label: "View Payroll", shortcut: "G P", icon: <Banknote size={16} />, to: routes.payroll },
  { id: "scheduling", label: "Team Schedule", shortcut: "G S", icon: <CalendarRange size={16} />, to: routes.scheduling },
  { id: "employees", label: "Employee Directory", shortcut: "G E", icon: <Users size={16} />, to: routes.employees },
  { id: "reports", label: "Analytics & Reports", shortcut: "G R", icon: <BarChart3 size={16} />, to: routes.reports },
  { id: "settings", label: "Enterprise Settings", shortcut: "G ,", icon: <Settings size={16} />, to: routes.settings },
]

export function CommandPalette({ open, setOpen }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))

  const handleExecute = (a) => {
    navigate(a.to)
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % filtered.length)
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
    }
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault()
      handleExecute(filtered[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease" }} onClick={() => setOpen(false)}>
      <div 
        style={{ width: "100%", maxWidth: 640, background: "var(--surface)", borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.2), 0 0 0 1px var(--stroke)", overflow: "hidden", display: "flex", flexDirection: "column", transform: "scale(1)", animation: "slideDown 0.2s cubic-bezier(0.16,1,0.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid var(--stroke)" }}>
          <Search size={20} color="var(--muted)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, settings, or actions..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "20px 16px", fontSize: 16, color: "var(--fg)" }}
          />
          <div style={{ background: "var(--surface2)", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: 0.5 }}>ESC</div>
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto", padding: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>No results found for "{query}"</div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.id}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => handleExecute(item)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                  background: selectedIndex === i ? "var(--primary)" : "transparent",
                  color: selectedIndex === i ? "#fff" : "var(--fg)",
                  transition: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ color: selectedIndex === i ? "#fff" : "var(--muted)", display: "flex" }}>{item.icon}</div>
                  <span style={{ fontSize: 14, fontWeight: selectedIndex === i ? 700 : 500 }}>{item.label}</span>
                </div>
                {item.shortcut && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {item.shortcut.split(" ").map((k) => (
                      <div key={k} style={{ background: selectedIndex === i ? "rgba(255,255,255,0.2)" : "var(--surface2)", color: selectedIndex === i ? "#fff" : "var(--muted)", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                        {k}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
