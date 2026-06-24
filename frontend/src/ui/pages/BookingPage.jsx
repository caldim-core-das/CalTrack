import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Calendar, Phone, Mail, User, MapPin, Wrench, 
  AlertCircle, CheckCircle, Upload, ArrowRight, Loader2,
  Shield, Sparkles, X, BarChart3, Map, Smartphone, LineChart, CreditCard, Check, ShieldCheck, Clock
} from "lucide-react"
import { apiRequest } from "../../api/client.js"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"

const SERVICE_CATEGORIES = [
  { id: "plumbing", name: "Plumbing", desc: "Leaky pipes, toilets, and faucet repairs" },
  { id: "electrical", name: "Electrical", desc: "Wiring, switchboard, and lighting issues" },
  { id: "carpentry", name: "Carpentry", desc: "Furniture repairs and wood work" },
  { id: "hvac", name: "HVAC", desc: "Air conditioning and heating services" },
  { id: "cleaning", name: "Cleaning", desc: "Deep cleaning and sanitation solutions" },
  { id: "pest_control", name: "Pest Control", desc: "Termite, rodent, and insect elimination" },
  { id: "painting", name: "Painting", desc: "Wall touch-ups and full interior painting" },
  { id: "appliance_repair", name: "Appliance Repair", desc: "Fridges, washing machines, and ovens" },
  { id: "security", name: "Security Systems", desc: "CCTV and security alarm maintenance" },
  { id: "general", name: "General Maintenance", desc: "Any other miscellaneous handyman tasks" },
]

const CORE_MODULES = [
  {
    title: "Executive Dashboard",
    icon: BarChart3,
    color: "from-blue-500 to-indigo-600",
    features: [
      "Real-time KPI overview with productivity scores",
      "Total labor cost tracking across departments",
      "Employee engagement metrics & trend analysis",
      "Active headcount monitoring per location"
    ]
  },
  {
    title: "Smart Scheduling",
    icon: Calendar,
    color: "from-purple-500 to-indigo-600",
    features: [
      "Drag-and-drop shift assignment calendar",
      "Auto-fill shifts based on availability rules",
      "Overtime threshold alerts & compliance flags",
      "Shift swap requests with manager approvals"
    ]
  },
  {
    title: "Live Tracking Map",
    icon: Map,
    color: "from-indigo-500 to-emerald-600",
    features: [
      "Real-time GPS tracking of field employees",
      "Geofenced work zones with entry/exit alerts",
      "Route history playback for each worker",
      "Active employee count per site boundary"
    ]
  },
  {
    title: "Mobile Field App",
    icon: Smartphone,
    color: "from-fuchsia-500 to-pink-600",
    features: [
      "Geolocation-based punch in/out",
      "Selfie verification at clock-in",
      "Weekly timesheet with daily hours tracking",
      "Offline mode with automated sync on reconnect"
    ]
  },
  {
    title: "Workforce Analytics",
    icon: LineChart,
    color: "from-blue-500 to-cyan-600",
    features: [
      "Attendance trend analysis over 12 months",
      "Department-level productivity heatmap",
      "Overtime distribution across teams",
      "Predictive staffing recommendations"
    ]
  },
  {
    title: "Payroll Processing",
    icon: CreditCard,
    color: "from-amber-500 to-orange-600",
    features: [
      "Automated payroll calculation from timesheets",
      "Tax deduction and compliance engine",
      "Overtime rate multiplier configuration",
      "Bank transfer file generation"
    ]
  }
]

export function BookingPage() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1) // 1: Form, 2: Success
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successData, setSuccessData] = useState(null)

  const [formData, setFormData] = useState({
    customer_name: "",
    phone: "",
    email: "",
    service_category: "general",
    issue_title: "",
    description: "",
    address: "",
    preferred_date: "",
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Portal View States
  const [activeTab, setActiveTab] = useState("admin") // admin | employee
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0)

  // Reset active feature when switching tabs
  useEffect(() => {
    setActiveFeatureIndex(0)
  }, [activeTab])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const data = new FormData()
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key])
    })
    if (photoFile) {
      data.append("photo", photoFile)
    }

    try {
      const org = searchParams.get("org")
      const url = org ? `/booking/?org=${encodeURIComponent(org)}` : "/booking/"
      const response = await apiRequest(url, {
        method: "POST",
        body: data,
      })
      if (response?.success) {
        setSuccessData(response.data)
        setStep(2)
      } else {
        setError(response?.message || "Something went wrong. Please try again.")
      }
    } catch (err) {
      console.error(err)
      if (err?.body?.errors) {
        const errorMsgs = Object.entries(err.body.errors)
          .map(([field, msgs]) => {
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1).replace("_", " ")
            return `${fieldName}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`
          })
          .join(" | ")
        setError(errorMsgs || err.body.message)
      } else {
        setError(err?.body?.message || err?.body?.detail || "Connection error. Please verify your details.")
      }
    } finally {
      setLoading(false)
    }
  }

  const tabContent = {
    admin: {
      tag: "Management Console",
      title: "Control Center for Admins & Managers",
      description: "Keep track of your entire field force from a single unified workspace. Manage tasks, shifts, dispatching, and compliance effortlessly.",
      features: [
        { 
          title: "Executive Dashboard", 
          desc: "Real-time KPI overview with productivity scores and active headcount.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_dashboard_mockup_1778231495839.png`
        },
        { 
          title: "Interactive Live Map", 
          desc: "Real-time GPS coordinates and geofenced job site validation.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_live_map_mockup_1778231560076.png`
        },
        { 
          title: "Smart Scheduling Calendar", 
          desc: "Easy drag-and-drop shift planner with automatic team alerts.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_scheduling_mockup_1778231584856.png`
        },
        { 
          title: "Payroll & Labor Analytics", 
          desc: "Comprehensive cost analysis, multipliers, and bank-ready files.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_payroll_mockup_1778231538875.png`
        }
      ]
    },
    employee: {
      tag: "Mobile Field Assistant",
      title: "Intuitive App for Technicians & Staff",
      description: "Empower your field workforce with a mobile-optimized self-service app. Log time, view schedules, and submit completion reports on the go.",
      features: [
        { 
          title: "GPS-Verified Punch Card", 
          desc: "Clock in and clock out securely within geofence site boundaries.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_mobile_app_mockup_1778231517495.png`
        },
        { 
          title: "Secure Onboarding Journey", 
          desc: "Face verification, Aadhaar/PAN OCR clearances, and system registration.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_mobile_app_mockup_1778231517495.png`
        },
        { 
          title: "Instant Shift Schedules", 
          desc: "Real-time calendar views of assigned tasks, shifts, and breaks.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_scheduling_mockup_1778231584856.png`
        },
        { 
          title: "Task Completion Uploads", 
          desc: "Submit notes, progress logs, and photos directly from the job site.",
          img: `${import.meta.env.BASE_URL || "/"}mockups/caltrack_mobile_app_mockup_1778231517495.png`
        }
      ]
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-500/30 overflow-x-hidden pb-32">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-sans { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between z-50 transition-all">
        <CalTrackLogo size="sm" showTagline={false} theme="light" />
      </header>

      {/* ── TWO COLUMN LAYOUT ── */}
      <div className="max-w-7xl mx-auto px-6 pt-32 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* LEFT COLUMN: CLIENT PORTAL INFO (5 cols) */}
        <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-32">
          <div className="space-y-4">
            <span className="text-[11px] font-mono font-extrabold tracking-[0.25em] text-indigo-650 uppercase block">
              Client Portal
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-black text-slate-900 leading-tight">
              Fast, Reliable <br />
              <span className="text-indigo-600">Workforce Dispatching</span>
            </h1>
            <p className="text-slate-500 text-[14px] leading-relaxed font-semibold mt-4">
              Caltrack connects you directly with our team of skilled technicians. Describe your issue, submit your preferred date, and monitor the entire job lifecycle in real-time.
            </p>
          </div>

          {/* HOW IT WORKS */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-mono font-extrabold tracking-[0.25em] text-slate-400 uppercase">
              How It Works
            </h3>
            
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                <div>
                  <h4 className="text-slate-800 font-extrabold text-[14px]">1. Submit Service Request</h4>
                  <p className="text-slate-500 text-[12px] font-medium leading-normal mt-1">
                    Provide your details, select a category, and upload an optional photo of the issue.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0 mt-1.5" />
                <div>
                  <h4 className="text-slate-800 font-extrabold text-[14px]">2. Agent Verification & Dispatch</h4>
                  <p className="text-slate-500 text-[12px] font-medium leading-normal mt-1">
                    Our dispatch team reviews the request and assigns it to a qualified local technician immediately.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                <div>
                  <h4 className="text-slate-800 font-extrabold text-[14px]">3. Live Tracking & Feedback</h4>
                  <p className="text-slate-500 text-[12px] font-medium leading-normal mt-1">
                    Receive confirmation and a secure feedback link to track completion and evaluate service quality.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* GPS MONITORED BADGE */}
          <div className="flex items-start gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] max-w-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-slate-850 font-extrabold text-[13px]">Real-time GPS Monitored</h4>
              <p className="text-slate-400 text-[11px] font-semibold leading-normal mt-0.5">
                Technicians verify work site presence via coordinate geofencing.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SERVICE REQUEST CARD (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.015)] w-full">
            
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-display font-black text-slate-900">Request a Service</h2>
                    <p className="text-slate-400 text-xs mt-1">Please fill in the details below to initiate dispatch.</p>
                  </div>

                  {error && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 text-rose-600 text-xs font-semibold">
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Section 1: Customer Info */}
                  <div>
                    <span className="text-[10px] font-mono font-black tracking-widest text-slate-400 uppercase mb-4 block">
                      1. Customer Information
                    </span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Full Name *</label>
                        <div className="relative group">
                          <User className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
                          <input
                            type="text"
                            name="customer_name"
                            required
                            value={formData.customer_name}
                            onChange={handleChange}
                            placeholder="John Doe"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Phone Number *</label>
                        <div className="relative group">
                          <Phone className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
                          <input
                            type="tel"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+1 (555) 000-0000"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5 mt-4">
                      <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Email Address (Optional)</label>
                      <div className="relative group">
                        <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="john@example.com"
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Service Info */}
                  <div className="pt-2">
                    <span className="text-[10px] font-mono font-black tracking-widest text-slate-400 uppercase mb-4 block">
                      2. Service Information
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Category */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Category *</label>
                        <div className="relative group">
                          <Wrench className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
                          <select
                            name="service_category"
                            value={formData.service_category}
                            onChange={handleChange}
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 pl-12 pr-10 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 appearance-none cursor-pointer"
                          >
                            {SERVICE_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-4.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-bold">▼</div>
                        </div>
                      </div>

                      {/* Preferred Date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Preferred Date *</label>
                        <div className="relative group">
                          <Calendar className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
                          <input
                            type="date"
                            name="preferred_date"
                            required
                            value={formData.preferred_date}
                            onChange={handleChange}
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300"
                            style={{ colorScheme: 'light' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Issue Title */}
                    <div className="space-y-1.5 mt-4">
                      <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Issue Title *</label>
                      <input
                        type="text"
                        name="issue_title"
                        required
                        value={formData.issue_title}
                        onChange={handleChange}
                        placeholder="e.g. Faucet leak in kitchen"
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 px-5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5 mt-4">
                      <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Description *</label>
                      <textarea
                        name="description"
                        required
                        rows={3}
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Provide specific details about the issue to prepare the technician..."
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 px-5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400 resize-none"
                      />
                    </div>

                    {/* Service Address */}
                    <div className="space-y-1.5 mt-4">
                      <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Service Address *</label>
                      <div className="relative group">
                        <MapPin className="absolute left-4.5 top-5 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
                        <textarea
                          name="address"
                          required
                          rows={2}
                          value={formData.address}
                          onChange={handleChange}
                          placeholder="Street, Suite/Apartment, City, Zip Code"
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500/50 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400 resize-none"
                        />
                      </div>
                    </div>

                    {/* Upload Photo */}
                    <div className="space-y-2 mt-4">
                      <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Upload Photo (Optional)</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] text-slate-650 px-4 py-3 rounded-xl cursor-pointer transition-all text-xs font-bold uppercase tracking-wider w-fit">
                          <Upload className="w-4 h-4 text-indigo-500" />
                          {photoFile ? "Change Photo" : "Choose Photo"}
                          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                        {photoPreview && (
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200">
                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                              className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Dispatching Request...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Request</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 space-y-6"
                >
                  <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  
                  <div>
                    <h2 className="text-2xl font-display font-black text-slate-900 leading-tight">Dispatch Verified!</h2>
                    <p className="text-slate-500 text-xs mt-2 max-w-sm mx-auto leading-relaxed">
                      Your request has entered the Caltrack dispatch matrix. An available technician will be assigned shortly.
                    </p>
                  </div>

                  <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-5 text-left max-w-sm mx-auto space-y-3 font-semibold text-[13px]">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Tracking ID</span>
                      <span className="text-indigo-650 font-black text-sm">{successData?.request_id}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Customer</span>
                      <span className="text-slate-800">{formData.customer_name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Category</span>
                      <span className="text-slate-800 capitalize">
                        {SERVICE_CATEGORIES.find(c => c.id === formData.service_category)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Service Date</span>
                      <span className="text-slate-800">{formData.preferred_date}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep(1)}
                    className="py-3.5 px-8 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Submit Another Request
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

      </div>

      {/* ── SECTION: WORKFORCE SUITE MODULES ── */}
      <section className="max-w-7xl mx-auto px-6 mt-32 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[11px] font-mono font-extrabold tracking-[0.25em] text-indigo-650 uppercase">
            Workforce Management Suite
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-black text-slate-900">
            Explore Our Modules
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto font-medium">
            Caltrack provides a comprehensive suite of tools built to optimize, track, and streamline workforce time operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {CORE_MODULES.map((mod, i) => {
            const Icon = mod.icon
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                whileHover={{ y: -6 }}
                className={`bg-white border border-slate-100 p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)] transition-all duration-300 relative group overflow-hidden`}
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${mod.color}`} />

                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white duration-300`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-display font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {mod.title}
                    </h3>
                  </div>

                  <ul className="space-y-2.5 pt-2">
                    {mod.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-[12px] text-slate-500 font-semibold leading-normal">
                        <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" strokeWidth={3} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ── SECTION: PORTAL EXPERIENCES (REAL ADMIN & EMPLOYEE VIEWS) ── */}
      <section className="max-w-7xl mx-auto px-6 mt-32 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[11px] font-mono font-extrabold tracking-[0.25em] text-indigo-650 uppercase">
            User Experience
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-black text-slate-900">
            Inside the Portals
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto font-medium">
            See how Caltrack provides customized, premium digital environments for both administrators and field personnel. Click each feature below to preview the live portal interface.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl max-w-md mx-auto border border-slate-200">
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === "admin" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900"}`}
          >
            <ShieldCheck size={16} />
            Admin Portal
          </button>
          <button
            onClick={() => setActiveTab("employee")}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === "employee" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Smartphone size={16} />
            Employee Portal
          </button>
        </div>

        {/* Tab content view */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 lg:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.015)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
            >
              {/* Text Info (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-extrabold tracking-widest text-indigo-600 uppercase">
                    {tabContent[activeTab].tag}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-display font-black text-slate-900 leading-tight">
                    {tabContent[activeTab].title}
                  </h3>
                  <p className="text-slate-500 text-[13px] leading-relaxed font-semibold">
                    {tabContent[activeTab].description}
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  {tabContent[activeTab].features.map((feat, idx) => {
                    const isSelected = activeFeatureIndex === idx
                    return (
                      <div 
                        key={idx} 
                        onClick={() => setActiveFeatureIndex(idx)}
                        className={`flex gap-4 p-4 rounded-2xl border transition-all duration-350 cursor-pointer group ${isSelected ? "bg-indigo-50/60 border-indigo-200/50 shadow-sm" : "bg-transparent border-transparent hover:bg-slate-50/60"}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"}`}>
                          <Check size={12} strokeWidth={3.5} />
                        </div>
                        <div>
                          <h4 className={`font-bold text-xs transition-colors ${isSelected ? "text-indigo-650" : "text-slate-800 group-hover:text-indigo-600"}`}>{feat.title}</h4>
                          <p className="text-slate-450 text-[11px] mt-0.5 leading-normal font-semibold">{feat.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mockup Preview Image (7 cols) */}
              <div className="lg:col-span-7 flex justify-center">
                <div className="relative group max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-150 bg-[#FAFAFA] p-1.5 transition-all duration-500 hover:shadow-indigo-500/5 hover:-translate-y-1">
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={activeFeatureIndex}
                      src={tabContent[activeTab].features[activeFeatureIndex].img} 
                      alt={tabContent[activeTab].features[activeFeatureIndex].title}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-auto object-cover rounded-xl select-none"
                    />
                  </AnimatePresence>
                  {/* Subtle hover overlay accent */}
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

      </section>

    </div>
  )
}
