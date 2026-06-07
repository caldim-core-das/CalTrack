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

initTheme()

console.log("DEBUG: main.jsx loaded and initTheme() called");
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "mock-client-id.apps.googleusercontent.com"

const rootEl = document.getElementById("root");
console.log("DEBUG: Root element found:", rootEl);

createRoot(rootEl).render(
  <StrictMode>
    <ReduxProvider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </GoogleOAuthProvider>
      </BrowserRouter>
    </ReduxProvider>
  </StrictMode>
)
