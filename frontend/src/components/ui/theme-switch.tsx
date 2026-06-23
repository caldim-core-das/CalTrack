import { MoonIcon, SunIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { loadPrefs, savePrefs, applyTheme } from "../../ui/theme.js"

function isDarkResolved() {
  const prefs = loadPrefs()
  const theme = prefs.theme || "light"
  if (theme === "dark") return true
  if (theme === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export default function ThemeSwitch({ style = {}, ...props }) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsDark(isDarkResolved())
  }, [])

  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark"
    setIsDark(!isDark)
    applyTheme(next)
    const prefs = loadPrefs()
    savePrefs({ ...prefs, theme: next })
  }, [isDark])

  if (!mounted) return null

  return (
    <div
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        width: 52,
        height: 28,
        borderRadius: 14,
        background: isDark ? "#5d5fef" : "#e2e8f0",
        cursor: "pointer",
        transition: "background 0.25s",
        flexShrink: 0,
        userSelect: "none",
        ...style,
      }}
      {...props}
    >
      <span style={{
        position: "absolute",
        left: isDark ? 26 : 4,
        top: 4,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,.25)",
        transition: "left 0.25s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {isDark
          ? <MoonIcon size={11} style={{ color: "#5d5fef" }} />
          : <SunIcon size={11} style={{ color: "#f59e0b" }} />
        }
      </span>
    </div>
  )
}
