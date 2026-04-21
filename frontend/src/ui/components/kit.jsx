import { forwardRef, useId } from "react"

export function Card({ title, children, actions }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="cardHeader">
          {title ? <h2 className="cardTitle">{title}</h2> : <div />}
          {actions ? <div className="cardActions">{actions}</div> : null}
        </header>
      )}
      <div className="cardBody">{children}</div>
    </section>
  )
}

export const Button = forwardRef(function Button({ variant = "primary", ...props }, ref) {
  const cls = [
    "btn",
    variant === "primary" ? "btnPrimary" : "",
    variant === "ghost" ? "btnGhost" : "",
    variant === "danger" ? "btnDanger" : ""
  ]
    .filter(Boolean)
    .join(" ")
  return <button {...props} ref={ref} className={[cls, props.className].filter(Boolean).join(" ")} />
})

export function Input({ label, hint, ...props }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <div className="fieldLabel">{label}</div>
      <input {...props} id={id} className={["input", props.className].filter(Boolean).join(" ")} />
      {hint ? <div className="fieldHint">{hint}</div> : null}
    </label>
  )
}

export function Select({ label, options, hint, ...props }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <div className="fieldLabel">{label}</div>
      <select {...props} id={id} className={["input", props.className].filter(Boolean).join(" ")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <div className="fieldHint">{hint}</div> : null}
    </label>
  )
}

export function TextArea({ label, hint, ...props }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <div className="fieldLabel">{label}</div>
      <textarea {...props} id={id} className={["input", "textarea", props.className].filter(Boolean).join(" ")} />
      {hint ? <div className="fieldHint">{hint}</div> : null}
    </label>
  )
}

export function Pill({ children, tone = "neutral" }) {
  const cls = ["pill", tone === "good" ? "pillGood" : "", tone === "bad" ? "pillBad" : "", tone === "warn" ? "pillWarn" : ""]
    .filter(Boolean)
    .join(" ")
  return <span className={cls}>{children}</span>
}

export function formatDateTime(value) {
  if (!value) return ""
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value)
  return dt.toLocaleString()
}

