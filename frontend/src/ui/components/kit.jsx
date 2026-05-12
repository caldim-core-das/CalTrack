import { forwardRef, useId } from "react"

export function Card({ title, children, actions, className = "", ...props }) {
  return (
    <section className={`bg-[var(--surface)] rounded-xl border border-[var(--stroke)] shadow-sm overflow-hidden mb-6 ${className}`} {...props}>
      {(title || actions) && (
        <header className="px-6 py-4 border-b border-[var(--stroke)] flex justify-between items-center bg-[var(--surface2)]">
          {title ? <h2 className="text-lg font-black tracking-tight text-[var(--fg)]">{title}</h2> : <div />}
          {actions ? <div className="flex gap-2">{actions}</div> : null}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  )
}

export const Button = forwardRef(function Button({ variant = "primary", ...props }, ref) {
  const base = "inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 hover:shadow-md active:scale-[0.98]",
    ghost: "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400 hover:shadow-md active:scale-[0.98]"
  }
  const cls = [base, variants[variant] || variants.primary, props.className].filter(Boolean).join(" ")
  return <button {...props} ref={ref} className={cls} />
})

export function Input({ label, hint, ...props }) {
  const id = useId()
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <div className="text-sm font-bold text-[var(--fg2)] uppercase tracking-wider">{label}</div>
      <input
        {...props}
        id={id}
        className={["w-full px-3.5 py-2.5 rounded-lg border border-[var(--stroke2)] bg-[var(--bg2)] text-[var(--fg)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm", props.className].filter(Boolean).join(" ")}
      />
      {hint ? <div className="text-xs text-[var(--muted)] mt-0.5">{hint}</div> : null}
    </label>
  )
}

export function Select({ label, options, hint, ...props }) {
  const id = useId()
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <div className="text-sm font-bold text-[var(--fg2)] uppercase tracking-wider">{label}</div>
      <select
        {...props}
        id={id}
        className={["w-full px-3.5 py-2.5 rounded-lg border border-[var(--stroke2)] bg-[var(--bg2)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm", props.className].filter(Boolean).join(" ")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <div className="text-xs text-[var(--muted)] mt-0.5">{hint}</div> : null}
    </label>
  )
}

export function TextArea({ label, hint, ...props }) {
  const id = useId()
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <div className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{label}</div>
      <textarea
        {...props}
        id={id}
        className={["w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm min-h-[100px]", props.className].filter(Boolean).join(" ")}
      />
      {hint ? <div className="text-xs text-slate-500 mt-0.5">{hint}</div> : null}
    </label>
  )
}

export function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    good: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    bad: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
  }
  const cls = `inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${tones[tone] || tones.neutral}`
  return <span className={cls}>{children}</span>
}

export function formatDateTime(value) {
  if (!value) return ""
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value)
  return dt.toLocaleString()
}

