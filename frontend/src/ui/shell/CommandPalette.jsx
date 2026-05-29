import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Home, Clock, CheckSquare, CalendarDays, Banknote, CalendarRange, Users, BarChart3, Settings, LogOut, Command, ChevronRight } from "lucide-react"
import { routes } from "../routes.js"
import { motion, AnimatePresence } from "framer-motion"

const ACTIONS = [
  { id: "dashboard", label: "Go to Dashboard", shortcut: ["G", "D"], icon: <Home size={18} />, to: routes.dashboard, color: "text-emerald-500" },
  { id: "time", label: "Track Time", shortcut: ["G", "T"], icon: <Clock size={18} />, to: routes.time, color: "text-amber-500" },
  { id: "tasks", label: "Manage Jobs", shortcut: ["G", "K"], icon: <CheckSquare size={18} />, to: routes.tasks, color: "text-teal-500" },
  { id: "leaves", label: "Request Leave", shortcut: ["G", "L"], icon: <CalendarDays size={18} />, to: routes.leaves, color: "text-rose-500" },
  { id: "payroll", label: "View Payroll", shortcut: ["G", "P"], icon: <Banknote size={18} />, to: routes.payroll, color: "text-indigo-500" },
  { id: "scheduling", label: "Team Schedule", shortcut: ["G", "S"], icon: <CalendarRange size={18} />, to: routes.scheduling, color: "text-sky-500" },
  { id: "employees", label: "Employee Directory", shortcut: ["G", "E"], icon: <Users size={18} />, to: routes.employees, color: "text-fuchsia-500" },
  { id: "reports", label: "Analytics & Reports", shortcut: ["G", "R"], icon: <BarChart3 size={18} />, to: routes.reports, color: "text-yellow-500" },
  { id: "settings", label: "Enterprise Settings", shortcut: ["G", ","], icon: <Settings size={18} />, to: routes.settings, color: "text-slate-500" },
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
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const filtered = ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleExecute = (a) => {
    if (!a) return
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Area - Theme Aware */}
            <div className="relative flex items-center px-8 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800">
              <Search size={22} className="text-slate-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search actions, pages, or settings..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none py-7 px-5 text-lg font-black text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 tracking-tight"
              />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] shadow-inner">
                ESC
              </div>
            </div>

            {/* Results Area */}
            <div className="max-h-[440px] overflow-y-auto p-4 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <div className="p-4 rounded-3xl bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600">
                    <Command size={32} />
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 font-bold tracking-tight text-lg">No results for "{query}"</p>
                    <p className="text-slate-400 dark:text-slate-600 text-sm mt-1">Try searching for "Dashboard" or "Settings"</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((item, i) => {
                    const active = selectedIndex === i
                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setSelectedIndex(i)}
                        onClick={() => handleExecute(item)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 group relative ${
                          active 
                            ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 translate-x-1" 
                            : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-xl transition-colors ${
                            active ? "bg-white/20 text-white" : `bg-slate-100 dark:bg-slate-800/50 ${item.color}`
                          }`}>
                            {item.icon}
                          </div>
                          <span className={`text-sm font-black tracking-tight ${active ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                            {item.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="flex gap-1.5">
                            {item.shortcut.map((k) => (
                              <span key={k} className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                active 
                                  ? "bg-white/10 border-white/20 text-white" 
                                  : "bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600"
                              }`}>
                                {k}
                              </span>
                            ))}
                          </div>
                          <ChevronRight size={16} className={`transition-transform duration-300 ${active ? "translate-x-1 opacity-100" : "opacity-0 -translate-x-2"}`} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-8">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><kbd className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 leading-none">↑↓</kbd> Navigate</span>
                <span className="flex items-center gap-1.5"><kbd className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 leading-none">↵</kbd> Select</span>
              </div>
              <span>CalTrack Intelligence search</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
