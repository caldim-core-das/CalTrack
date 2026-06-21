import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Phone, Mail, User, MapPin, Wrench, AlertCircle, CheckCircle, Upload, ArrowRight, Loader2 } from "lucide-react"
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

export function BookingPage() {
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

    // Build FormData
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="max-w-2xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative z-10">
        
        {/* Banner header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Workforce Service Booking</h1>
          <p className="text-indigo-100 text-xs md:text-sm mt-2 font-medium">Submit your service request and track our technician's journey in real-time.</p>
        </div>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="booking-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Section: Customer Information */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">1. Customer Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Full Name *</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          name="customer_name"
                          required
                          value={formData.customer_name}
                          onChange={handleChange}
                          placeholder="John Doe"
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Phone Number *</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="tel"
                          name="phone"
                          required
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+1 (555) 000-0000"
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs font-semibold text-slate-400">Email Address (Optional)</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="john@example.com"
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">Provide an email to receive your service confirmation and feedback token.</span>
                  </div>
                </div>

                {/* Section: Service Request Details */}
                <div className="pt-4 border-t border-slate-800/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-4">2. Service Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Service Category *</label>
                      <div className="relative">
                        <Wrench className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <select
                          name="service_category"
                          value={formData.service_category}
                          onChange={handleChange}
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                        >
                          {SERVICE_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id} className="bg-slate-950 text-slate-200">
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Preferred Date *</label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="date"
                          name="preferred_date"
                          required
                          value={formData.preferred_date}
                          onChange={handleChange}
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs font-semibold text-slate-400">Issue Title *</label>
                    <input
                      type="text"
                      name="issue_title"
                      required
                      value={formData.issue_title}
                      onChange={handleChange}
                      placeholder="Briefly describe what needs attention (e.g. Water leak in kitchen sink)"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs font-semibold text-slate-400">Detailed Description *</label>
                    <textarea
                      name="description"
                      required
                      rows={3}
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Provide specific details about the issue to help our technician prepare..."
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs font-semibold text-slate-400">Service Address *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <textarea
                        name="address"
                        required
                        rows={2}
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Street, Suite/Apartment, City, Zip Code"
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Photo Upload */}
                <div className="pt-4 border-t border-slate-800/60 space-y-3">
                  <label className="text-xs font-semibold text-slate-400">Upload Issue Photo (Optional)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 px-4 py-3 rounded-xl cursor-pointer transition-colors text-sm font-semibold">
                      <Upload className="w-4 h-4 text-indigo-400" />
                      Choose Photo
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    {photoPreview && (
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-800">
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-extrabold text-xs uppercase tracking-widest py-4 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group disabled:opacity-75"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting Booking...
                    </>
                  ) : (
                    <>
                      Confirm Service Booking
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="booking-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-6"
              >
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle className="w-8 h-8" />
                </div>
                
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white">Booking Request Registered!</h2>
                  <p className="text-slate-400 text-sm mt-2">
                    Your request has been successfully submitted to our dispatch team.
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-left max-w-sm mx-auto space-y-3">
                  <div className="flex justify-between items-center text-xs border-b border-slate-800/60 pb-3">
                    <span className="text-slate-500 font-semibold">Service Request ID</span>
                    <span className="text-indigo-400 font-extrabold text-sm">{successData?.request_id}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Customer</span>
                    <span className="text-slate-300 font-medium">{formData.customer_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Category</span>
                    <span className="text-slate-300 font-medium capitalize">
                      {SERVICE_CATEGORIES.find(c => c.id === formData.service_category)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Scheduled Date</span>
                    <span className="text-slate-300 font-medium">{formData.preferred_date}</span>
                  </div>
                </div>

                <div className="space-y-3 max-w-sm mx-auto">
                  <button
                    onClick={() => {
                      setStep(1)
                      setFormData({
                        customer_name: "",
                        phone: "",
                        email: "",
                        service_category: "general",
                        issue_title: "",
                        description: "",
                        address: "",
                        preferred_date: "",
                      })
                      setPhotoFile(null)
                      setPhotoPreview(null)
                      setSuccessData(null)
                      setError(null)
                    }}
                    className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-extrabold text-xs uppercase tracking-widest py-3 px-4 rounded-xl transition-all"
                  >
                    Submit Another Request
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
