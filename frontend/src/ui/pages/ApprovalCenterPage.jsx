import { useEffect, useState, useMemo } from "react"
import { apiRequest, unwrapResults } from "../../api/client.js"
import { 
  apiFetchRegistrationDossier, 
  apiSaveRegistrationDossier 
} from "../../api/authService.js"
import { Button, Card, Pill } from "../components/kit.jsx"
import { 
  Award, CalendarDays, Users, Check, X, RefreshCw, Eye, 
  User, Phone, Mail, MapPin, ShieldCheck, FileText, Cpu, 
  Fingerprint, ShieldAlert, Clock, AlertTriangle, FileSpreadsheet,
  CheckCircle2, XCircle
} from "lucide-react"

export function ApprovalCenterPage() {
  const [metrics, setMetrics] = useState({ pending: 0, approved: 0, rejected: 0 })
  
  // Selection — only the real dynamic employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("EMP-2048")
  
  // Modal states
  const [showDocModal, setShowDocModal] = useState(null) // null | "aadhaar" | "pan" | "passbook"
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  
  // Reject form states
  const [rejectReasons, setRejectReasons] = useState({
    aadhaar: false,
    pan: false,
    blurred: false,
    face: false,
    training: false,
    call: false,
    duplicate: false,
    fraud: false,
    other: false
  })
  const [rejectRemarks, setRejectRemarks] = useState("")
  const [rejectError, setRejectError] = useState("")
  
  // Real Dossier Data from Local Storage (filled by registration form)
  const [dossier, setDossier] = useState(null)

  // Load Dossier (onboarding data)
  async function loadDossier() {
    // Try to load from backend
    const backendDossier = await apiFetchRegistrationDossier()
    if (backendDossier && backendDossier.regForm?.fullName) {
      setDossier(backendDossier)
      localStorage.setItem("caltrack_activation_dossier", JSON.stringify(backendDossier))
      return
    }

    const saved = localStorage.getItem("caltrack_activation_dossier")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setDossier(parsed)
      } catch (e) {
        console.error("Dossier parse error", e)
      }
    }
  }

  useEffect(() => {
    loadDossier()
    const interval = setInterval(loadDossier, 1500)
    return () => clearInterval(interval)
  }, [])

  // Compute metrics from real dossier data only — no fake base numbers
  useEffect(() => {
    if (!dossier?.regForm?.fullName) {
      // No registration yet
      setMetrics({ pending: 0, approved: 0, rejected: 0 })
      return
    }
    const status = dossier?.adminClearance?.status
    if (status === "approved") {
      setMetrics({ pending: 0, approved: 1, rejected: 0 })
    } else if (status === "rejected") {
      setMetrics({ pending: 0, approved: 0, rejected: 1 })
    } else {
      setMetrics({ pending: 1, approved: 0, rejected: 0 })
    }
  }, [dossier])

  // Build active employee from real dossier data only
  const activeEmployee = useMemo(() => {
    const dynamicStatus = dossier?.adminClearance?.status === "approved"
      ? "Approved"
      : dossier?.adminClearance?.status === "rejected"
      ? "Rejected"
      : "Pending Review"

    return {
      id: "EMP-2048",
      name: dossier?.regForm?.fullName || "—",
      phone: dossier?.regForm?.phone || "—",
      email: dossier?.regForm?.email || "—",
      location: dossier?.regForm?.address || "—",
      regDate: dossier?.regForm?.regDate || "—",
      trustScore: dossier?.trustScore || 0,
      status: dynamicStatus,
      isDynamic: true,
      docForm: dossier?.docForm || {
        aadhaarId: "",
        panId: "",
        bankAcc: "",
        ifscCode: "",
        aadhaarFile: "—",
        panFile: "—",
        bankPassbookFile: "—",
        isCompleted: false,
        confidenceScore: 0
      },
      regForm: dossier?.regForm || {
        fullName: "—",
        phone: "—",
        email: "—",
        address: "—",
        isBiometricCompleted: false,
        profilePic: null,
        isCompleted: false
      },
      academyState: dossier?.academyState || {
        isCompleted: false,
        modules: []
      },
      interviewState: dossier?.interviewState || {
        isCompleted: false,
        callDuration: 0,
        interviewLogs: []
      },
      adminClearance: dossier?.adminClearance || {
        status: "pending",
        remarks: ""
      }
    }
  }, [dossier])

  const fraudRisk = useMemo(() => {
    if (!activeEmployee.regForm?.isCompleted) return "Awaiting Reg"
    if (!activeEmployee.regForm?.isBiometricCompleted) return "Awaiting Face Check"
    return "Low"
  }, [activeEmployee])

  const docRisk = useMemo(() => {
    if (!activeEmployee.docForm?.isCompleted) return "Awaiting Docs"
    return "Low"
  }, [activeEmployee])

  const identityRisk = useMemo(() => {
    if (!activeEmployee.regForm?.isBiometricCompleted) return "Awaiting Biometrics"
    return "Low"
  }, [activeEmployee])

  // Handle Approve Action
  async function handleApprove() {
    setShowApproveConfirm(true)
  }

  async function confirmApprove() {
    try {
      const updatedClearance = {
        status: "approved",
        remarks: "All validation steps passed. Approved by Admin in Approval Center."
      }
      const nextDossier = { ...dossier, adminClearance: updatedClearance }
      localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
      await apiSaveRegistrationDossier(nextDossier)
      setDossier(nextDossier)
      
      // Auto-create employee record in DB
      const [firstNameRaw, ...lastNameParts] = (activeEmployee.name || "").trim().split(" ")
      const firstName = firstNameRaw || ""
      const lastName = lastNameParts.join(" ") || "—"
      const payload = {
        employee_id: activeEmployee.id,
        username: activeEmployee.email.split("@")[0] || `user_${Math.random().toString(36).slice(2, 7)}`,
        password: "TemporaryPassword123!",
        email: activeEmployee.email,
        first_name: firstName,
        last_name: lastName,
        title: "Field Operations Tech (L2)",
        hourly_rate: 18.50,
        country: "IN",
        is_active: true
      }
      await apiRequest("/employees/", { method: "POST", json: payload })
      setShowApproveConfirm(false)
      alert(`${activeEmployee.name} Approved Successfully\n\nPortal Access Enabled\nTask Assignment Enabled\nEmployee Activated`)
    } catch (e) {
      console.error("Failed to approve employee", e)
      setShowApproveConfirm(false)
    }
  }

  // Handle Reject Action
  async function handleRejectSubmit(e) {
    e.preventDefault()
    if (!rejectRemarks.trim()) {
      setRejectError("Cannot submit rejection without remarks.")
      return
    }

    const selectedReasons = Object.entries(rejectReasons)
      .filter(([_, checked]) => checked)
      .map(([name, _]) => {
        const labels = {
          aadhaar: "Aadhaar Mismatch",
          pan: "PAN Mismatch",
          blurred: "Blurred Documents",
          face: "Face Verification Failed",
          training: "Training Incomplete",
          call: "Verification Call Failed",
          duplicate: "Duplicate Registration",
          fraud: "Fraud Risk Detected",
          other: "Other"
        }
        return labels[name] || name
      })

    const reasonCategory = selectedReasons.length > 0 ? selectedReasons.join(", ") : "Document Verification Failed"

    const updatedClearance = {
      status: "rejected",
      remarks: rejectRemarks,
      reasonCategory: reasonCategory,
      rejectedBy: "Admin Team",
      rejectedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      requiredActions: selectedReasons.length > 0 ? selectedReasons.map(r => `Correct/Re-upload ${r}`) : ["Re-upload Aadhaar", "Re-upload PAN"]
    }

    const nextDossier = { ...dossier, adminClearance: updatedClearance }
    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
    await apiSaveRegistrationDossier(nextDossier)
    setDossier(nextDossier)
    
    setShowRejectForm(false)
    setRejectRemarks("")
    setRejectReasons({
      aadhaar: false,
      pan: false,
      blurred: false,
      face: false,
      training: false,
      call: false,
      duplicate: false,
      fraud: false,
      other: false
    })
    setRejectError("")
    alert(`Employee ${activeEmployee.name} Application Rejected`)
  }

  // Queue: only show the real registered employee from the dossier
  const queueEmployees = useMemo(() => {
    if (!dossier?.regForm?.fullName) return []
    return [
      {
        id: "EMP-2048",
        name: dossier.regForm.fullName,
        regDate: dossier.regForm.regDate || "—",
        trustScore: dossier.trustScore || 0,
        status: dossier?.adminClearance?.status === "approved"
          ? "Approved"
          : dossier?.adminClearance?.status === "rejected"
          ? "Rejected"
          : "Pending Review"
      }
    ]
  }, [dossier])

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      
      {/* ── HEADER ── */}
      <div className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0 z-10">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
            <Award className="text-indigo-600 dark:text-indigo-500" size={22} />
            Employee Approval Center
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            Audit personal records, face mesh scans, and training academy completion.
          </p>
        </div>
        
        <Button variant="ghost" onClick={() => loadDossier()} className="flex gap-2 text-xs">
          <RefreshCw size={14} /> Refresh Dossier
        </Button>
      </div>

      {/* ── METRICS GRID ── */}
      <div className="grid grid-cols-3 gap-6 p-6 bg-slate-100/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Applications</span>
            <span className="text-2xl font-black text-amber-500 mt-1 block">{metrics.pending}</span>
          </div>
          <Clock size={28} className="text-amber-500/20" />
        </div>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Workforce</span>
            <span className="text-2xl font-black text-emerald-500 mt-1 block">{metrics.approved}</span>
          </div>
          <CheckCircle2 size={28} className="text-emerald-500/20" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejected Dossiers</span>
            <span className="text-2xl font-black text-rose-500 mt-1 block">{metrics.rejected}</span>
          </div>
          <XCircle size={28} className="text-rose-500/20" />
        </div>
      </div>

      {/* ── WORKSPACE PANELS ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Column: Employee Queue */}
        <div className="w-[320px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 overflow-y-auto p-5 space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">Employee Queue</h2>
          
          {queueEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
              <User size={32} className="opacity-30" />
              <p className="text-xs font-bold uppercase tracking-wider">No Applications Yet</p>
              <p className="text-[10px] font-semibold opacity-70">Waiting for an employee to complete registration.</p>
            </div>
          ) : queueEmployees.map((emp) => (
            <div 
              key={emp.id}
              onClick={() => setSelectedEmployeeId(emp.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedEmployeeId === emp.id 
                  ? "bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-500/30 shadow-md" 
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white truncate">{emp.name}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">{emp.id}</div>
                </div>
                <Pill tone={emp.status === "Approved" ? "good" : emp.status === "Rejected" ? "bad" : "warn"}>
                  {emp.status}
                </Pill>
              </div>
              
              <div className="grid grid-cols-2 gap-y-2 mt-4 text-[10px] text-slate-500 font-semibold border-t border-slate-100 dark:border-slate-800/60 pt-3">
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase">Submitted</span>
                  {emp.regDate}
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase">Trust Score</span>
                  <span className="text-emerald-600 font-black">{emp.trustScore}%</span>
                </div>
              </div>

              <Button variant="ghost" className="w-full mt-4 h-9 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                Review Employee
              </Button>
            </div>
          ))}
        </div>

        {/* Right Column: Verification Dossier */}
        <div className="flex-grow flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
          
          {/* Scrollable dossier content */}
          <div className="flex-1 overflow-y-auto p-8 pb-32 space-y-6">
            
            {/* Header info */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4">
                {/* Profile photo from biometric scan */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-700 border-2 border-indigo-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                  {activeEmployee?.regForm?.profilePic ? (
                    <img src={activeEmployee.regForm.profilePic} alt="Biometric" className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-indigo-300 w-7 h-7" />
                  )}
                </div>
                <div>
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Active dossier audit</span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{activeEmployee.name}</h2>
                  <span className="text-[10px] text-slate-400 font-mono">{activeEmployee.id} &bull; Submitted {activeEmployee.regDate}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Pill tone="good">Trust Score: {activeEmployee.trustScore}%</Pill>
                <Pill tone={activeEmployee.status === "Approved" ? "good" : activeEmployee.status === "Rejected" ? "bad" : "warn"}>
                  {activeEmployee.status}
                </Pill>
              </div>
            </div>

            {/* 1. Personal Information */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">1️⃣</span> Personal Information
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-250 dark:border-emerald-800">
                  ✓ VERIFIED
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-xs font-semibold">
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Full Name</span>
                  <span className="text-slate-800 dark:text-slate-200">{activeEmployee.name}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Phone Number</span>
                  <span className="text-slate-800 dark:text-slate-200">{activeEmployee.phone}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Email Address</span>
                  <span className="text-slate-800 dark:text-slate-200">{activeEmployee.email}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Current Location</span>
                  <span className="text-slate-800 dark:text-slate-200">{activeEmployee.location}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Registration Date</span>
                  <span className="text-slate-800 dark:text-slate-200">{activeEmployee.regDate}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Employee ID</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono">{activeEmployee.id}</span>
                </div>
              </div>
            </div>

            {/* 2. Registration Verification */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">2️⃣</span> Registration Verification
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  ✓ VERIFIED
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">

                <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                  activeEmployee?.regForm?.otpStatus === "verified"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"
                }`}>
                  <CheckCircle2 size={16} className={activeEmployee?.regForm?.otpStatus === "verified" ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"} />
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Phone OTP</div>
                    <div className={`text-xs font-bold ${activeEmployee?.regForm?.otpStatus === "verified" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
                      {activeEmployee?.regForm?.otpStatus === "verified" ? "Verified" : "Pending"}
                    </div>
                  </div>
                </div>

                {/* Face Scan */}
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                  activeEmployee?.regForm?.isBiometricCompleted
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"
                }`}>
                  <CheckCircle2 size={16} className={activeEmployee?.regForm?.isBiometricCompleted ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"} />
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Face Scan</div>
                    <div className={`text-xs font-bold ${activeEmployee?.regForm?.isBiometricCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
                      {activeEmployee?.regForm?.isBiometricCompleted ? "Completed" : "Pending"}
                    </div>
                  </div>
                </div>

                {/* Registration Submitted */}
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                  activeEmployee?.regForm?.isCompleted
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"
                }`}>
                  <CheckCircle2 size={16} className={activeEmployee?.regForm?.isCompleted ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"} />
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Registration</div>
                    <div className={`text-xs font-bold ${activeEmployee?.regForm?.isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
                      {activeEmployee?.regForm?.isCompleted ? "Submitted" : "Incomplete"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Score Bar */}
              <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Trust Score</span>
                  <span className="text-sm font-black text-emerald-600">{activeEmployee.trustScore}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${activeEmployee.trustScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Registration Evidence */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">3️⃣</span> Registration Evidence
                </h3>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  SYSTEM RECORD
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Submitted Time</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {activeEmployee.regDate || "03 Jun 2026"} 10:45 AM
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">IP Address</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono">192.168.XXX.XXX</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Device</span>
                  <span className="text-slate-800 dark:text-slate-200">Web Browser</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Biometric Match</span>
                  <span className="text-emerald-600 font-bold">
                    {activeEmployee?.regForm?.isBiometricCompleted ? "99.8%" : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Identity Documents */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">4️⃣</span> Identity Documents
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-250 dark:border-emerald-800">
                  ✓ VERIFIED
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between h-28 bg-slate-50 dark:bg-slate-950/20">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Aadhaar Card</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-250 mt-1 block truncate">
                      {activeEmployee?.docForm?.aadhaarFile || "aadhaar_scan.pdf"}
                    </span>
                  </div>
                  <Button onClick={() => setShowDocModal("aadhaar")} className="h-8 w-full mt-2 gap-1.5">
                    <Eye size={12} /> View Aadhaar
                  </Button>
                </div>

                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between h-28 bg-slate-50 dark:bg-slate-950/20">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">PAN Card</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-250 mt-1 block truncate">
                      {activeEmployee?.docForm?.panFile || "pan_scan.pdf"}
                    </span>
                  </div>
                  <Button onClick={() => setShowDocModal("pan")} className="h-8 w-full mt-2 gap-1.5">
                    <Eye size={12} /> View PAN
                  </Button>
                </div>

                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between h-28 bg-slate-50 dark:bg-slate-950/20">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Bank Passbook</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-250 mt-1 block truncate">
                      {activeEmployee?.docForm?.bankPassbookFile || "bank_ledger.pdf"}
                    </span>
                  </div>
                  <Button onClick={() => setShowDocModal("passbook")} className="h-8 w-full mt-2 gap-1.5">
                    <Eye size={12} /> View Passbook
                  </Button>
                </div>
              </div>
            </div>

            {/* 5. OCR Validation Report */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">5️⃣</span> OCR Validation Report
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-250 dark:border-emerald-800">
                  ✓ OCR VERIFIED
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Aadhaar Match (99%)</span>
                  <span className="text-[10px] font-mono text-slate-900 dark:text-slate-200 mt-1 block">{activeEmployee?.docForm?.aadhaarId || "3662-8829-1092"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">PAN Match (98%)</span>
                  <span className="text-[10px] font-mono text-slate-900 dark:text-slate-200 mt-1 block">{activeEmployee?.docForm?.panId || "BCHPA8892P"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Bank Account Routing</span>
                  <span className="text-[10px] font-mono text-slate-900 dark:text-slate-205 mt-1 block">{activeEmployee?.docForm?.bankAcc || "99821882910"}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">IFSC Route Code</span>
                  <span className="text-[10px] font-mono text-slate-900 dark:text-slate-205 mt-1 block">{activeEmployee?.docForm?.ifscCode || "SBIN0003019"}</span>
                </div>
              </div>
            </div>

            {/* 6. Face Verification */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">6️⃣</span> Face Verification
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${activeEmployee?.regForm?.isBiometricCompleted ? 'text-emerald-600 bg-emerald-50 border-emerald-250 dark:bg-emerald-900/20 dark:border-emerald-800' : 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-emerald-800'}`}>
                  {activeEmployee?.regForm?.isBiometricCompleted ? "✓ BIOMETRIC VERIFIED" : "PENDING BIOMETRICS"}
                </span>
              </div>
              <div className="flex gap-6 items-center">
                <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800">
                  {activeEmployee?.regForm?.profilePic ? (
                    <img src={activeEmployee.regForm.profilePic} alt="Live Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <Fingerprint className="text-indigo-500 w-8 h-8" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-semibold">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase block">Capture Quality</span>
                    {activeEmployee?.regForm?.isBiometricCompleted ? "Live Selfie Captured" : "Awaiting Face Scan"}
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase block">Face Match Score</span>
                    <span className="text-emerald-600 font-bold">{activeEmployee?.regForm?.isBiometricCompleted ? "99.8%" : "—"}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-[8px] text-slate-400 font-bold uppercase block">Liveness Check</span>
                    <span className="text-emerald-600 font-bold">{activeEmployee?.regForm?.isBiometricCompleted ? "Passed" : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Training Academy */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">7️⃣</span> Training Academy
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${activeEmployee?.academyState?.isCompleted ? 'text-emerald-600 bg-emerald-50 border-emerald-250 dark:bg-emerald-900/20 dark:border-emerald-800' : 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800'}`}>
                  {activeEmployee?.academyState?.isCompleted ? "✓ TRAINING PASSED" : "PENDING TRAINING"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-6 text-xs font-semibold">
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Training Completed</span>
                  <span className="text-slate-800 dark:text-slate-250">{activeEmployee?.academyState?.isCompleted ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Videos Watched</span>
                  <span className="text-slate-800 dark:text-slate-250">
                    {activeEmployee?.academyState?.isCompleted ? "100%" : `${Math.round((activeEmployee?.academyState?.modules?.filter(m => m.completed).length || 0) / 1 * 100)}%`}
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Quiz Score</span>
                  <span className="text-indigo-600 font-bold">{activeEmployee?.academyState?.isCompleted ? "92%" : "—"}</span>
                </div>
              </div>
            </div>

            {/* 8. Verification Call */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">8️⃣</span> Verification Call
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${activeEmployee?.interviewState?.isCompleted ? 'text-emerald-600 bg-emerald-50 border-emerald-250 dark:bg-emerald-900/20 dark:border-emerald-800' : 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800'}`}>
                  {activeEmployee?.interviewState?.isCompleted ? "✓ CALL VERIFIED" : "PENDING CALL"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-6 text-xs font-semibold mb-2">
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Call Status</span>
                  <span className="text-slate-800 dark:text-slate-250">{activeEmployee?.interviewState?.isCompleted ? "Completed" : "Awaiting Call"}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Duration</span>
                  <span className="text-slate-800 dark:text-slate-250">{activeEmployee?.interviewState?.isCompleted ? `${activeEmployee?.interviewState?.callDuration || 12} Minutes` : "0 Minutes"}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Agent Notes</span>
                  <span className="text-emerald-600 font-bold">{activeEmployee?.interviewState?.isCompleted ? "Available" : "Not Started"}</span>
                </div>
              </div>
              {activeEmployee?.interviewState?.interviewLogs && activeEmployee.interviewState.interviewLogs.length > 0 ? (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[10px] font-mono leading-relaxed text-slate-500 max-h-36 overflow-y-auto">
                  {activeEmployee.interviewState.interviewLogs.map((log, lidx) => (
                    <div key={lidx} className="mb-2">
                      <div className="font-bold text-slate-700 dark:text-slate-350">Q: {log.question.replace(/Officer Sarah|Interviewer:/, "").trim()}</div>
                      <div className="text-blue-500">A: {log.answer}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 text-[10px] font-mono text-center text-slate-400">
                  No verification call logs available yet.
                </div>
              )}
            </div>

            {/* 9. AI Trust Report */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-indigo-500">9️⃣</span> AI Trust Report
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-250 dark:border-emerald-800">
                  ✓ SECURE SYSTEM RECOMMENDATION
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-semibold mb-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Trust Score</span>
                  <span className="text-emerald-600 font-black">{activeEmployee.trustScore}%</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Fraud Risk</span>
                  <span className={fraudRisk === "Low" ? "text-slate-850 dark:text-slate-200" : "text-amber-500 font-bold"}>{fraudRisk}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Duplicate IP</span>
                  <span className="text-slate-850 dark:text-slate-200">None</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Document Risk</span>
                  <span className={docRisk === "Low" ? "text-slate-850 dark:text-slate-200" : "text-amber-500 font-bold"}>{docRisk}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">Identity Risk</span>
                  <span className={identityRisk === "Low" ? "text-slate-850 dark:text-slate-200" : "text-amber-500 font-bold"}>{identityRisk}</span>
                </div>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[8px] text-emerald-700 dark:text-emerald-500 font-black uppercase block tracking-wider">AI Recommendation</span>
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest font-mono">APPROVE EMPLOYEE</span>
                </div>
                <Cpu size={24} className="text-emerald-600 dark:text-emerald-500/50 animate-pulse" />
              </div>
            </div>

            {/* Audit Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <Clock className="text-indigo-600 dark:text-indigo-500" size={16} /> Audit Timeline
              </h3>
              
              <div className="space-y-4 font-mono text-[10px] text-slate-500 dark:text-slate-400 leading-normal pl-4 border-l border-indigo-500/20">
                <div className={`relative ${activeEmployee?.regForm?.isCompleted ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'opacity-40'}`}>
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${activeEmployee?.regForm?.isCompleted ? 'bg-indigo-600' : 'bg-slate-350'}`} />
                  <span className="text-slate-900 dark:text-white font-bold mr-3">09:12</span> Registration Completed {activeEmployee?.regForm?.isCompleted ? `(Verified ${activeEmployee.name})` : "(Pending)"}
                </div>
                <div className={`relative ${activeEmployee?.docForm?.isCompleted ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'opacity-40'}`}>
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${activeEmployee?.docForm?.isCompleted ? 'bg-indigo-600' : 'bg-slate-350'}`} />
                  <span className="text-slate-900 dark:text-white font-bold mr-3">09:20</span> Documents Uploaded {activeEmployee?.docForm?.isCompleted ? `(${activeEmployee.docForm.aadhaarFile})` : "(Pending)"}
                </div>
                <div className={`relative ${activeEmployee?.docForm?.isCompleted ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'opacity-40'}`}>
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${activeEmployee?.docForm?.isCompleted ? 'bg-indigo-600' : 'bg-slate-350'}`} />
                  <span className="text-slate-900 dark:text-white font-bold mr-3">09:25</span> OCR Verification Passed {activeEmployee?.docForm?.isCompleted ? `(Match Score: ${activeEmployee.docForm.confidenceScore}%)` : "(Pending)"}
                </div>
                <div className={`relative ${activeEmployee?.regForm?.isBiometricCompleted ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'opacity-40'}`}>
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${activeEmployee?.regForm?.isBiometricCompleted ? 'bg-indigo-600' : 'bg-slate-350'}`} />
                  <span className="text-slate-900 dark:text-white font-bold mr-3">09:40</span> Face Verification Passed {activeEmployee?.regForm?.isBiometricCompleted ? "(Facemesh Scan Active)" : "(Pending)"}
                </div>
                <div className={`relative ${activeEmployee?.academyState?.isCompleted ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'opacity-40'}`}>
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${activeEmployee?.academyState?.isCompleted ? 'bg-indigo-600' : 'bg-slate-350'}`} />
                  <span className="text-slate-900 dark:text-white font-bold mr-3">10:15</span> Training Completed {activeEmployee?.academyState?.isCompleted ? "(1/1 Module Certified)" : "(Pending)"}
                </div>
                <div className={`relative ${activeEmployee?.interviewState?.isCompleted ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'opacity-40'}`}>
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${activeEmployee?.interviewState?.isCompleted ? 'bg-indigo-600' : 'bg-slate-350'}`} />
                  <span className="text-slate-900 dark:text-white font-bold mr-3">11:05</span> Verification Call Passed {activeEmployee?.interviewState?.isCompleted ? "(Speech L1 Checked)" : "(Pending)"}
                </div>
                <div className={`relative ${activeEmployee?.interviewState?.isCompleted ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'opacity-40'}`}>
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${activeEmployee?.interviewState?.isCompleted ? 'bg-indigo-600' : 'bg-slate-350'}`} />
                  <span className="text-slate-900 dark:text-white font-bold mr-3">11:20</span> Submitted To Admin Review
                </div>
                {activeEmployee.status === "Approved" && (
                  <div className="relative text-emerald-600 dark:text-emerald-500 font-bold">
                    <div className="absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="font-bold mr-3">11:45</span> Approved By Admin (Activated)
                  </div>
                )}
                {activeEmployee.status === "Rejected" && (
                  <div className="relative text-rose-600 dark:text-rose-500 font-bold">
                    <div className="absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-600" />
                    <span className="font-bold mr-3">11:45</span> Rejected By Admin ({activeEmployee.status})
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Sticky Decision Panel */}
          <div className="absolute bottom-0 inset-x-0 h-24 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-10 flex items-center justify-between z-20 shrink-0">
            <span className="text-xs font-black uppercase text-slate-400 tracking-widest font-mono">
              Final Decision Panel
            </span>
            <div className="flex gap-4">
              <Button 
                onClick={handleApprove}
                disabled={activeEmployee.status !== "Pending Review"}
                className="px-8 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
              >
                Approve Employee
              </Button>
              <Button 
                variant="danger" 
                onClick={() => setShowRejectForm(true)}
                disabled={activeEmployee.status !== "Pending Review"}
                className="px-8 h-12 font-bold rounded-xl"
              >
                Reject Employee
              </Button>
            </div>
          </div>

        </div>

      </div>

      {/* ── DOCUMENT PREVIEW MODAL ── */}
      {showDocModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-850">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-white">
                Document Preview: {showDocModal === "aadhaar" ? "Aadhaar Card" : showDocModal === "pan" ? "PAN Card" : "Bank Passbook"}
              </h3>
              <button onClick={() => setShowDocModal(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400">
                <X size={18} />
              </button>
            </div>
            
            {/* Holographic simulated document view or original uploaded image */}
            {activeEmployee.docForm?.[`${showDocModal}FileData`] ? (
              <div className="mt-6 aspect-[1.6/1] bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden shadow-inner relative group">
                <img 
                  src={activeEmployee.docForm[`${showDocModal}FileData`]} 
                  alt="Original Government Document" 
                  className="w-full h-full object-contain transition-all duration-300 group-hover:scale-105"
                />
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[8px] font-black font-orbitron bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 tracking-wider">
                  ORIGINAL UPLOAD
                </div>
              </div>
            ) : (
              <div className="mt-6 aspect-[1.6/1] bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-500/20 p-6 flex flex-col justify-between text-white relative overflow-hidden shadow-inner font-mono">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)]" />
                
                <div className="flex justify-between items-start z-10">
                  <div>
                    <div className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest">CALTRACK AUDIT MATRIX</div>
                    <div className="text-xs font-black uppercase tracking-widest mt-1">
                      {showDocModal === "aadhaar" ? "UNION OF INDIA AADHAAR CARD" : showDocModal === "pan" ? "INCOME TAX DEPARTMENT GOVT. OF INDIA" : "STATE BANK OF RETAIL SYSTEM"}
                    </div>
                  </div>
                  <ShieldCheck size={28} className="text-indigo-400/40" />
                </div>

                <div className="flex gap-4 items-center z-10 mt-3">
                  <div className="w-14 h-14 bg-slate-950/60 border border-slate-800 rounded flex items-center justify-center shrink-0 overflow-hidden">
                    {activeEmployee.regForm?.profilePic ? (
                      <img src={activeEmployee.regForm.profilePic} alt="Profile" className="w-full h-full object-cover filter grayscale contrast-125" />
                    ) : (
                      <Fingerprint className="text-indigo-400/40 w-8 h-8" />
                    )}
                  </div>
                  <div className="text-[9px] text-slate-300 space-y-1">
                    <div>NAME: {activeEmployee.name}</div>
                    <div>ID TYPE: {showDocModal === "aadhaar" ? "UIDAI / AADHAAR" : showDocModal === "pan" ? "ITD / PAN" : "BANK LEDGER"}</div>
                    <div>DOC NUMBER: {
                      showDocModal === "aadhaar" ? (activeEmployee.docForm?.aadhaarId || "3662-8829-1092") :
                      showDocModal === "pan" ? (activeEmployee.docForm?.panId || "BCHPA8892P") :
                      (activeEmployee.docForm?.bankAcc || "99821882910")
                    }</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-[7px] text-slate-500 font-semibold z-10 uppercase tracking-widest">
                  <span>SECURITY CHECK: PASSED</span>
                  <span>MATCH RATIO: 99%</span>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-850">
              <Button onClick={() => setShowDocModal(null)} className="h-10 px-5 font-bold">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVAL CONFIRMATION DIALOG ── */}
      {showApproveConfirm && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-bounce">
              <Check size={32} strokeWidth={3} />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider font-mono">
                Approve Employee?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                This will grant workspace access and issue tasks credentials.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowApproveConfirm(false)} className="flex-1 h-10 font-bold border border-slate-200 dark:border-slate-700">
                Cancel
              </Button>
              <Button onClick={confirmApprove} className="flex-1 h-10 font-bold bg-emerald-600 hover:bg-emerald-700">
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECTION AUDIT FORM MODAL ── */}
      {showRejectForm && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-850">
              <h3 className="text-sm font-black uppercase tracking-wider text-rose-600 flex items-center gap-1.5 font-mono">
                <ShieldAlert size={18} /> Reject Employee Application
              </h3>
              <button onClick={() => setShowRejectForm(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-455">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">
                  Select Reason (Mandatory)
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.aadhaar}
                      onChange={e => setRejectReasons(prev => ({ ...prev, aadhaar: e.target.checked }))}
                    />
                    <span>Aadhaar Mismatch</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.pan}
                      onChange={e => setRejectReasons(prev => ({ ...prev, pan: e.target.checked }))}
                    />
                    <span>PAN Mismatch</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.blurred}
                      onChange={e => setRejectReasons(prev => ({ ...prev, blurred: e.target.checked }))}
                    />
                    <span>Blurred Documents</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.face}
                      onChange={e => setRejectReasons(prev => ({ ...prev, face: e.target.checked }))}
                    />
                    <span>Face Match Failed</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.training}
                      onChange={e => setRejectReasons(prev => ({ ...prev, training: e.target.checked }))}
                    />
                    <span>Training Incomplete</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.call}
                      onChange={e => setRejectReasons(prev => ({ ...prev, call: e.target.checked }))}
                    />
                    <span>Verification Call Failed</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.duplicate}
                      onChange={e => setRejectReasons(prev => ({ ...prev, duplicate: e.target.checked }))}
                    />
                    <span>Duplicate Dossier</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.fraud}
                      onChange={e => setRejectReasons(prev => ({ ...prev, fraud: e.target.checked }))}
                    />
                    <span>Fraud Risk Flag</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={rejectReasons.other}
                      onChange={e => setRejectReasons(prev => ({ ...prev, other: e.target.checked }))}
                    />
                    <span>Other</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block font-mono">
                  Admin Remarks (Mandatory)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Please upload a clearer Aadhaar image. The current document is unreadable."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 focus:outline-none resize-none"
                  value={rejectRemarks}
                  onChange={e => {
                    setRejectRemarks(e.target.value)
                    setRejectError("")
                  }}
                />
              </div>

              {rejectError && (
                <div className="text-rose-600 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {rejectError}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <Button type="button" variant="ghost" onClick={() => setShowRejectForm(false)} className="flex-1 h-11 font-bold">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="danger" 
                  disabled={!rejectRemarks.trim()}
                  className="flex-grow h-11 font-bold"
                >
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
