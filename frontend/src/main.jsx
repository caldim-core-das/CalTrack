import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { Provider as ReduxProvider } from "react-redux"

import { ThemeProvider } from "next-themes"

import { store } from "./store/store.js"
import { AuthProvider } from "./state/auth/AuthProvider.jsx"
import { App } from "./ui/App.jsx"
import "./ui/styles.css"

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ReduxProvider store={store}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {googleClientId ? (
            <GoogleOAuthProvider clientId={googleClientId}>
              <AuthProvider>
                <App />
              </AuthProvider>
            </GoogleOAuthProvider>
          ) : (
            <AuthProvider>
              <App />
            </AuthProvider>
          )}
        </BrowserRouter>
      </ThemeProvider>
    </ReduxProvider>
  </StrictMode>
)
