import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createPortal } from "react-dom"
import { 
  Calendar, Phone, Mail, User, MapPin, Wrench, 
  AlertCircle, CheckCircle, Upload, ArrowRight, Loader2,
  Building, Clock, Shield, Sparkles, ChevronRight, Check, X
} from "lucide-react"
import { apiRequest } from "../../api/client.js"

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

// ─── STYLIZED BOOKING MODAL ────────────────────────────────────────────────
function BookingModal({ isOpen, onClose, onSuccess }) {
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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep(1)
        setSuccessData(null)
        setError(null)
        setFormData({
          customer_name: "", phone: "", email: "", service_category: "general",
          issue_title: "", description: "", address: "", preferred_date: "",
        })
        setPhotoFile(null)
        setPhotoPreview(null)
      }, 300) // Reset after animation
    }
  }, [isOpen])

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
      const response = await apiRequest("/booking/", {
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

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="w-full max-w-4xl max-h-[90vh] bg-white shadow-[0_25px_80px_rgba(0,0,0,0.25)] rounded-3xl overflow-hidden flex flex-col font-sans relative"
          >
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-400 z-20" />

            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between z-10 shrink-0 mt-1">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="text-indigo-500" size={20} /> Request Service
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Secure Dispatch Link • Caltrack Network</p>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto z-10 p-8 custom-scrollbar">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onSubmit={handleSubmit}
                    className="space-y-8"
                  >
                    {error && (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-600 text-xs font-semibold">
                        <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left Column: Customer & Service */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-slate-200 pb-2">1. Client Info</h4>
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Full Name *</label>
                              <div className="relative group">
                                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                  type="text"
                                  name="customer_name"
                                  required
                                  value={formData.customer_name}
                                  onChange={handleChange}
                                  placeholder="John Doe"
                                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Phone Number *</label>
                              <div className="relative group">
                                <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                  type="tel"
                                  name="phone"
                                  required
                                  value={formData.phone}
                                  onChange={handleChange}
                                  placeholder="+1 (555) 000-0000"
                                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Email Address (Optional)</label>
                              <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                  type="email"
                                  name="email"
                                  value={formData.email}
                                  onChange={handleChange}
                                  placeholder="john@example.com"
                                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Service Details */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-slate-200 pb-2">2. Service Details</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Category *</label>
                              <div className="relative group">
                                <Wrench className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                                <select
                                  name="service_category"
                                  value={formData.service_category}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer"
                                >
                                  {SERVICE_CATEGORIES.map((cat) => (
                                    <option key={cat.id} value={cat.id} className="bg-white text-slate-800">
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Date *</label>
                              <div className="relative group">
                                <Calendar className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                  type="date"
                                  name="preferred_date"
                                  required
                                  value={formData.preferred_date}
                                  onChange={handleChange}
                                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                                  style={{ colorScheme: 'light' }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Issue Title *</label>
                            <input
                              type="text"
                              name="issue_title"
                              required
                              value={formData.issue_title}
                              onChange={handleChange}
                              placeholder="e.g. Faucet leak"
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 px-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Description *</label>
                            <textarea
                              name="description"
                              required
                              rows={2}
                              value={formData.description}
                              onChange={handleChange}
                              placeholder="Provide specifics..."
                              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 px-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1">Service Address *</label>
                            <div className="relative group">
                              <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                              <textarea
                                name="address"
                                required
                                rows={2}
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="Street, City, Zip"
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex-1">
                         <label className="flex items-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-3 rounded-xl cursor-pointer transition-all text-xs font-bold uppercase tracking-wider w-fit">
                          <Upload className="w-4 h-4 text-indigo-500" />
                          {photoFile ? "Change Photo" : "Upload Photo (Opt)"}
                          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                      </div>
                      <div className="flex-1 flex justify-end">
                         <button
                          type="submit"
                          disabled={loading}
                          className="w-full md:w-auto bg-gradient-to-r from-indigo-500 to-fuchsia-600 hover:from-indigo-400 hover:to-fuchsia-500 text-white font-extrabold text-xs uppercase tracking-widest py-4 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2 group disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Dispatching...
                            </>
                          ) : (
                            <>
                              Submit Request
                              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 space-y-8"
                  >
                    <div className="w-24 h-24 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                      <CheckCircle className="w-12 h-12" />
                    </div>
                    
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dispatch Verified!</h2>
                      <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                        Your request has entered the Caltrack dispatch matrix. An available technician will be assigned shortly.
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left max-w-md mx-auto space-y-4">
                      <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-3">
                        <span className="text-slate-500 font-bold uppercase tracking-wider">Tracking ID</span>
                        <span className="text-indigo-600 font-black text-sm">{successData?.request_id}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase tracking-wider">Customer</span>
                        <span className="text-slate-800 font-bold">{formData.customer_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase tracking-wider">Category</span>
                        <span className="text-slate-800 font-bold capitalize">
                          {SERVICE_CATEGORIES.find(c => c.id === formData.service_category)?.name}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase tracking-wider">Service Date</span>
                        <span className="text-slate-800 font-bold">{formData.preferred_date}</span>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4">
                      <button
                        onClick={onClose}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-widest py-3 px-8 rounded-xl transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ─── MAIN LANDING PAGE ───────────────────────────────────────────────────────
export function BookingPage() {
  const [isModalOpen, setModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between z-50 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <Building className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white">Caltrack</span>
          </div>
        </div>
        
        <div>
          <a 
            href="/login" 
            className="text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors flex items-center gap-2 bg-white/5 hover:bg-white/10 px-5 py-3 rounded-full border border-white/10"
          >
            <User className="w-4 h-4" /> Employee Login
          </a>
        </div>
      </header>

      {/* ── SECTION 1: HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero_abstract_bg.png" 
            alt="Abstract Background" 
            className="w-full h-full object-cover opacity-60 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/80 to-slate-950" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest">
              <Sparkles size={14} /> Next-Gen Service Desk
            </span>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-[1.1]">
              The Future of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-rose-400">
                Workforce Dispatching
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-medium">
              Caltrack connects you instantly with verified technicians. Real-time GPS tracking, instant quotes, and secure service delivery.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <button
              onClick={() => setModalOpen(true)}
              className="relative group inline-flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-2xl blur-lg opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-slate-900 border border-white/20 px-10 py-5 rounded-2xl flex items-center gap-3 transition-transform duration-300 group-hover:scale-[1.02]">
                <span className="text-lg font-black text-white uppercase tracking-wider">Book a Service Now</span>
                <ChevronRight className="w-5 h-5 text-fuchsia-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE TRACKING ── */}
      <section className="relative py-32 border-t border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <MapPin className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Real-Time <br/><span className="text-indigo-400">Dispatch Tracking</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Watch your assigned technician arrive in real-time. Our interactive mapping matrix uses advanced geofencing to ensure technicians are exactly where they need to be, when they need to be there.
            </p>
            <ul className="space-y-3 pt-4">
              {["Live GPS Coordinate Streaming", "Automated ETA Calculations", "Geofenced Site Verification"].map(item => (
                <li key={item} className="flex items-center gap-3 text-slate-300 font-semibold">
                  <CheckCircle className="w-5 h-5 text-indigo-500" /> {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: 15 }}
            whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative perspective-1000"
          >
            <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full" />
            <img 
              src="/dispatch_tracking_ui.png" 
              alt="Dispatch Tracking Interface" 
              className="relative w-full rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] transform hover:-translate-y-2 transition-transform duration-500"
            />
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 3: VERIFIED TECHNICIANS ── */}
      <section className="relative py-32 bg-slate-900/50 border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
            whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative perspective-1000 order-2 lg:order-1"
          >
            <div className="absolute inset-0 bg-fuchsia-500/20 blur-[100px] rounded-full" />
            <img 
              src="/verified_tech_ui.png" 
              alt="Verified Technician Badge" 
              className="relative w-full rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] transform hover:-translate-y-2 transition-transform duration-500"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-6 order-1 lg:order-2"
          >
            <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-fuchsia-400" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              100% Verified <br/><span className="text-fuchsia-400">Expert Network</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Every technician on the Caltrack network undergoes rigorous biometric verification, OCR document checks, and a comprehensive onboarding academy. We ensure unparalleled trust and security for every job.
            </p>
            <ul className="space-y-3 pt-4">
              {["Facemesh Biometric Auth", "Government ID OCR Matching", "Mandatory Training Modules"].map(item => (
                <li key={item} className="flex items-center gap-3 text-slate-300 font-semibold">
                  <CheckCircle className="w-5 h-5 text-fuchsia-500" /> {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 4: CTA / TRUST ── */}
      <section className="py-32 relative text-center px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15),transparent_50%)]" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-3xl mx-auto space-y-10"
        >
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">
            Ready to experience <br/>seamless service?
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Join thousands of satisfied clients who trust Caltrack for rapid, reliable, and verified workforce dispatching.
          </p>
          
          <button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-indigo-500 to-fuchsia-600 hover:from-indigo-400 hover:to-fuchsia-500 text-white font-black text-sm uppercase tracking-widest py-5 px-12 rounded-full transition-all hover:scale-105 shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_rgba(99,102,241,0.7)]"
          >
            Initiate Service Request
          </button>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 bg-slate-950/50 py-12 px-8 text-center text-slate-500 text-xs font-semibold tracking-wider uppercase">
        © 2026 Caltrack Workforce Dispatch Systems. All rights reserved.
      </footer>

      {/* ── BOOKING MODAL OVERLAY ── */}
      <BookingModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
