import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { Provider as ReduxProvider } from "react-redux"

import { store } from "./store/store.js"
import { AuthProvider } from "./state/auth/AuthProvider.jsx"
import { App } from "./ui/App.jsx"
import { initTheme } from "./ui/theme.js"
import "./ui/styles.css"

// Secure the console view in both dev and prod by default to prevent data leaks.
// Logs can be explicitly enabled in localStorage via: localStorage.setItem("caltrack.debug", "true")
const enableLogs = localStorage.getItem("caltrack.debug") === "true";
if (!enableLogs) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  if (import.meta.env.PROD) {
    console.warn = () => {};
    console.error = () => {};
  }

  const originalLog = window.console && (window.console.log || (() => {}));
  if (originalLog) {
    originalLog.call(console, "%cCalTrack Security Notice", "color: #4f46e5; font-size: 20px; font-weight: bold;");
    originalLog.call(console, "%cThis is a secure console view. Logs are disabled to prevent data leaks.", "color: #ef4444; font-size: 14px;");
    originalLog.call(console, "%cTo enable development logs, run: localStorage.setItem('caltrack.debug', 'true') and refresh.", "color: #64748b; font-size: 11px;");
  }
}

initTheme()

console.log("DEBUG: main.jsx loaded and initTheme() called");
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "mock-client-id.apps.googleusercontent.com"
const rootEl = document.getElementById("root");

const rootEl = document.getElementById("root");
console.log("DEBUG: Root element found:", rootEl);

createRoot(rootEl).render(
  <StrictMode>
    <ReduxProvider store={store}>
      <BrowserRouter basename={import.meta.env.DEV ? "/" : "/Caltrack"} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </GoogleOAuthProvider>
      </BrowserRouter>
    </ReduxProvider>
  </StrictMode>
)
