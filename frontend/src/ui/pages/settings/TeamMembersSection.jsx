import { useState, useEffect } from "react"
import {
  Users, UserPlus, Mail, Shield, Trash2, ChevronDown,
  Clock, Check, X, Loader2, Search,
} from "lucide-react"
import { apiRequest, unwrapResults } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"
import { Card, Button, Input, Select, Pill } from "../../components/kit.jsx"

const ROLE_CONFIG = {
  admin: { label: "Admin", tone: "neutral" },
  manager: { label: "Manager", tone: "neutral" },
  employee: { label: "Employee", tone: "neutral" },
  kiosk: { label: "Kiosk", tone: "neutral" },
}

function RoleMenu({ value, onChange, exclude = [] }) {
  const [open, setOpen] = useState(false)
  const options = Object.entries(ROLE_CONFIG).filter(([k]) => !exclude.includes(k))
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-stroke dark:border-slate-800 hover:border-indigo-500/30 transition-all group"
      >
        <Pill tone="neutral">{ROLE_CONFIG[value]?.label || value}</Pill>
        <ChevronDown size={12} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 w-40 bg-surface dark:bg-slate-900 border border-stroke dark:border-slate-800 rounded-[20px] p-2 shadow-2xl animate-fadeUp">
          {options.map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false) }}
              className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${key === value
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              {cfg.label}
              {key === value && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TeamMembersSection({ showToast, SectionHeader }) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"

  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [inviteForm, setInviteForm] = useState({ email: "", role: "employee" })
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [changingRole, setChangingRole] = useState(null)
  const [revoking, setRevoking] = useState(null)
  const [showInviteForm, setShowInviteForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [membersRes, invitesRes] = await Promise.all([
        apiRequest("/settings/team/members/"),
        isAdmin ? apiRequest("/settings/team/invites/") : Promise.resolve({ data: [] }),
      ])
      setMembers(unwrapResults(membersRes))
      setInvites(unwrapResults(invitesRes))
    } catch {
      showToast("Failed to load team.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleInvite = async () => {
    if (!inviteForm.email) { showToast("Email is required.", "error"); return }
    setInviting(true)
    try {
      const res = await apiRequest("/settings/team/invites/", { method: "POST", json: inviteForm })
      showToast(res?.message || "Invite sent.")
      setInvites(prev => [res.data || res, ...prev])
      setInviteForm({ email: "", role: "employee" })
      setShowInviteForm(false)
    } catch (err) {
      showToast(err?.body?.message || "Failed to send invite.", "error")
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (memberId, newRole) => {
    setChangingRole(memberId)
    try {
      await apiRequest(`/settings/team/members/${memberId}/`, { method: "PATCH", json: { role: newRole } })
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
      showToast("Role updated.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to update role.", "error")
    } finally {
      setChangingRole(null)
    }
  }

  const handleRemove = async (memberId) => {
    if (!confirm("Remove this member from the workspace? They will lose all access.")) return
    setRemoving(memberId)
    try {
      await apiRequest(`/settings/team/members/${memberId}/`, { method: "DELETE" })
      setMembers(prev => prev.filter(m => m.id !== memberId))
      showToast("Member removed.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to remove member.", "error")
    } finally {
      setRemoving(null)
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    setRevoking(inviteId)
    try {
      await apiRequest(`/settings/team/invites/${inviteId}/`, { method: "DELETE" })
      setInvites(prev => prev.filter(i => i.id !== inviteId))
      showToast("Invite cancelled.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to cancel invite.", "error")
    } finally {
      setRevoking(null)
    }
  }

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchesSearch = !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
    const matchesRole = !roleFilter || m.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="stPanel animate-fadeUp">
      <SectionHeader title="Team & Members" subtitle="Invite teammates, assign roles, and manage workspace access." />

      <Card>
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div className="flex-1">
            <Input
              variant="dark"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              options={[
                { label: "All Roles", value: "" },
                ...Object.entries(ROLE_CONFIG).map(([k, v]) => ({ label: v.label, value: k }))
              ]}
            />
          </div>
          {isAdmin && (
            <Button onClick={() => setShowInviteForm(v => !v)} className="h-[50px] px-6">
              <UserPlus size={16} className="mr-2" /> Invite Member
            </Button>
          )}
        </div>

        {showInviteForm && isAdmin && (
          <div className="mt-8 p-8 bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-dashed border-stroke dark:border-slate-800 animate-fadeUp">
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Send Invitation</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
              <div className="lg:col-span-1">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                  icon={<Mail size={16} />}
                />
              </div>
              <div className="lg:col-span-1">
                <Select
                  label="Select Role"
                  value={inviteForm.role}
                  onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                  options={[
                    { label: "Employee", value: "employee" },
                    { label: "Manager", value: "manager" },
                    { label: "Admin", value: "admin" }
                  ]}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleInvite} disabled={inviting || !inviteForm.email} className="flex-1 h-[52px]">
                  {inviting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} className="mr-2" />}
                  Send Invite
                </Button>
                <Button variant="ghost" onClick={() => setShowInviteForm(false)} className="h-[52px] px-6">Cancel</Button>
              </div>
            </div>
            {user?.company_country && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>ℹ️</span> This employee will join under your company's region: 
                <strong style={{ color: "var(--fg)" }}>{user.company_country === "UK" ? "🇬🇧 United Kingdom" : "🇺🇸 United States"}</strong>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title={
        <div className="flex items-center gap-3">
          <span>Active Members</span>
          <Pill tone="neutral">{filtered.length}</Pill>
        </div>
      }>
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Users size={40} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
            <p className="text-slate-400 font-medium italic">
              {search || roleFilter ? "No members match your criteria." : "No team members found."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stroke dark:divide-slate-800/60 -mx-6 -mb-6">
            {filtered.map(member => (
              <div key={member.id} className="flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white text-base font-black flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    {(String(member.name || member.username || "U")[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      {typeof member.name === 'object' ? member.name?.name || member.name?.username : (member.name || member.username)}
                      {member.is_current_user && <Pill tone="neutral">You</Pill>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      {typeof member.email === 'object' ? member.email?.email : member.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="hidden lg:flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <Clock size={12} />
                    Joined {new Date(member.date_joined).toLocaleDateString()}
                  </div>

                  {isAdmin && !member.is_current_user ? (
                    <RoleMenu
                      value={member.role}
                      onChange={role => handleRoleChange(member.id, role)}
                      exclude={["kiosk"]}
                    />
                  ) : (
                    <Pill tone="neutral">{ROLE_CONFIG[member.role]?.label || member.role}</Pill>
                  )}

                  {isAdmin && !member.is_current_user && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={removing === member.id}
                      className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {removing === member.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isAdmin && invites.length > 0 && (
        <Card title={
          <div className="flex items-center gap-3">
            <Mail size={18} className="text-amber-500" />
            <span>Pending Invitations</span>
            <Pill tone="warn">{invites.length}</Pill>
          </div>
        }>
          <div className="divide-y divide-stroke dark:divide-slate-800/60 -mx-6 -mb-6">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {typeof invite.email === 'object' ? invite.email?.email : invite.email}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                      Invited by {invite.invited_by_name} · Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Pill tone={invite.is_expired ? "bad" : "warn"}>
                    {invite.is_expired ? "Expired" : "Pending"}
                  </Pill>
                  <Button
                    variant="ghost"
                    onClick={() => handleRevokeInvite(invite.id)}
                    disabled={revoking === invite.id}
                    className="h-9 px-4 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    {revoking === invite.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} className="mr-2" />}
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
