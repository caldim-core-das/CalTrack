import { useState } from "react"
import { AlertTriangle, Trash2, UserCheck, Loader2, ShieldAlert } from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"

function DangerCard({ icon, title, desc, children, borderColor = "rgba(220,38,38,.25)" }) {
  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ color: "#DC2626", flexShrink: 0, marginTop: 1 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#DC2626", marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.65 }}>{desc}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function DangerZoneSection({ showToast, SectionHeader }) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"

  // Transfer ownership
  const [transferEmail, setTransferEmail] = useState("")
  const [transferConfirm, setTransferConfirm] = useState("")
  const [transferring, setTransferring] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)

  // Delete workspace
  const [workspaceName, setWorkspaceName] = useState("")
  const [deletingWs, setDeletingWs] = useState(false)
  const [showDeleteWs, setShowDeleteWs] = useState(false)

  const handleTransfer = async () => {
    if (!transferEmail) { showToast("Enter the new owner's email.", "error"); return }
    if (transferConfirm !== "TRANSFER") { showToast('Type "TRANSFER" to confirm.', "error"); return }
    setTransferring(true)
    try {
      await apiRequest("/settings/data/transfer-ownership/", { method: "POST", json: { email: transferEmail } })
      showToast(`Ownership transferred to ${transferEmail}. Your role has been changed to Manager.`)
      setShowTransferForm(false)
      setTransferEmail("")
      setTransferConfirm("")
    } catch (err) {
      showToast(err?.body?.message || "Failed to transfer ownership.", "error")
    } finally {
      setTransferring(false)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!workspaceName) { showToast("Enter the workspace name.", "error"); return }
    setDeletingWs(true)
    try {
      await apiRequest("/settings/data/delete-workspace/", { method: "POST", json: { confirm_name: workspaceName } })
      showToast("Workspace deletion scheduled. You'll receive a confirmation email shortly.")
      setShowDeleteWs(false)
    } catch (err) {
      showToast(err?.body?.message || "Failed to schedule deletion.", "error")
    } finally {
      setDeletingWs(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="stPanel">
        <SectionHeader title="Danger Zone" subtitle="Irreversible actions — proceed with extreme caution." />
        <div className="stCard" style={{ textAlign: "center", padding: 48 }}>
          <ShieldAlert size={36} style={{ color: "var(--muted)", opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>Admin access required</div>
          <div style={{ fontSize: 12, color: "var(--subtle)", marginTop: 4 }}>
            Only workspace admins can perform these actions.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stPanel">
      <SectionHeader title="Danger Zone" subtitle="These actions are permanent and cannot be undone. Proceed with extreme caution." />

      {/* Warning banner */}
      <div style={{
        padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA",
        borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <AlertTriangle size={18} style={{ color: "#DC2626", flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B", marginBottom: 2 }}>Read carefully before proceeding</div>
          <div style={{ fontSize: 12, color: "#B91C1C", lineHeight: 1.6 }}>
            All actions in this section are permanent and immediately effective. There are no undo options.
            We recommend exporting your data before proceeding.
          </div>
        </div>
      </div>

      {/* Transfer Ownership */}
      <DangerCard
        icon={<UserCheck size={18} />}
        title="Transfer workspace ownership"
        desc="Transfer full ownership of this workspace to another admin member. You will lose owner privileges and be reassigned as a Manager. The new owner will have full control over billing, settings, and member management."
        borderColor="rgba(217,119,6,.3)"
      >
        {!showTransferForm ? (
          <button
            style={{ padding: "8px 16px", background: "transparent", border: "1.5px solid #D97706", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#D97706", cursor: "pointer" }}
            onClick={() => setShowTransferForm(true)}
          >
            <UserCheck size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
            Transfer ownership
          </button>
        ) : (
          <div style={{ padding: 20, background: "rgba(217,119,6,.06)", borderRadius: 10, border: "1px dashed rgba(217,119,6,.4)" }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                New owner's email address
              </div>
              <input
                className="stInput"
                type="email"
                placeholder="new-owner@company.com"
                value={transferEmail}
                onChange={e => setTransferEmail(e.target.value)}
                style={{ borderColor: "rgba(217,119,6,.4)", maxWidth: 320 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Type <strong style={{ color: "#D97706" }}>TRANSFER</strong> to confirm
              </div>
              <input
                className="stInput"
                placeholder="TRANSFER"
                value={transferConfirm}
                onChange={e => setTransferConfirm(e.target.value)}
                style={{ borderColor: "rgba(217,119,6,.4)", maxWidth: 200, letterSpacing: 2, fontWeight: 700 }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleTransfer}
                disabled={transferring || !transferEmail || transferConfirm !== "TRANSFER"}
                style={{
                  padding: "9px 16px", background: "#D97706", color: "#fff", border: "none",
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  opacity: (transferring || !transferEmail || transferConfirm !== "TRANSFER") ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {transferring && <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} />}
                Confirm transfer
              </button>
              <button className="stGhostBtn" onClick={() => { setShowTransferForm(false); setTransferEmail(""); setTransferConfirm("") }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </DangerCard>

      {/* Delete Workspace */}
      <DangerCard
        icon={<Trash2 size={18} />}
        title="Delete workspace"
        desc="Permanently delete this workspace and all its data including employees, time logs, leaves, payroll records, tasks, and reports. All team members will lose access immediately. This action is irreversible."
      >
        {!showDeleteWs ? (
          <button
            style={{ padding: "8px 16px", background: "#FEF2F2", border: "1.5px solid #DC2626", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#DC2626", cursor: "pointer" }}
            onClick={() => setShowDeleteWs(true)}
          >
            <Trash2 size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
            Delete workspace
          </button>
        ) : (
          <div style={{ padding: 20, background: "#FEF2F2", borderRadius: 10, border: "1px dashed rgba(220,38,38,.4)" }}>
            <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 700, marginBottom: 14 }}>
              This will permanently delete your workspace and all data. There is NO recovery option.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Type your workspace name to confirm deletion
              </div>
              <input
                className="stInput"
                placeholder={user?.company_name || "Workspace name"}
                value={workspaceName}
                onChange={e => setWorkspaceName(e.target.value)}
                style={{ borderColor: "rgba(220,38,38,.5)", maxWidth: 320 }}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Expected: <strong>{user?.company_name}</strong></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleDeleteWorkspace}
                disabled={deletingWs || !workspaceName}
                style={{
                  padding: "9px 16px", background: "#DC2626", color: "#fff", border: "none",
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  opacity: (deletingWs || !workspaceName) ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {deletingWs && <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} />}
                Delete permanently
              </button>
              <button className="stGhostBtn" onClick={() => { setShowDeleteWs(false); setWorkspaceName("") }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </DangerCard>
    </div>
  )
}
