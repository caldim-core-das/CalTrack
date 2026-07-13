import { useState, useEffect } from "react"
import {
  Shield, Mail, Lock, Smartphone, Eye, EyeOff,
  LogOut, Clock, MapPin, Loader2, Copy, Check,
  AlertTriangle, CheckCircle2, QrCode, Key,
} from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"
import { Input } from "../../components/kit.jsx"

function Toggle({ checked, onChange }) {
  return (
    <div className={`stToggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <div className="stToggleKnob" />
    </div>
  )
}

function SessionCard({ session, onRevoke, revoking }) {
  const icons = { browser: "🌐", mobile: "📱", api: "⚙️" }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--stroke)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 22 }}>{icons[session.device_type] || "🌐"}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
            {session.device_name || "Unknown device"}
            {session.is_current && (
              <span style={{ marginLeft: 8, fontSize: 11, background: "#ECFDF5", color: "#059669", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>Current</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, display: "flex", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{session.location || "Unknown location"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} />
              {session.last_active ? new Date(session.last_active).toLocaleString() : "—"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: 2 }}>{session.ip_address}</div>
        </div>
      </div>
      {!session.is_current && (
        <button onClick={() => onRevoke(session.id)} disabled={revoking === session.id} className="stDangerBtn">
          {revoking === session.id ? <Loader2 size={11} style={{ animation: "spin .7s linear infinite" }} /> : "Revoke"}
        </button>
      )}
    </div>
  )
}

export default function AccountSecuritySection({ markDirty, showToast, Field, SectionHeader }) {
  const { user } = useAuth()

  // Email change state
  const [emailForm, setEmailForm] = useState({ new_email: "", password: "" })
  const [emailSaving, setEmailSaving] = useState(false)

  // Password change state
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" })
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false })
  const [pwSaving, setPwSaving] = useState(false)

  // OTP Password Recovery state
  const [otpMode, setOtpMode] = useState(false)
  const [otpStep, setOtpStep] = useState("request") // "request" | "verify"
  const [otpForm, setOtpForm] = useState({ otp_code: "", new_password: "", confirm_password: "" })
  const [otpSending, setOtpSending] = useState(false)
  const [otpSaving, setOtpSaving] = useState(false)
  const [showOtpPw, setShowOtpPw] = useState({ new: false, confirm: false })

  // 2FA state
  const [twofa, setTwofa] = useState({ enabled: false, qrCode: null, secret: null, verifyCode: "", backupCodes: null, step: "idle" })
  const [tfaSaving, setTfaSaving] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [revokingSession, setRevokingSession] = useState(null)

  // Login history
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    if (user) setTwofa(prev => ({ ...prev, enabled: user.two_fa_enabled || false }))
  }, [user])

  useEffect(() => {
    apiRequest("/settings/sessions/")
      .then(res => setSessions(res?.data || []))
      .catch(() => {})
      .finally(() => setSessionsLoading(false))
    apiRequest("/settings/login-history/")
      .then(res => setHistory(res?.data || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  // Email change
  const handleEmailChange = async () => {
    if (!emailForm.new_email || !emailForm.password) { showToast("All fields are required.", "error"); return }
    setEmailSaving(true)
    try {
      await apiRequest("/auth/email/change/", { method: "POST", json: emailForm })
      showToast("Email updated successfully.")
      setEmailForm({ new_email: "", password: "" })
    } catch (err) {
      showToast(err?.body?.message || "Failed to update email.", "error")
    } finally { setEmailSaving(false) }
  }

  // Password change
  const handlePasswordChange = async () => {
    if (!pwForm.current_password || !pwForm.new_password) { showToast("All fields are required.", "error"); return }
    if (pwForm.new_password !== pwForm.confirm_password) { showToast("Passwords do not match.", "error"); return }
    if (pwForm.new_password.length < 8) { showToast("Password must be at least 8 characters.", "error"); return }
    setPwSaving(true)
    try {
      await apiRequest("/auth/password/change/", { method: "POST", json: pwForm })
      showToast("Password changed successfully.")
      setPwForm({ current_password: "", new_password: "", confirm_password: "" })
    } catch (err) {
      showToast(err?.body?.message || "Failed to change password.", "error")
    } finally { setPwSaving(false) }
  }

  // OTP handlers
  const handleSendEmailOTP = async () => {
    setOtpSending(true)
    try {
      const res = await apiRequest("/auth/send-email-otp/", { method: "POST" })
      showToast(res?.message || "Verification code sent to your email.")
      setOtpStep("verify")
    } catch (err) {
      showToast(err?.body?.message || "Failed to send verification code.", "error")
    } finally {
      setOtpSending(false)
    }
  }

  const handleVerifyAndResetPassword = async () => {
    if (!otpForm.otp_code || !otpForm.new_password) {
      showToast("All fields are required.", "error")
      return
    }
    if (otpForm.new_password !== otpForm.confirm_password) {
      showToast("Passwords do not match.", "error")
      return
    }
    if (otpForm.new_password.length < 8) {
      showToast("Password must be at least 8 characters.", "error")
      return
    }
    setOtpSaving(true)
    try {
      await apiRequest("/auth/password/reset-with-otp/", { method: "POST", json: otpForm })
      showToast("Password updated successfully.")
      setOtpForm({ otp_code: "", new_password: "", confirm_password: "" })
      setOtpMode(false)
    } catch (err) {
      showToast(err?.body?.message || "Failed to reset password.", "error")
    } finally {
      setOtpSaving(false)
    }
  }

  // 2FA
  const handle2FASetup = async () => {
    setTfaSaving(true)
    try {
      const res = await apiRequest("/auth/2fa/", { method: "GET" })
      setTwofa(prev => ({ ...prev, qrCode: res.data.qr_code, secret: res.data.secret, step: "verify" }))
    } catch (err) {
      showToast(err?.body?.message || "Failed to setup 2FA.", "error")
    } finally { setTfaSaving(false) }
  }

  const handle2FAVerify = async () => {
    if (!twofa.verifyCode) { showToast("Enter the 6-digit code.", "error"); return }
    setTfaSaving(true)
    try {
      const res = await apiRequest("/auth/2fa/", { method: "POST", json: { code: twofa.verifyCode } })
      setTwofa(prev => ({ ...prev, enabled: true, step: "done", backupCodes: res.data?.backup_codes || [] }))
      showToast("Two-factor authentication enabled.")
    } catch (err) {
      showToast(err?.body?.message || "Invalid code.", "error")
    } finally { setTfaSaving(false) }
  }

  const handle2FADisable = async (password) => {
    setTfaSaving(true)
    try {
      await apiRequest("/auth/2fa/", { method: "DELETE", json: { password } })
      setTwofa({ enabled: false, qrCode: null, secret: null, verifyCode: "", backupCodes: null, step: "idle" })
      showToast("Two-factor authentication disabled.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to disable 2FA.", "error")
    } finally { setTfaSaving(false) }
  }

  const handleRevokeSession = async (id) => {
    setRevokingSession(id)
    try {
      await apiRequest(`/settings/sessions/${id}/`, { method: "DELETE" })
      setSessions(prev => prev.filter(s => s.id !== id))
      showToast("Session revoked.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to revoke session.", "error")
    } finally { setRevokingSession(null) }
  }

  const handleRevokeAll = async () => {
    try {
      await apiRequest("/settings/sessions/revoke-all/", { method: "POST" })
      setSessions(prev => prev.filter(s => s.is_current))
      showToast("All other sessions revoked.")
    } catch (err) {
      showToast("Failed to revoke sessions.", "error")
    }
  }

  const statusColor = { success: "#059669", failed: "#DC2626", mfa_required: "#D97706" }

  return (
    <div className="stPanel">
      <SectionHeader title="Account & Security" subtitle="Manage your email, password, two-factor authentication, and active sessions." />

      {/* Email Change */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Mail size={15} style={{ color: "#1A56DB" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Change Email</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Current: <strong style={{ color: "var(--fg)" }}>{user?.email || "Not set"}</strong>
        </div>
        <div className="stFormGrid">
          <Input 
            label="New email address" 
            type="email" 
            placeholder="new@example.com" 
            value={emailForm.new_email} 
            onChange={e => setEmailForm(p => ({ ...p, new_email: e.target.value }))} 
          />
          <div style={{ position: "relative" }}>
            <Input 
              label="Confirm with password" 
              type="password" 
              placeholder="Current password" 
              value={emailForm.password} 
              onChange={e => setEmailForm(p => ({ ...p, password: e.target.value }))} 
            />
            <div style={{ textAlign: "right", marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setOtpMode(true)
                  setOtpStep("request")
                  setOtpForm({ otp_code: "", new_password: "", confirm_password: "" })
                  const element = document.getElementById("change-password-card");
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1A56DB",
                  fontSize: "11px",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                  textDecoration: "underline"
                }}
              >
                Forgot password?
              </button>
            </div>
          </div>
        </div>
        <div className="stCardActions">
          <button className="stPrimaryBtn" onClick={handleEmailChange} disabled={emailSaving}>
            {emailSaving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Mail size={13} />}
            Update email
          </button>
        </div>
      </div>

      {/* Password Change */}
      <div className="stCard" id="change-password-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Lock size={15} style={{ color: "#1A56DB" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Change Password</span>
          {otpMode && (
            <span style={{ fontSize: 11, background: "#E0F2FE", color: "#0369A1", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>OTP Recovery</span>
          )}
        </div>

        {otpMode ? (
          otpStep === "request" ? (
            <div>
              <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                Forgot your password? We will send a secure 6-digit verification code to your email address: <strong style={{ color: "var(--fg)" }}>{user?.email || "your registered email"}</strong>
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button 
                  className="stPrimaryBtn" 
                  onClick={handleSendEmailOTP} 
                  disabled={otpSending}
                >
                  {otpSending ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : null}
                  Send verification code
                </button>
                <button className="stGhostBtn" onClick={() => setOtpMode(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                A verification code was sent to <strong style={{ color: "var(--fg)" }}>{user?.email}</strong>. Enter the code and your new password below.
              </p>
              <div className="stFormGrid" style={{ marginBottom: 16 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Input 
                    label="Verification Code" 
                    placeholder="Enter 6-digit code" 
                    maxLength={6} 
                    value={otpForm.otp_code} 
                    onChange={e => setOtpForm(p => ({ ...p, otp_code: e.target.value.replace(/\D/g, "") }))} 
                    style={{ letterSpacing: 4, fontSize: 16, fontWeight: 700 }}
                  />
                </div>
                
                <div style={{ position: "relative" }}>
                  <Input 
                    label="New password" 
                    type={showOtpPw.new ? "text" : "password"} 
                    placeholder="New password" 
                    value={otpForm.new_password} 
                    onChange={e => setOtpForm(p => ({ ...p, new_password: e.target.value }))} 
                  />
                  <button
                    onClick={() => setShowOtpPw(p => ({ ...p, new: !p.new }))}
                    style={{ position: "absolute", right: 10, top: 40, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0 }}
                  >
                    {showOtpPw.new ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <div style={{ position: "relative" }}>
                  <Input 
                    label="Confirm new password" 
                    type={showOtpPw.confirm ? "text" : "password"} 
                    placeholder="Confirm new password" 
                    value={otpForm.confirm_password} 
                    onChange={e => setOtpForm(p => ({ ...p, confirm_password: e.target.value }))} 
                  />
                  <button
                    onClick={() => setShowOtpPw(p => ({ ...p, confirm: !p.confirm }))}
                    style={{ position: "absolute", right: 10, top: 40, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0 }}
                  >
                    {showOtpPw.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {otpForm.new_password && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Password strength</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[8, 12, 16].map(len => (
                        <div key={len} style={{
                          flex: 1, height: 4, borderRadius: 2,
                          background: otpForm.new_password.length >= len ? "#059669" : "var(--stroke2)",
                          transition: "background .2s",
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {otpForm.new_password.length < 8 ? "Too short" : otpForm.new_password.length < 12 ? "Moderate" : "Strong"}
                    </div>
                  </div>
                )}
              </div>
              
              <div style={{ display: "flex", gap: 10 }}>
                <button 
                  className="stPrimaryBtn" 
                  onClick={handleVerifyAndResetPassword} 
                  disabled={otpSaving || !otpForm.otp_code || !otpForm.new_password || !otpForm.confirm_password}
                >
                  {otpSaving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Lock size={13} />}
                  Verify & Update Password
                </button>
                <button 
                  className="stGhostBtn" 
                  onClick={() => {
                    setOtpStep("request")
                    setOtpForm({ otp_code: "", new_password: "", confirm_password: "" })
                  }}
                  disabled={otpSaving}
                >
                  Back
                </button>
              </div>
            </div>
          )
        ) : (
          <div>
            <div className="stFormGrid">
              {[
                { label: "Current password", key: "current_password", showKey: "current" },
                { label: "New password", key: "new_password", showKey: "new" },
                { label: "Confirm new password", key: "confirm_password", showKey: "confirm" },
              ].map(({ label, key, showKey }) => (
                <div key={key} style={{ position: "relative" }}>
                  <Input 
                    label={label} 
                    type={showPw[showKey] ? "text" : "password"} 
                    placeholder={label} 
                    value={pwForm[key]} 
                    onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} 
                  />
                  <button
                    onClick={() => setShowPw(p => ({ ...p, [showKey]: !p[showKey] }))}
                    style={{ position: "absolute", right: 10, top: 40, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0 }}
                  >
                    {showPw[showKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {key === "current_password" && (
                    <div style={{ textAlign: "right", marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpMode(true)
                          setOtpStep("request")
                          setOtpForm({ otp_code: "", new_password: "", confirm_password: "" })
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#1A56DB",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: 0,
                          fontWeight: 600,
                          textDecoration: "underline"
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {pwForm.new_password && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Password strength</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[8, 12, 16].map(len => (
                      <div key={len} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: pwForm.new_password.length >= len ? "#059669" : "var(--stroke2)",
                        transition: "background .2s",
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {pwForm.new_password.length < 8 ? "Too short" : pwForm.new_password.length < 12 ? "Moderate" : "Strong"}
                  </div>
                </div>
              )}
            </div>
            <div className="stCardActions">
              <button className="stPrimaryBtn" onClick={handlePasswordChange} disabled={pwSaving}>
                {pwSaving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Lock size={13} />}
                Update password
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2FA */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Smartphone size={15} style={{ color: "#1A56DB" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Two-Factor Authentication</span>
            {twofa.enabled && (
              <span style={{ fontSize: 11, background: "#ECFDF5", color: "#059669", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>Enabled</span>
            )}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 16px" }}>
          Add an extra layer of security to your account using a time-based one-time password (TOTP) app like Google Authenticator or Authy.
        </p>

        {!twofa.enabled && twofa.step === "idle" && (
          <button className="stPrimaryBtn" onClick={handle2FASetup} disabled={tfaSaving}>
            {tfaSaving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <QrCode size={13} />}
            Set up authenticator app
          </button>
        )}

        {twofa.step === "verify" && twofa.qrCode && (
          <div>
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 16 }}>
              <img src={twofa.qrCode} alt="QR Code" style={{ width: 140, height: 140, borderRadius: 8, border: "1px solid var(--stroke2)" }} />
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                  1. Open your authenticator app and scan the QR code.
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                  2. Or enter this secret manually:
                </div>
                <code style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, background: "var(--bg2)", padding: "6px 10px", borderRadius: 6, display: "block" }}>
                  {twofa.secret}
                </code>
              </div>
            </div>
            <Input 
              label="Enter 6-digit code from app" 
              placeholder="000000" 
              maxLength={6} 
              value={twofa.verifyCode} 
              onChange={e => setTwofa(prev => ({ ...prev, verifyCode: e.target.value.replace(/\D/g, "") }))} 
              style={{ letterSpacing: 6, fontSize: 18, fontWeight: 700 }} 
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="stPrimaryBtn" onClick={handle2FAVerify} disabled={tfaSaving || twofa.verifyCode.length !== 6}>
                {tfaSaving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Check size={13} />}
                Verify & enable
              </button>
              <button className="stGhostBtn" onClick={() => setTwofa(prev => ({ ...prev, step: "idle", qrCode: null }))}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {twofa.step === "done" && twofa.backupCodes && (
          <div style={{ background: "var(--bg2)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <CheckCircle2 size={15} style={{ color: "#059669" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>2FA enabled! Save your backup codes.</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              Store these codes in a safe place. Each code can be used once if you lose access to your authenticator app.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {twofa.backupCodes.map((code, i) => (
                <code key={i} style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, background: "var(--surface)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--stroke2)" }}>
                  {code}
                </code>
              ))}
            </div>
            <button
              className="stGhostBtn"
              style={{ marginTop: 12 }}
              onClick={() => navigator.clipboard.writeText(twofa.backupCodes.join("\n")).then(() => showToast("Backup codes copied."))}
            >
              <Copy size={12} /> Copy all codes
            </button>
          </div>
        )}

        {twofa.enabled && twofa.step !== "done" && (
          <Disable2FAPanel onDisable={handle2FADisable} saving={tfaSaving} />
        )}
      </div>

      {/* Active Sessions */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Smartphone size={15} style={{ color: "#1A56DB" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Active Sessions</span>
          </div>
          {sessions.filter(s => !s.is_current).length > 0 && (
            <button className="stDangerBtn" onClick={handleRevokeAll}>
              <LogOut size={11} /> Revoke all others
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
            <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>No active sessions found.</div>
        ) : (
          <div>
            {sessions.map(session => (
              <SessionCard key={session.id} session={session} onRevoke={handleRevokeSession} revoking={revokingSession} />
            ))}
          </div>
        )}
      </div>

      {/* Login History */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Clock size={15} style={{ color: "#1A56DB" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Login History</span>
        </div>

        {historyLoading ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
            <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>No login history yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--stroke)" }}>
                  {["Date & Time", "IP Address", "Location", "Status"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--muted)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid var(--stroke)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--fg)" }}>{new Date(entry.created_at).toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{entry.ip_address || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{entry.location || "Unknown"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, background: entry.status === "success" ? "#ECFDF5" : "#FEF2F2", color: statusColor[entry.status] || "#7C8592", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Disable2FAPanel({ onDisable, saving }) {
  const [pw, setPw] = useState("")
  const [open, setOpen] = useState(false)
  return (
    <div>
      {!open ? (
        <button className="stDangerBtn" onClick={() => setOpen(true)}>
          <AlertTriangle size={11} /> Disable 2FA
        </button>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
          <Input 
            type="password" 
            placeholder="Confirm password" 
            value={pw} 
            onChange={e => setPw(e.target.value)} 
            style={{ maxWidth: 220 }} 
          />
          <button className="stDangerBtn" onClick={() => onDisable(pw)} disabled={saving || !pw}>
            {saving ? <Loader2 size={11} style={{ animation: "spin .7s linear infinite" }} /> : null}
            Confirm disable
          </button>
          <button className="stGhostBtn" onClick={() => setOpen(false)} style={{ fontSize: 12 }}>Cancel</button>
        </div>
      )}
    </div>
  )
}
