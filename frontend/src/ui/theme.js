const PREF_KEY = "quicktims.appearance"

export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") } catch { return {} }
}

export function savePrefs(prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch {}
}

export function applyTheme(theme) {
  const root = document.documentElement
  let resolved = theme

  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  if (resolved === "dark") {
    root.setAttribute("data-theme", "dark")
    root.classList.add("dark")
    // Match the established dark palette from styles.css
    document.body.style.backgroundColor = "#0B111D"
  } else {
    root.setAttribute("data-theme", "light")
    root.classList.remove("dark")
    document.body.style.backgroundColor = ""
  }
}

export function applyAccent(colorValue) {
  document.documentElement.style.setProperty("--primary", colorValue)
  document.documentElement.style.setProperty("--accent", colorValue)
}

export function applyFontSize(size) {
  const map = { sm: "12px", md: "14px", lg: "16px", xl: "18px" }
  const px = map[size] || "14px"
  document.documentElement.style.setProperty("--font-size-base", px)
  document.documentElement.style.fontSize = px
}

export function initTheme() {
  const prefs = loadPrefs()
  
  // Force reset theme to 'light' (white color scheme) to satisfy user request
  prefs.theme = "light"
  savePrefs(prefs)
  localStorage.setItem("quicktims.theme", "light")

  applyTheme("light")
  
  if (prefs.accent) {
    const ACCENT_MAP = {
      indigo: "#1A56DB", violet: "#7C3AED", emerald: "#059669",
      rose: "#E11D48", amber: "#D97706", cyan: "#0891B2",
      slate: "#475569", orange: "#EA580C",
    }
    const colorValue = ACCENT_MAP[prefs.accent]
    if (colorValue) applyAccent(colorValue)
  }
  if (prefs.fontSize) applyFontSize(prefs.fontSize)

  // Re-apply if system preference changes at runtime
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyTheme("light")
  })
}
