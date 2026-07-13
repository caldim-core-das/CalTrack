import { useState } from "react"
import { Sun, Moon, Monitor, Check, Type, Layers, Save } from "lucide-react"
import { loadPrefs, savePrefs, applyTheme, applyAccent, applyFontSize } from "../../theme.js"

const THEMES = [
  { key: "light", label: "Light", icon: <Sun size={18} />, preview: { bg: "#F6F8FA", surface: "#FFFFFF", fg: "#0E1116" } },
  { key: "dark", label: "Dark", icon: <Moon size={18} />, preview: { bg: "#0E1116", surface: "#1A1D23", fg: "#F1F5F9" } },
  { key: "system", label: "System", icon: <Monitor size={18} />, preview: { bg: "linear-gradient(135deg, #F6F8FA 50%, #0E1116 50%)", surface: "#888", fg: "#888" } },
]

const ACCENT_COLORS = [
  { key: "indigo", label: "Indigo", value: "#1A56DB" },
  { key: "violet", label: "Violet", value: "#7C3AED" },
  { key: "emerald", label: "Emerald", value: "#059669" },
  { key: "rose", label: "Rose", value: "#E11D48" },
  { key: "amber", label: "Amber", value: "#D97706" },
  { key: "cyan", label: "Cyan", value: "#0891B2" },
  { key: "slate", label: "Slate", value: "#475569" },
  { key: "orange", label: "Orange", value: "#EA580C" },
]

const DENSITIES = [
  { key: "compact", label: "Compact", desc: "More content visible, tighter spacing.", lines: [2, 4, 6, 8] },
  { key: "comfortable", label: "Comfortable", desc: "Balanced layout for everyday use.", lines: [3, 6, 9] },
  { key: "spacious", label: "Spacious", desc: "More breathing room between elements.", lines: [4, 8] },
]

const FONT_SIZES = [
  { key: "sm", label: "Small", px: 12 },
  { key: "md", label: "Medium", px: 14 },
  { key: "lg", label: "Large", px: 16 },
  { key: "xl", label: "Extra Large", px: 18 },
]


export default function AppearanceSection({ showToast, SectionHeader }) {
  const [prefs, setPrefs] = useState(() => ({
    theme: "light",
    accent: "indigo",
    density: "comfortable",
    fontSize: "md",
    ...loadPrefs(),
  }))
  const [saved, setSaved] = useState(false)

  const update = (key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value }
      if (key === "theme") applyTheme(value)
      if (key === "accent") {
        const clr = ACCENT_COLORS.find(c => c.key === value)?.value
        if (clr) applyAccent(clr)
      }
      if (key === "fontSize") applyFontSize(value)
      savePrefs(next)
      return next
    })
  }

  const handleSave = () => {
    savePrefs(prefs)
    setSaved(true)
    showToast("Appearance preferences saved.")
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="stPanel">
      <SectionHeader title="Appearance" subtitle="Customize the look and feel of your QuickTIMS workspace." />

      {/* Theme */}
      <div className="bg-surface dark:bg-slate-900/60 rounded-2xl p-6 border border-stroke dark:border-slate-800 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sun size={18} />
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Color mode</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {THEMES.map(theme => (
            <button
              key={theme.key}
              onClick={() => update("theme", theme.key)}
              className={`relative flex flex-col rounded-2xl overflow-hidden border-2 transition-all group ${
                prefs.theme === theme.key 
                  ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/10" 
                  : "border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {/* Mini preview */}
              <div 
                className="h-24 relative overflow-hidden"
                style={{ background: theme.preview.bg }}
              >
                {theme.key !== "system" && (
                  <div className="absolute inset-x-4 top-4 space-y-2">
                    <div className="h-2.5 rounded-full bg-white/20 w-3/4" />
                    <div className="h-2 rounded-full bg-white/10 w-1/2" />
                    <div className="h-2 rounded-full bg-white/5 w-1/3" />
                  </div>
                )}
                {theme.key === "system" && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <Monitor size={48} className="text-slate-400" />
                  </div>
                )}
              </div>
              <div className="p-4 flex items-center justify-between bg-surface2 dark:bg-slate-900/80 border-t border-stroke dark:border-slate-800">
                <div className={`flex items-center gap-3 text-sm font-bold ${prefs.theme === theme.key ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"}`}>
                  {theme.icon}
                  {theme.label}
                </div>
                {prefs.theme === theme.key && (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div className="bg-surface dark:bg-slate-900/60 rounded-2xl p-6 border border-stroke dark:border-slate-800 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers size={18} />
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Accent color</span>
        </div>
        <div className="flex flex-wrap gap-4">
          {ACCENT_COLORS.map(color => (
            <button
              key={color.key}
              onClick={() => update("accent", color.key)}
              title={color.label}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 ${
                prefs.accent === color.key 
                  ? "border-indigo-600 dark:border-indigo-500 scale-110 shadow-lg" 
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color.value }}
            >
              {prefs.accent === color.key && <Check size={18} className="text-white drop-shadow-md" strokeWidth={4} />}
            </button>
          ))}
        </div>
        <div className="mt-6 text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-2">
          Current selection: <span className="text-slate-900 dark:text-white font-black uppercase tracking-widest">{ACCENT_COLORS.find(c => c.key === prefs.accent)?.label}</span>
        </div>
      </div>

      {/* Density */}
      <div className="bg-surface dark:bg-slate-900/60 rounded-2xl p-6 border border-stroke dark:border-slate-800 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers size={18} />
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Layout density</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DENSITIES.map(density => (
            <button
              key={density.key}
              onClick={() => update("density", density.key)}
              className={`flex flex-col p-5 rounded-2xl border-2 transition-all text-left ${
                prefs.density === density.key 
                  ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/10" 
                  : "border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className={`flex flex-col mb-4 space-y-1.5`}>
                {density.lines.map((w, i) => (
                  <div key={i} className={`h-1 rounded-full ${prefs.density === density.key ? "bg-indigo-600/40 dark:bg-indigo-500/40" : "bg-slate-200 dark:bg-slate-800"}`} style={{ width: `${w * 10}%` }} />
                ))}
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${prefs.density === density.key ? "text-indigo-600 dark:text-indigo-400" : "text-slate-900 dark:text-white"}`}>{density.label}</span>
                {prefs.density === density.key && <Check size={14} className="text-indigo-600 dark:text-indigo-400" strokeWidth={3} />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{density.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="bg-surface dark:bg-slate-900/60 rounded-2xl p-6 border border-stroke dark:border-slate-800 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Type size={18} />
          </div>
          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Font size</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FONT_SIZES.map(size => (
            <button
              key={size.key}
              onClick={() => update("fontSize", size.key)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                prefs.fontSize === size.key 
                  ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/10" 
                  : "border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className={`font-black mb-2 transition-all ${prefs.fontSize === size.key ? "text-indigo-600 dark:text-indigo-500" : "text-slate-900 dark:text-white"}`} style={{ fontSize: size.px + 4 }}>Aa</div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${prefs.fontSize === size.key ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`}>{size.label}</span>
              <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono mt-1">{size.px}px</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="stCard" style={{ background: "var(--bg2)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Preview</div>
        <div style={{ background: "var(--surface)", borderRadius: 10, padding: 16, border: "1px solid var(--stroke2)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--fg)", marginBottom: 6 }}>Dashboard</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Your workspace overview and quick actions.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "7px 14px", borderRadius: 8, background: ACCENT_COLORS.find(c => c.key === prefs.accent)?.value || "#1A56DB", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "default" }}>
              Primary Button
            </button>
            <button style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", color: "var(--fg)", border: "1px solid var(--stroke2)", fontSize: 12, fontWeight: 600, cursor: "default" }}>
              Ghost Button
            </button>
          </div>
        </div>
      </div>

      <div>
        <button className="stPrimaryBtn" onClick={handleSave}>
          {saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? "Saved!" : "Save appearance"}
        </button>
      </div>
    </div>
  )
}
