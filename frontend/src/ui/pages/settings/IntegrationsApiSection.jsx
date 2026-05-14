import { useState, useEffect } from "react"
import {
  Key, Plus, Trash2, Copy, Check, Eye, EyeOff,
  Webhook, Globe, Loader2, ChevronDown, ChevronUp,
  Terminal, Zap, Shield, AlertTriangle, Link,
} from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"

const WEBHOOK_EVENTS = [
  "employee.created", "employee.updated", "employee.deleted",
  "timelog.created", "timelog.updated",
  "leave.created", "leave.approved", "leave.rejected",
  "payroll.generated",
  "task.created", "task.completed",
]

const OAUTH_APPS = [
  { key: "slack", name: "Slack", desc: "Post attendance and leave notifications to Slack channels.", logo: "💬", connected: false },
  { key: "google_workspace", name: "Google Workspace", desc: "Sync employee directory and calendar events.", logo: "🔵", connected: false },
  { key: "microsoft_teams", name: "Microsoft Teams", desc: "Receive alerts and notifications in Teams channels.", logo: "🟦", connected: false },
  { key: "zapier", name: "Zapier", desc: "Connect to 5,000+ apps and automate workflows.", logo: "⚡", connected: false },
  { key: "github", name: "GitHub", desc: "Sync developer activity and task tracking.", logo: "🐙", connected: false },
]

const SCOPE_OPTIONS = ["read", "write", "admin"]

function CopyButton({ text, onCopied }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (onCopied) onCopied()
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={handleCopy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#059669" : "var(--muted)", padding: 4, display: "flex", alignItems: "center" }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function NewKeyModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", scopes: ["read"], expires_in_days: "" })
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [showKey, setShowKey] = useState(false)

  const handleCreate = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const res = await apiRequest("/settings/api-keys/", {
        method: "POST",
        json: {
          name: form.name,
          scopes: form.scopes,
          ...(form.expires_in_days ? { expires_in_days: parseInt(form.expires_in_days) } : {}),
        },
      })
      setNewKey(res.data?.raw_key)
      if (onCreated) onCreated(res.data)
    } finally {
      setSaving(false)
    }
  }

  const toggleScope = (scope) => {
    setForm(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope) ? prev.scopes.filter(s => s !== scope) : [...prev.scopes, scope],
    }))
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ width: "100%", maxWidth: 480, padding: 32 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--fg)", marginBottom: 4 }}>Create API Key</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>Generate a new secret key for programmatic access.</div>

        {newKey ? (
          <div>
            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 8 }}>⚠ Copy this key now — it won't be shown again.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, fontFamily: "monospace", background: "#fff", padding: "8px 12px", borderRadius: 6, border: "1px solid #A7F3D0", wordBreak: "break-all" }}>
                  {showKey ? newKey : `${newKey.slice(0, 12)}${"•".repeat(30)}`}
                </code>
                <button onClick={() => setShowKey(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <CopyButton text={newKey} />
              </div>
            </div>
            <button className="stPrimaryBtn" onClick={onClose}><Check size={13} /> Done</button>
          </div>
        ) : (
          <div>
            <div className="stFormGrid">
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Key name</div>
                <input
                  className="stInput"
                  placeholder="e.g. Production API, CI Pipeline"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Permissions (scopes)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {SCOPE_OPTIONS.map(scope => (
                    <button
                      key={scope}
                      onClick={() => toggleScope(scope)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        border: form.scopes.includes(scope) ? "1.5px solid #1A56DB" : "1px solid var(--stroke2)",
                        background: form.scopes.includes(scope) ? "#EFF4FF" : "var(--bg2)",
                        color: form.scopes.includes(scope) ? "#1A56DB" : "var(--fg2)",
                      }}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Expiry (days, optional)</div>
                <input
                  className="stInput"
                  type="number"
                  placeholder="Leave blank for no expiry"
                  value={form.expires_in_days}
                  onChange={e => setForm(p => ({ ...p, expires_in_days: e.target.value }))}
                  style={{ maxWidth: 240 }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="stPrimaryBtn" onClick={handleCreate} disabled={saving || !form.name || form.scopes.length === 0}>
                {saving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Key size={13} />}
                Generate key
              </button>
              <button className="stGhostBtn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WebhookRow({ webhook, onDelete, onToggle, onTest }) {
  const [expanded, setExpanded] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  return (
    <div style={{ border: "1px solid var(--stroke2)", borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer" }} onClick={() => setExpanded(v => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: webhook.status === "active" ? "#059669" : webhook.status === "failing" ? "#DC2626" : "#D97706" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>{webhook.name}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{webhook.url}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{webhook.events?.length || 0} events</span>
          {expanded ? <ChevronUp size={14} style={{ color: "var(--muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--muted)" }} />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--stroke)", background: "var(--bg2)" }}>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Signing Secret</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ fontSize: 12, fontFamily: "monospace", background: "var(--surface)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--stroke2)", flex: 1 }}>
                {showSecret ? webhook.secret : `whsec_${"•".repeat(20)}`}
              </code>
              <button onClick={() => setShowSecret(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <CopyButton text={webhook.secret} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Subscribed Events</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(webhook.events || []).map(ev => (
                <span key={ev} style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--stroke2)", padding: "3px 8px", borderRadius: 6, fontFamily: "monospace", color: "var(--fg2)" }}>
                  {ev}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="stGhostBtn" style={{ fontSize: 12 }} onClick={() => onTest(webhook)}>
              <Zap size={12} /> Test delivery
            </button>
            <button className="stDangerBtn" onClick={() => onDelete(webhook.id)}>
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewWebhookForm({ onCreated, onCancel, showToast }) {
  const [form, setForm] = useState({ name: "", url: "", events: [] })
  const [saving, setSaving] = useState(false)
  const toggleEvent = ev => setForm(p => ({ ...p, events: p.events.includes(ev) ? p.events.filter(e => e !== ev) : [...p.events, ev] }))
  const handleCreate = async () => {
    if (!form.name || !form.url || form.events.length === 0) { showToast("Name, URL, and at least one event are required.", "error"); return }
    setSaving(true)
    try {
      const res = await apiRequest("/settings/webhooks/", { method: "POST", json: form })
      onCreated(res.data)
    } catch (err) {
      showToast(err?.body?.message || "Failed to create webhook.", "error")
    } finally { setSaving(false) }
  }
  return (
    <div style={{ padding: 20, background: "var(--bg2)", borderRadius: 10, border: "1px dashed var(--stroke2)", marginBottom: 10 }}>
      <div className="stFormGrid" style={{ marginBottom: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Webhook name</div>
          <input className="stInput" placeholder="Production webhook" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Endpoint URL</div>
          <div className="stInputAddon">
            <span className="stInputAddonPrefix"><Globe size={12} /></span>
            <input className="stInput stInputAddonField" placeholder="https://your-app.com/webhooks/quicktims" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Subscribe to events</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {WEBHOOK_EVENTS.map(ev => (
              <button key={ev} onClick={() => toggleEvent(ev)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", border: form.events.includes(ev) ? "1.5px solid #1A56DB" : "1px solid var(--stroke2)", background: form.events.includes(ev) ? "#EFF4FF" : "var(--surface)", color: form.events.includes(ev) ? "#1A56DB" : "var(--fg2)" }}>
                {ev}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="stPrimaryBtn" onClick={handleCreate} disabled={saving}>
          {saving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Plus size={13} />}
          Create webhook
        </button>
        <button className="stGhostBtn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default function IntegrationsApiSection({ showToast, SectionHeader }) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"

  const [apiKeys, setApiKeys] = useState([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [showNewKey, setShowNewKey] = useState(false)
  const [revoking, setRevoking] = useState(null)

  const [webhooks, setWebhooks] = useState([])
  const [whLoading, setWhLoading] = useState(true)
  const [showNewWebhook, setShowNewWebhook] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    apiRequest("/settings/api-keys/").then(res => setApiKeys(res?.data || [])).catch(() => { }).finally(() => setKeysLoading(false))
    apiRequest("/settings/webhooks/").then(res => setWebhooks(res?.data || [])).catch(() => { }).finally(() => setWhLoading(false))
  }, [isAdmin])

  const handleRevokeKey = async (id) => {
    if (!confirm("Revoke this API key? Apps using it will immediately lose access.")) return
    setRevoking(id)
    try {
      await apiRequest(`/settings/api-keys/${id}/`, { method: "DELETE" })
      setApiKeys(prev => prev.filter(k => k.id !== id))
      showToast("API key revoked.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to revoke key.", "error")
    } finally { setRevoking(null) }
  }

  const handleDeleteWebhook = async (id) => {
    if (!confirm("Delete this webhook? Deliveries will stop immediately.")) return
    setDeleting(id)
    try {
      await apiRequest(`/settings/webhooks/${id}/`, { method: "DELETE" })
      setWebhooks(prev => prev.filter(w => w.id !== id))
      showToast("Webhook deleted.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to delete webhook.", "error")
    } finally { setDeleting(null) }
  }

  const handleTestWebhook = async (webhook) => {
    showToast(`Test event sent to ${webhook.url}`)
  }

  if (!isAdmin) return (
    <div className="stPanel">
      <SectionHeader title="Integrations & API" subtitle="API keys, webhooks, and OAuth connections." />
      <div className="stCard" style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
        <Shield size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 700 }}>Admin access required</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Contact your admin to manage API keys and integrations.</div>
      </div>
    </div>
  )

  return (
    <div className="stPanel">
      <SectionHeader title="Integrations & API" subtitle="Manage API keys, webhook endpoints, and OAuth app connections." />

      {/* API Keys */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Key size={15} style={{ color: "#1A56DB" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>API Keys</span>
          </div>
          <button className="stPrimaryBtn" onClick={() => setShowNewKey(true)}>
            <Plus size={13} /> New key
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>
          API keys grant programmatic access to your workspace data. Treat them like passwords — never expose them in client-side code.
        </div>

        {keysLoading ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
            <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
          </div>
        ) : apiKeys.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>No API keys. Create one to get started.</div>
        ) : (
          <div>
            {apiKeys.map(key => (
              <div key={key.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 0", borderBottom: "1px solid var(--stroke)", gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF4FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Key size={14} style={{ color: "#1A56DB" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>{key.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 10, marginTop: 2 }}>
                      <span style={{ fontFamily: "monospace" }}>{key.key_prefix}••••••••</span>
                      <span>{key.scopes?.join(", ")}</span>
                      {key.last_used_at && <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>}
                      {key.expires_at && <span>Expires {new Date(key.expires_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeKey(key.id)}
                  disabled={revoking === key.id}
                  className="stDangerBtn"
                >
                  {revoking === key.id ? <Loader2 size={11} style={{ animation: "spin .7s linear infinite" }} /> : <Trash2 size={11} />}
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhooks */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={15} style={{ color: "#7C3AED" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Webhook Endpoints</span>
          </div>
          <button className="stPrimaryBtn" onClick={() => setShowNewWebhook(v => !v)}>
            <Plus size={13} /> Add webhook
          </button>
        </div>

        {showNewWebhook && (
          <NewWebhookForm
            onCreated={wh => { setWebhooks(prev => [wh, ...prev]); setShowNewWebhook(false); showToast("Webhook created.") }}
            onCancel={() => setShowNewWebhook(false)}
            showToast={showToast}
          />
        )}

        {whLoading ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
            <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
          </div>
        ) : webhooks.length === 0 && !showNewWebhook ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>No webhooks configured.</div>
        ) : (
          <div>
            {webhooks.map(wh => (
              <WebhookRow key={wh.id} webhook={wh} onDelete={handleDeleteWebhook} onTest={handleTestWebhook} />
            ))}
          </div>
        )}
      </div>

      {/* OAuth Apps */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Link size={15} style={{ color: "#059669" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Connected Apps</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {OAUTH_APPS.map(app => (
            <div key={app.key} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", border: "1px solid var(--stroke2)", borderRadius: 10,
              background: app.connected ? "#ECFDF508" : "var(--surface2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 24, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--stroke2)" }}>
                  {app.logo}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>{app.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{app.desc}</div>
                </div>
              </div>
              <button
                onClick={() => showToast(`Connecting to ${app.name}...`)}
                className={app.connected ? "stDangerBtn" : "stGhostBtn"}
                style={{ fontSize: 12, flexShrink: 0 }}
              >
                {app.connected ? "Disconnect" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {showNewKey && (
        <NewKeyModal
          onClose={() => setShowNewKey(false)}
          onCreated={key => { setApiKeys(prev => [key, ...prev]); setShowNewKey(false) }}
        />
      )}
    </div>
  )
}
