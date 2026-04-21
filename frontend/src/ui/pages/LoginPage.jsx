import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../state/auth/useAuth.js"
import { apiRequest } from "../../api/client.js"
import { routes } from "../routes.js"
import { useGoogleLogin } from "@react-oauth/google"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"

/* ──────────────────────────────────────────────
   REVIEW DATA
────────────────────────────────────────────── */
const REVIEWS = [
  {
    quote:
      "As a remote team lead, QuickTIMS has been a game-changer for attendance and payroll. The real-time tracking and selfie verification give us complete confidence.",
    author: "Priya Mehra",
    role: "HR Manager, TechNova Solutions",
    stars: 5,
  },
  {
    quote:
      "We switched from a spreadsheet-based system and QuickTIMS cut our payroll processing time in half. The scheduling feature is absolutely top-notch.",
    author: "Arjun Krishnaswamy",
    role: "Operations Director, Apex Industries",
    stars: 5,
  },
  {
    quote:
      "Finally a time-tracking tool that works for SMEs. Simple, reliable, and the geolocation punch-in keeps everyone accountable. Highly recommended!",
    author: "Sneha Patel",
    role: "CEO, Bright Retail Group",
    stars: 5,
  },
  {
    quote:
      "The leave management and compliance reports save us hours every month. QuickTIMS integrates beautifully with our existing workflows.",
    author: "Rajesh Nair",
    role: "Finance Head, Greenfield Corp",
    stars: 5,
  },
]

/* ──────────────────────────────────────────────
   SAND-CLOCK LOGO SVG
────────────────────────────────────────────── */
function SandClockLogo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lgg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      {/* Background rounded square */}
      <rect width="44" height="44" rx="12" fill="url(#lgg)" />
      {/* Hourglass shape */}
      <g transform="translate(10, 7)">
        {/* Top bar */}
        <rect x="0" y="0" width="24" height="3" rx="1.5" fill="white" />
        {/* Bottom bar */}
        <rect x="0" y="27" width="24" height="3" rx="1.5" fill="white" />
        {/* Top triangle (sand above) */}
        <path d="M1 3 L23 3 L15 15 L9 15 Z" fill="rgba(255,255,255,0.9)" />
        {/* Bottom triangle (sand below) */}
        <path d="M1 27 L23 27 L15 15 L9 15 Z" fill="rgba(255,255,255,0.45)" />
        {/* Sand drip dot */}
        <circle cx="12" cy="15.5" r="2" fill="white" opacity="0.95" />
      </g>
    </svg>
  )
}

/* ──────────────────────────────────────────────
   STAR RATING
────────────────────────────────────────────── */
function Stars({ count = 5 }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ color: "#F59E0B", fontSize: 16 }}>★</span>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────
   REVIEW CAROUSEL
────────────────────────────────────────────── */
function ReviewCarousel() {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef(null)

  function goTo(idx) {
    setCurrent((idx + REVIEWS.length) % REVIEWS.length)
  }

  function resetTimer() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent(p => (p + 1) % REVIEWS.length), 5000)
  }

  useEffect(() => {
    resetTimer()
    return () => clearInterval(timerRef.current)
  }, [])

  function handlePrev() { goTo(current - 1); resetTimer() }
  function handleNext() { goTo(current + 1); resetTimer() }
  function handleDot(i) { goTo(i); resetTimer() }

  const review = REVIEWS[current]

  return (
    <div className="qt-review-wrap">
      <div className="qt-review-card">
        <div className="qt-review-header">
          <span className="qt-review-brand">QuickTIMS Rocks!</span>
          <Stars count={review.stars} />
        </div>
        <p className="qt-review-quote">"{review.quote}"</p>
        <div className="qt-review-author">{review.author}<span className="qt-review-role">, {review.role}</span></div>
      </div>

      {/* Navigation arrows */}
      <div className="qt-review-nav">
        <button className="qt-arr-btn" onClick={handlePrev} aria-label="Previous review">‹</button>
        <div className="qt-dots">
          {REVIEWS.map((_, i) => (
            <button
              key={i}
              className={`qt-dot${i === current ? " qt-dot-active" : ""}`}
              onClick={() => handleDot(i)}
              aria-label={`Review ${i + 1}`}
            />
          ))}
        </div>
        <button className="qt-arr-btn" onClick={handleNext} aria-label="Next review">›</button>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   MAIN LOGIN PAGE
────────────────────────────────────────────── */
export function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const postLoginRoute = () => {
    return routes.get_started
  }

  const googleLoginHandler = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      try {
        await loginWithGoogle(tokenResponse.access_token)
        navigate(postLoginRoute())
      } catch (err) {
        setError(err?.body?.detail || "Google login failed.")
      } finally { setLoading(false) }
    },
    onError: () => setError("Google login failed.")
  })

  // modes: signin, register
  const [mode, setMode] = useState("signin")
  const [role, setRole] = useState("employee") // admin or employee
  const [success, setSuccess] = useState("")

  // Field states
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Registration specific
  const [tab, setTab] = useState("email")
  const [phone, setPhone] = useState("")
  const [robot, setRobot] = useState(false)
  const [agree1, setAgree1] = useState(true) // Offers
  const [agree2, setAgree2] = useState(false) // Terms

  function changeMode(m) {
    setMode(m)
    setError("")
    setSuccess("")
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (mode === "signin") {
      if (!username.trim() || !password) return setError("Enter credentials.")
      setLoading(true)
      try {
        await login(username.trim(), password)
        navigate(postLoginRoute())
      } catch (err) {
        setError(err?.body?.detail || "Login failed.")
      } finally { setLoading(false) }
    } else {
      // REGISTER
      if (!fullName.trim() || !username.trim() || !password) return setError("All fields required.")
      if (!robot) return setError("Please confirm you are not a robot.")
      if (!agree2) return setError("Please agree to terms.")

      setLoading(true)
      try {
        const [first, ...rest] = fullName.split(" ")
        // Register but do NOT log in yet
        await apiRequest("/auth/register/", {
          method: "POST",
          json: {
            username: username.trim(),
            password,
            email,
            first_name: first,
            last_name: rest.join(" "),
            role
          }
        })

        // Success! Redirect to login mode
        setMode("signin")
        setSuccess("Account created successfully! Please sign in with your credentials.")
        setError("")
        // Keep the username filled for convenience
      } catch (err) {
        setError(err?.body?.detail || "Registration failed.")
      } finally { setLoading(false) }
    }
  }

  return (
    <div className="qt-login-root">
      {/* ── LEFT PANEL ── */}
      <div className="qt-left-panel">
        {/* Logo */}
        <div className="qt-left-logo">
          <CalTrackLogo size="lg" showTagline />
        </div>

        {/* Hero illustration area */}
        <div className="qt-illustration-wrap">
          <div className="qt-illustration">
            {/* Simple SVG illustration of person with devices */}
            <svg width="220" height="180" viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Cloud */}
              <ellipse cx="110" cy="40" rx="55" ry="20" fill="#E0E7FF" opacity="0.7" />
              <ellipse cx="85" cy="38" rx="30" ry="16" fill="#C7D2FE" opacity="0.6" />
              <ellipse cx="135" cy="38" rx="30" ry="16" fill="#C7D2FE" opacity="0.6" />
              {/* Monitor */}
              <rect x="20" y="55" width="70" height="48" rx="6" fill="#4F46E5" opacity="0.85" />
              <rect x="25" y="60" width="60" height="36" rx="3" fill="#EEF2FF" />
              <rect x="48" y="103" width="14" height="8" rx="2" fill="#6366F1" />
              <rect x="38" y="111" width="34" height="3" rx="1.5" fill="#A5B4FC" />
              {/* Clock icon on monitor */}
              <circle cx="55" cy="78" r="12" stroke="#4F46E5" strokeWidth="2.5" fill="white" />
              <line x1="55" y1="70" x2="55" y2="78" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
              <line x1="55" y1="78" x2="61" y2="81" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
              {/* Person – body */}
              <circle cx="148" cy="82" r="14" fill="#FCA5A5" />
              <rect x="133" y="97" width="30" height="35" rx="10" fill="#4F46E5" />
              <rect x="126" y="100" width="12" height="22" rx="6" fill="#4F46E5" />
              <rect x="162" y="100" width="12" height="22" rx="6" fill="#4F46E5" />
              {/* Phone in hand */}
              <rect x="164" y="108" width="10" height="16" rx="2.5" fill="#1E1B4B" />
              <rect x="165.5" y="109.5" width="7" height="10" rx="1.5" fill="#A5B4FC" />
              {/* Checkmark badge */}
              <circle cx="160" cy="72" r="10" fill="#10B981" />
              <path d="M154 72l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              {/* Confetti dots */}
              <circle cx="190" cy="55" r="4" fill="#FCD34D" />
              <circle cx="178" cy="45" r="3" fill="#F472B6" />
              <circle cx="100" cy="145" r="3" fill="#34D399" />
              <circle cx="30" cy="140" r="4" fill="#60A5FA" />
              <circle cx="205" cy="100" r="3" fill="#A78BFA" />
            </svg>
          </div>
        </div>

        {/* Tagline */}
        <div className="qt-tagline">
          <h2 className="qt-tagline-head">Track when your staff are at work for payroll, attendance, compliance.</h2>
          <p className="qt-tagline-sub">
            Thousands of users worldwide, from SME to Enterprise
          </p>
        </div>



        {/* Review carousel */}
        <ReviewCarousel />

        {/* Footer links */}
        <div className="qt-left-footer">
          <a href="#" className="qt-footer-link">Privacy Policy</a>
          <a href="#" className="qt-footer-link">Help centre ↗</a>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="qt-right-panel">
        <div className="qt-form-wrap">

          {/* Mode toggle */}
          <div className="qt-mode-toggle">
            <button
              id="mode-signin"
              type="button"
              className={`qt-mode-btn${mode === "signin" ? " qt-mode-active" : ""}`}
              onClick={() => changeMode("signin")}
            >Sign In</button>
            <button
              id="mode-register"
              type="button"
              className={`qt-mode-btn${mode === "register" ? " qt-mode-active" : ""}`}
              onClick={() => changeMode("register")}
            >Create Account</button>
          </div>

          <h1 className="qt-form-title">
            {mode === "signin" ? "Welcome back" : "Create a new account"}
          </h1>

          {/* Social Connect */}
          <div className="qt-connect-label">Connect with</div>
          <div className="qt-social-row">
            <button className="qt-social-btn" id="btn-google" type="button" onClick={() => googleLoginHandler()}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.2l6.7-6.7C35.4 2.2 30.1 0 24 0 14.8 0 6.9 5.4 3.1 13.3l7.8 6.1C13 13.1 18 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3.1-2.4 5.7-5 7.4l7.7 6c4.5-4.1 7.2-10.2 7.2-17.7z" />
                <path fill="#FBBC05" d="M10.9 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.5 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.7l8.4-6.1z" />
                <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.7-6c-2 1.4-4.6 2.2-7.2 2.2-5.9 0-11-4-12.8-9.4l-8 6.1C6.9 42.6 14.8 48 24 48z" />
              </svg>
              Google
            </button>
            <button className="qt-social-btn" id="btn-microsoft" type="button">
              <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Microsoft
            </button>
            <button className="qt-social-btn" id="btn-apple" type="button">
              <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663.1 0 541.8 0 336.2 127.2 222.2 252.5 222.2c64.8 0 118.8 43.1 159.4 43.1 38.9 0 99.8-45.3 169.9-45.3 26.8 0 108.2 2.6 168.1 78.3zm-104.5-98.3c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
              </svg>
              Apple
            </button>
          </div>

          <div className="qt-or-divider"><span>or</span></div>

          {/* ── SIGN IN FORM ── */}
          {mode === "signin" && (
            <form className="qt-form" onSubmit={onSubmit} noValidate>
              <div className="qt-field-wrap">
                <input
                  id="inp-username"
                  className="qt-input"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="qt-field-wrap qt-pass-wrap">
                <input
                  id="inp-password-signin"
                  className="qt-input"
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="qt-pass-eye"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>

              {success && <div className="qt-success-box">{success}</div>}
              {error && <div className="qt-error-box">{error}</div>}

              <button
                id="btn-signin"
                type="submit"
                className="qt-submit-btn qt-submit-active"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>

              <div className="qt-signin-link">
                Don't have an account?{" "}
                <a href="#" className="qt-link" onClick={e => { e.preventDefault(); changeMode("register") }}>
                  Create one
                </a>
              </div>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === "register" && (
            <form className="qt-form" onSubmit={onSubmit} noValidate>
              {/* Full Name */}
              <div className="qt-field-wrap">
                <input
                  id="inp-fullname"
                  className="qt-input"
                  placeholder="Full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>

              {/* Tabs: Email / Phone */}
              <div className="qt-tab-row">
                <button
                  type="button"
                  className={`qt-tab-btn${tab === "email" ? " qt-tab-active" : ""}`}
                  onClick={() => setTab("email")}
                >Email</button>
                <button
                  type="button"
                  className={`qt-tab-btn${tab === "phone" ? " qt-tab-active" : ""}`}
                  onClick={() => setTab("phone")}
                >Phone Number</button>
              </div>

              {tab === "email" ? (
                <div className="qt-field-wrap">
                  <input
                    id="inp-email-reg"
                    className="qt-input"
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              ) : (
                <div className="qt-phone-row">
                  <div className="qt-phone-prefix">
                    <span className="qt-flag">🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    id="inp-phone"
                    className="qt-input qt-phone-input"
                    type="tel"
                    placeholder="Phone number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
              )}

              {/* Username field (shown as 'employee' in screenshot) */}
              <div className="qt-field-wrap">
                <input
                  id="inp-username-reg"
                  className="qt-input"
                  placeholder="Username (e.g. employee)"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              {/* Password */}
              <div className="qt-field-wrap qt-pass-wrap">
                <input
                  id="inp-password"
                  className="qt-input"
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="qt-pass-eye"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>

              {/* Agree checkboxes */}
              <label className="qt-check-row">
                <input
                  type="checkbox"
                  checked={agree1}
                  onChange={e => setAgree1(e.target.checked)}
                  className="qt-checkbox"
                />
                <span className="qt-check-label">
                  I agree to receive offers, tips and product updates sent by QuickTIMS. Unsubscribe anytime.
                </span>
              </label>

              <label className="qt-check-row">
                <input
                  type="checkbox"
                  checked={agree2}
                  onChange={e => setAgree2(e.target.checked)}
                  className="qt-checkbox"
                />
                <span className="qt-check-label">
                  I agree to QuickTIMS's <a href="#" className="qt-link">Terms of Service</a> &amp; <a href="#" className="qt-link">Privacy Policy</a>.
                </span>
              </label>

              {/* reCAPTCHA robot check */}
              <div className="qt-captcha-box">
                <label className="qt-captcha-inner" htmlFor="chk-robot">
                  <input
                    id="chk-robot"
                    type="checkbox"
                    checked={robot}
                    onChange={e => setRobot(e.target.checked)}
                    className="qt-checkbox"
                  />
                  <span className="qt-captcha-text">I'm not a robot</span>
                </label>
                <div className="qt-captcha-logo">
                  <div className="qt-recaptcha-icon">
                    <svg viewBox="0 0 64 64" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="32" cy="32" r="30" stroke="#4A90D9" strokeWidth="3" fill="white" />
                      <path d="M32 12 A20 20 0 0 1 52 32" stroke="#4A90D9" strokeWidth="3" fill="none" strokeLinecap="round" />
                      <path d="M32 12 A20 20 0 0 0 12 32" stroke="#34A853" strokeWidth="3" fill="none" strokeLinecap="round" />
                      <path d="M12 32 A20 20 0 0 0 32 52" stroke="#EA4335" strokeWidth="3" fill="none" strokeLinecap="round" />
                      <path d="M32 52 A20 20 0 0 0 52 32" stroke="#FBBC05" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="qt-captcha-brand">
                    <span className="qt-captcha-rc">reCAPTCHA</span>
                    <span className="qt-captcha-rc-sub">Privacy · Terms</span>
                  </div>
                </div>
              </div>

              {error && <div className="qt-error-box">{error}</div>}

              <button
                id="btn-create-account"
                type="submit"
                className="qt-submit-btn qt-submit-active"
                disabled={loading}
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>

              <div className="qt-signin-link">
                Already have an account?{" "}
                <a href="#" className="qt-link" onClick={e => { e.preventDefault(); changeMode("signin") }}>
                  Sign in
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
