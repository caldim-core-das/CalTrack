import { useState, useEffect, useRef } from "react"
import {
  Building2, Globe, MapPin, Upload, Save,
  Loader2, Image as ImageIcon, Check,
} from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"
import { Card, Button, Input, Select, TextArea } from "../../components/kit.jsx"

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Sao_Paulo", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Colombo",
  "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai",
  "Australia/Sydney", "Pacific/Auckland",
]

const DATA_REGIONS = [
  { value: "us-east", label: "United States (East)" },
  { value: "us-west", label: "United States (West)" },
  { value: "eu-central", label: "Europe (Frankfurt)" },
  { value: "ap-south", label: "Asia Pacific (Mumbai)" },
  { value: "ap-southeast", label: "Asia Pacific (Singapore)" },
]

const INDUSTRIES = [
  "Technology", "Healthcare", "Finance & Banking", "Retail & E-commerce",
  "Manufacturing", "Education", "Construction", "Transportation & Logistics",
  "Hospitality & Tourism", "Media & Entertainment", "Legal & Professional Services",
  "Government & Public Sector", "Non-profit", "Other",
]

export default function WorkspaceSection({ showToast, SectionHeader }) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"
  const logoRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name: "",
    slug: "",
    industry: "",
    website: "",
    timezone: "UTC",
    data_region: "us-east",
    address: "",
    country: "",
  })
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    apiRequest("/company/me")
      .then(res => {
        if (res) {
          setForm(prev => ({
            ...prev,
            company_name: res.company_name || "",
            slug: res.schema_name || "",
            timezone: res.timezone || "UTC",
            industry: res.industry || "",
            website: res.website || "",
            address: res.address || "",
            country: res.primary_country || "",
          }))
          if (res.logo_url) setLogoPreview(res.logo_url)
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const handleLogoFile = file => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast("Logo must be under 2 MB.", "error"); return }
    if (!file.type.startsWith("image/")) { showToast("Please select an image file.", "error"); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.company_name.trim()) { showToast("Organization name is required.", "error"); return }
    setSaving(true)
    try {
      const body = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) body.append(k, v) })
      if (logoFile) body.append("logo", logoFile)
      await apiRequest("/company/update", { method: "PUT", body })
      showToast("Workspace settings saved.")
      setLogoFile(null)
    } catch (err) {
      showToast(err?.body?.message || "Failed to save workspace settings.", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
      <Loader2 size={24} style={{ animation: "spin .7s linear infinite" }} />
    </div>
  )

  return (
    <div className="stPanel animate-fadeUp">
      <SectionHeader title="Workspace" subtitle="Manage your organization's identity, settings, and data preferences." />

      {!isAdmin && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl mb-8 flex gap-4 items-start text-sm text-amber-800 dark:text-amber-400">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">⚠</div>
          <p className="pt-1.5 font-medium">You are viewing workspace settings. Only administrators with proper authority can modify these parameters.</p>
        </div>
      )}

      {/* Organization Identity */}
      <Card 
        title={
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600" />
            <span>Organization Identity</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="Organization name" 
            value={form.company_name} 
            placeholder="Acme Corp" 
            disabled={!isAdmin} 
            onChange={e => handleChange("company_name", e.target.value)} 
          />
          <Input 
            label="URL slug" 
            value={form.slug} 
            placeholder="acme-corp" 
            disabled 
            hint="This is your unique workspace identifier."
            className="opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
          />
          <Select 
            label="Industry" 
            value={form.industry} 
            disabled={!isAdmin} 
            onChange={e => handleChange("industry", e.target.value)} 
            options={[
              { label: "Select industry", value: "" },
              ...INDUSTRIES.map(i => ({ label: i, value: i }))
            ]}
          />
          <Input 
            label="Website" 
            value={form.website} 
            placeholder="https://company.com" 
            disabled={!isAdmin} 
            onChange={e => handleChange("website", e.target.value)} 
            icon={<Globe size={14} className="text-slate-400" />}
          />
          <div className="col-span-full">
            <TextArea 
              label="Office address" 
              placeholder="123 Main St, City, State, ZIP" 
              value={form.address} 
              disabled={!isAdmin} 
              onChange={e => handleChange("address", e.target.value)} 
              rows={2} 
            />
          </div>
        </div>
      </Card>

      {/* Logo */}
      <Card 
        title={
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-indigo-600" />
            <span>Organization Logo</span>
          </div>
        }
      >
        <div className="stLogoGrid">
          <div
            className={`stDropZone ${logoPreview ? "has" : ""} ${dragOver ? "drag" : ""}`}
            onClick={() => isAdmin && logoRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (isAdmin) handleLogoFile(e.dataTransfer.files[0]) }}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="stDropPreview" />
            ) : (
              <>
                <Upload size={28} className="stDropIcon" />
                <div className="stDropText">Upload logo</div>
                <div className="stDropSub">PNG, SVG, or JPG · Max 2 MB</div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="p-6 bg-bg2 dark:bg-slate-950/40 rounded-2xl border border-stroke dark:border-slate-800/50 text-[12px] leading-relaxed">
              <div className="font-black text-slate-900 dark:text-white uppercase tracking-widest mb-3 text-[11px]">Logo guidelines</div>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400 font-medium">
                {["Minimum 200 × 200 px", "Transparent background preferred", "PNG or SVG for best quality", "Maximum 2 MB file size"].map(g => (
                  <li key={g} className="flex items-center gap-3">
                    <Check size={12} className="text-emerald-600 dark:text-emerald-500 shrink-0" /> {g}
                  </li>
                ))}
              </ul>
            </div>
            {isAdmin && (
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => logoRef.current?.click()} className="text-xs py-2">
                  <Upload size={14} className="mr-2" /> Choose file
                </Button>
                {logoPreview && (
                  <Button variant="danger" onClick={() => { setLogoPreview(null); setLogoFile(null) }} className="text-xs py-2">
                    Remove
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleLogoFile(e.target.files?.[0])} />
      </Card>

      {/* Regional Settings */}
      <Card 
        title={
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-indigo-600" />
            <span>Regional Settings</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select 
            label="Default timezone" 
            value={form.timezone} 
            disabled={!isAdmin} 
            onChange={e => handleChange("timezone", e.target.value)} 
            options={TIMEZONES.map(tz => ({ label: tz.replace(/_/g, " "), value: tz }))}
          />
          <Select 
            label="Data region" 
            value={form.data_region} 
            disabled={!isAdmin} 
            onChange={e => handleChange("data_region", e.target.value)} 
            options={DATA_REGIONS}
          />
        </div>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-400 font-medium">
          ⓘ Data region determines where your organization data is stored. Changing this requires a data migration and cannot be done self-serve.
        </div>
      </Card>

      {isAdmin && (
        <div className="flex justify-end pt-6 border-t border-stroke dark:border-slate-800">
          <Button onClick={handleSave} disabled={saving} className="min-w-[200px] py-4 rounded-xl text-base shadow-lg shadow-indigo-500/10">
            {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            {saving ? "Saving..." : "Save Workspace Changes"}
          </Button>
        </div>
      )}
    </div>
  )
}
