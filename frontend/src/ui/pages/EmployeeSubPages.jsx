import { useEffect, useState } from "react"
import { apiRequest, unwrapResults } from "../../api/client.js"
import { apiFetchRegistrationDossier } from "../../api/authService.js"
import { Card, Pill, Button } from "../components/kit.jsx"
import { Users, FileText, CheckCircle2, XCircle, FolderOpen, Award, TrendingUp, ShieldCheck } from "lucide-react"

// helper format
const formatEmployeeId = (value) => {
  if (!value) return ""
  const s = String(value).trim()
  const m = /^EMP(\d+)$/i.exec(s.replace(/\s+/g, ""))
  if (m) return `EMP ${m[1].padStart(3, "0")}`
  return s
}

// 1. Employees Dashboard Page
export function EmployeesDashboardPage() {
  const [metrics, setMetrics] = useState({ pending: 1, approved: 245, rejected: 18 })
  
  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          const status = parsed.adminClearance?.status
          if (status === "pending") {
            setMetrics({ pending: 1, approved: 245, rejected: 18 })
          } else if (status === "approved") {
            setMetrics({ pending: 0, approved: 246, rejected: 18 })
          } else if (status === "rejected") {
            setMetrics({ pending: 0, approved: 245, rejected: 19 })
          }
        } catch (e) {}
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg overflow-y-auto p-10 space-y-8">
      <div>
        <h1 className="text-2xl professional-title text-slate-900 dark:text-white flex items-center gap-3">
          <TrendingUp className="text-indigo-600 dark:text-indigo-500" size={24} />
          Workforce Dashboard
        </h1>
        <p className="text-[10px] professional-subtitle text-slate-500 dark:text-slate-500 uppercase tracking-widest mt-1">
          Overview of employee directory statistics, onboarding states, and training progression.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="!mb-0" title="Pending Verification">
          <div className="flex justify-between items-center">
            <span className="text-4xl font-black text-amber-500">{metrics.pending}</span>
            <FileText size={32} className="text-amber-550/20" />
          </div>
          <div className="text-[9px] font-black uppercase text-slate-400 mt-2">Dossiers awaiting admin review</div>
        </Card>
        <Card className="!mb-0" title="Approved Roster">
          <div className="flex justify-between items-center">
            <span className="text-4xl font-black text-emerald-500">{metrics.approved}</span>
            <CheckCircle2 size={32} className="text-emerald-550/20" />
          </div>
          <div className="text-[9px] font-black uppercase text-slate-400 mt-2">Activated employee passes</div>
        </Card>
        <Card className="!mb-0" title="Rejected Registrations">
          <div className="flex justify-between items-center">
            <span className="text-4xl font-black text-rose-500">{metrics.rejected}</span>
            <XCircle size={32} className="text-rose-550/20" />
          </div>
          <div className="text-[9px] font-black uppercase text-slate-400 mt-2">Applications flagged with anomalies</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Roster Compliance Status">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-bg/50 dark:bg-slate-900/30 rounded-xl border border-stroke dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" /> Biometric face meshes mapped
              </span>
              <Pill tone="good">100% Secure</Pill>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-bg/50 dark:bg-slate-900/30 rounded-xl border border-stroke dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" /> OCR Document Verification
              </span>
              <Pill tone="good">99.8% Match</Pill>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-bg/50 dark:bg-slate-900/30 rounded-xl border border-stroke dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" /> WebRTC Audio Verification
              </span>
              <Pill tone="good">100% Passed</Pill>
            </div>
          </div>
        </Card>

        <Card title="Recent Activity Logs">
          <div className="space-y-3.5 font-mono text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
            <div>[09:12] Roster registration completed for Surya</div>
            <div>[09:20] Identity verification documents uploaded</div>
            <div>[09:25] AI Document OCR matching integrity checklist passed</div>
            <div>[09:40] Live face vector mapping verification verified</div>
            <div>[10:15] Compliance Training Academy quizzes passed</div>
            <div>[11:05] WebRTC L1 call logs auditing complete</div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// 2. Approved Employees Page
export function ApprovedEmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest("/employees/")
        const data = Array.isArray(res) ? res : res.results || []
        setEmployees(data.filter(e => e.is_active))
      } catch (err) {
        console.error("Failed to load approved employees", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg overflow-y-auto p-10 space-y-8">
      <div>
        <h1 className="text-2xl professional-title text-slate-900 dark:text-white flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-500" size={24} />
          Approved Employees
        </h1>
        <p className="text-[10px] professional-subtitle text-slate-500 dark:text-slate-500 uppercase tracking-widest mt-1">
          Active roster showing all employees who passed verification.
        </p>
      </div>

      <Card title="Active Team Roster">
        {loading ? (
          <div className="text-slate-400 italic">Loading approved members...</div>
        ) : employees.length ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4">ID</th>
                  <th className="py-4">Full Name</th>
                  <th className="py-4">Title</th>
                  <th className="py-4">Country</th>
                  <th className="py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke/50 dark:divide-slate-800/50">
                {employees.map(e => (
                  <tr key={e.id} className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                    <td className="py-4 font-mono text-xs">{formatEmployeeId(e.employee_id || e.id)}</td>
                    <td className="py-4">{e.user?.first_name ? `${e.user.first_name} ${e.user.last_name}` : e.name}</td>
                    <td className="py-4 text-xs text-slate-500">{e.title || "Field Technician"}</td>
                    <td className="py-4 font-mono text-xs">{e.country || "US"}</td>
                    <td className="py-4">
                      <Pill tone="good">Active</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-sm">
            No approved employees found
          </div>
        )}
      </Card>
    </div>
  )
}

// 3. Rejected Employees Page
export function RejectedEmployeesPage() {
  const [rejected, setRejected] = useState([])

  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          if (parsed.adminClearance?.status === "rejected") {
            setRejected([
              {
                id: "EMP-2048",
                name: parsed.regForm.fullName,
                email: parsed.regForm.email,
                reason: parsed.adminClearance.remarks || "Aadhaar validation mismatch.",
                rejectedOn: parsed.adminClearance.rejectedOn || "02 Jun 2026",
              }
            ])
            return
          }
        } catch (e) {}
      }

      // Static fallback list if no active rejection simulation is running
      setRejected([
        { id: "EMP-1082", name: "Kunal Sharma", email: "kunal@caltrack.com", reason: "Blurred Aadhaar document scan", rejectedOn: "31 May 2026" },
        { id: "EMP-0925", name: "Riya Verma", email: "riya@caltrack.com", reason: "Face verification mesh match score below 90%", rejectedOn: "28 May 2026" },
      ])
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg overflow-y-auto p-10 space-y-8">
      <div>
        <h1 className="text-2xl professional-title text-slate-900 dark:text-white flex items-center gap-3">
          <XCircle className="text-rose-600 dark:text-rose-500" size={24} />
          Rejected Registrations
        </h1>
        <p className="text-[10px] professional-subtitle text-slate-500 dark:text-slate-500 uppercase tracking-widest mt-1">
          Dossiers flagged with compliance anomalies during the verification workflow.
        </p>
      </div>

      <Card title="Anomaly Logs">
        {rejected.length ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4">ID</th>
                  <th className="py-4">Full Name</th>
                  <th className="py-4">Email</th>
                  <th className="py-4">Anomaly Reason</th>
                  <th className="py-4">Rejected On</th>
                  <th className="py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke/50 dark:divide-slate-800/50">
                {rejected.map(e => (
                  <tr key={e.id} className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                    <td className="py-4 font-mono text-xs">{e.id}</td>
                    <td className="py-4">{e.name}</td>
                    <td className="py-4 font-mono text-xs text-slate-500">{e.email}</td>
                    <td className="py-4 text-xs text-rose-600 dark:text-rose-400 max-w-xs truncate" title={e.reason}>{e.reason}</td>
                    <td className="py-4 font-mono text-xs">{e.rejectedOn}</td>
                    <td className="py-4">
                      <Pill tone="bad">Rejected</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-sm">
            No rejected applications logged
          </div>
        )}
      </Card>
    </div>
  )
}

// 4. Document Vault Page
export function DocumentVaultPage() {
  const [vault, setVault] = useState([
    { name: "Surya Prakash", type: "Aadhaar Card", file: "aadhaar_surya_scan.pdf", check: "OCR Approved (99%)" },
    { name: "Surya Prakash", type: "PAN Card", file: "pan_surya_scan.pdf", check: "OCR Approved (98%)" },
    { name: "Surya Prakash", type: "Bank Passbook", file: "bank_passbook_surya.pdf", check: "Checksum Passed" },
    { name: "Kunal Sharma", type: "Aadhaar Card", file: "aadhaar_kunal_scan.pdf", check: "OCR Failed (Blurred)" },
  ])

  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          if (parsed.regForm && parsed.docForm) {
            const fresh = [
              { name: parsed.regForm.fullName, type: "Aadhaar Card", file: parsed.docForm.aadhaarFile || "aadhaar_scan.pdf", check: "OCR Approved (99%)" },
              { name: parsed.regForm.fullName, type: "PAN Card", file: parsed.docForm.panFile || "pan_scan.pdf", check: "OCR Approved (98%)" },
              { name: parsed.regForm.fullName, type: "Bank Passbook", file: parsed.docForm.bankPassbookFile || "passbook.pdf", check: "Checksum Passed" },
            ]
            setVault(fresh)
          }
        } catch (e) {}
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg overflow-y-auto p-10 space-y-8">
      <div>
        <h1 className="text-2xl professional-title text-slate-900 dark:text-white flex items-center gap-3">
          <FolderOpen className="text-blue-600 dark:text-blue-500" size={24} />
          Document Vault
        </h1>
        <p className="text-[10px] professional-subtitle text-slate-500 dark:text-slate-500 uppercase tracking-widest mt-1">
          Secure storage repo for OCR and selfie biometric files.
        </p>
      </div>

      <Card title="Document Ledger">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4">Employee</th>
                <th className="py-4">Document Type</th>
                <th className="py-4">Filename</th>
                <th className="py-4">AI Verification Check</th>
                <th className="py-4">Security</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke/50 dark:divide-slate-800/50">
              {vault.map((d, idx) => (
                <tr key={idx} className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                  <td className="py-4">{d.name}</td>
                  <td className="py-4 text-xs font-bold text-slate-500">{d.type}</td>
                  <td className="py-4 font-mono text-xs text-blue-500">{d.file}</td>
                  <td className="py-4 text-xs">{d.check}</td>
                  <td className="py-4">
                    <Pill tone="good">Encrypted</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// 5. Training Records Page
export function TrainingRecordsPage() {
  const [records, setRecords] = useState([
    { name: "Surya Prakash", status: "Completed", completion: "100%", quiz: "92%", statusText: "PASSED" },
    { name: "Kunal Sharma", status: "Incomplete", completion: "40%", quiz: "—", statusText: "PENDING" },
  ])

  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          if (parsed.regForm && parsed.academyState) {
            const fresh = [
              {
                name: parsed.regForm.fullName,
                status: parsed.academyState.isCompleted ? "Completed" : "In Progress",
                completion: parsed.academyState.isCompleted ? "100%" : "60%",
                quiz: parsed.academyState.isCompleted ? "92%" : "—",
                statusText: parsed.academyState.isCompleted ? "PASSED" : "PENDING"
              }
            ]
            setRecords(fresh)
          }
        } catch (e) {}
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg overflow-y-auto p-10 space-y-8">
      <div>
        <h1 className="text-2xl professional-title text-slate-900 dark:text-white flex items-center gap-3">
          <Award className="text-purple-600 dark:text-purple-500" size={24} />
          Training Academy Records
        </h1>
        <p className="text-[10px] professional-subtitle text-slate-500 dark:text-slate-500 uppercase tracking-widest mt-1">
          Compliance streaming watch history and safety certification scores.
        </p>
      </div>

      <Card title="Academy Ledger">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4">Technician</th>
                <th className="py-4">Academy Status</th>
                <th className="py-4">Videos Watched</th>
                <th className="py-4">Challenge Score</th>
                <th className="py-4">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke/50 dark:divide-slate-800/50">
              {records.map((r, idx) => (
                <tr key={idx} className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                  <td className="py-4">{r.name}</td>
                  <td className="py-4 text-xs font-bold text-slate-500">{r.status}</td>
                  <td className="py-4 font-mono text-xs">{r.completion}</td>
                  <td className="py-4 font-mono text-xs">{r.quiz}</td>
                  <td className="py-4">
                    <Pill tone={r.statusText === "PASSED" ? "good" : "warn"}>{r.statusText}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
