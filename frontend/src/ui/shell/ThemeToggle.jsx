import { useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "quicktims.theme"

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "dark" || stored === "light") return stored
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(STORAGE_KEY, theme)
  window.dispatchEvent(new CustomEvent("quicktims:theme", { detail: theme }))
}

export function ThemeToggle() {
  const initial = useMemo(getInitialTheme, [])
  const [theme, setTheme] = useState(initial)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    function sync() {
      const t = document.documentElement.dataset.theme
      if (t === "dark" || t === "light") setTheme(t)
      else setTheme(getInitialTheme())
    }
    function onStorage(e) {
      if (e?.key === STORAGE_KEY) sync()
    }
    function onThemeEvent() {
      sync()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("quicktims:theme", onThemeEvent)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("quicktims:theme", onThemeEvent)
    }
  }, [])

  return (
    <button
      className="themeToggle"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  )
}
