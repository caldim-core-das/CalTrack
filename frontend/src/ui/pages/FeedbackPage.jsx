import React, { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Star, CheckCircle, AlertCircle, Loader2, ArrowRight, Smile, ThumbsUp, Wrench, ShieldAlert } from "lucide-react"
import { apiRequest } from "../../api/client.js"

export function FeedbackPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [srData, setSrData] = useState(null)

  const [formData, setFormData] = useState({
    rating: 5,
    employee_behaviour: "good",
    work_quality: "good",
    issue_resolved: true,
    comment: "",
  })

  // Load request summary
  useEffect(() => {
    let active = true
    async function fetchSummary() {
      setLoading(true)
      setError(null)
      try {
        const response = await apiRequest(`/feedback/${token}/`)
        if (!active) return
        if (response?.success) {
          setSrData(response.data)
        } else {
          setError(response?.message || "Failed to load booking summary.")
        }
      } catch (err) {
        if (!active) return
        setError(err?.body?.message || err?.body?.detail || "Feedback link is invalid or has expired.")
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchSummary()
    return () => {
      active = false
    }
  }, [token])

  const handleRatingChange = (val) => {
    setFormData((prev) => ({ ...prev, rating: val }))
  }

  const handleSelectChange = (name, val) => {
    setFormData((prev) => ({ ...prev, [name]: val }))
  }

  const handleCommentChange = (e) => {
    const val = e.target.value
    setFormData((prev) => ({ ...prev, comment: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitLoading(true)
    setError(null)

    try {
      const response = await apiRequest(`/feedback/${token}/`, {
        method: "POST",
        json: formData,
      })
      if (response?.success) {
        setSuccess(true)
      } else {
        setError(response?.message || "Failed to submit feedback.")
      }
    } catch (err) {
      console.error(err)
      setError(err?.body?.message || err?.body?.detail || "An error occurred while submitting. Please try again.")
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">
            Verifying Feedback Token...
          </p>
        </div>
      </div>
    )
  }

  if (error && !srData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6 border border-red-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">Feedback Form Unavailable</h2>
          <p className="text-sm font-semibold text-slate-400 mt-2 leading-relaxed">
            {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-2xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative z-10">
        
        {/* Banner header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Customer Service Feedback</h1>
          <p className="text-indigo-100 text-xs md:text-sm mt-2 font-medium">Your experience matters. Tell us how we did on Request {srData?.request_id}.</p>
        </div>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form
                key="feedback-form"
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

                {/* Job Summary Card */}
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Service Details</span>
                      <h4 className="text-sm font-extrabold text-white mt-1 leading-snug">{srData?.issue_title}</h4>
                    </div>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                      {srData?.request_id}
                    </span>
                  </div>
                  {srData?.assigned_employee && (
                    <div className="flex items-center gap-3 border-t border-slate-800/60 pt-3 mt-1">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-extrabold text-xs">
                        {srData.assigned_employee.full_name?.charAt(0) || "T"}
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-slate-300">{srData.assigned_employee.full_name}</div>
                        <div className="text-[10px] text-slate-500">Service Technician</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Feedback fields */}
                <div className="space-y-5">
                  
                  {/* Rating Stars */}
                  <div className="space-y-2 text-center py-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall Rating</label>
                    <div className="flex justify-center items-center gap-3 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRatingChange(star)}
                          className="hover:scale-115 focus:outline-none transition-transform"
                        >
                          <Star
                            className={`w-8 h-8 ${
                              star <= formData.rating
                                ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                                : "text-slate-700"
                            } transition-colors`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality pickers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Employee Behaviour */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Smile className="w-4 h-4 text-indigo-400" />
                        Technician Behavior
                      </label>
                      <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                        {["poor", "average", "good"].map((val) => {
                          const active = formData.employee_behaviour === val
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleSelectChange("employee_behaviour", val)}
                              className={`py-2 rounded-lg text-xs font-extrabold capitalize transition-all ${
                                active
                                  ? "bg-slate-900 border border-slate-700 text-white shadow-sm"
                                  : "text-slate-500 hover:text-slate-300"
                              }`}
                            >
                              {val}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Work Quality */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-indigo-400" />
                        Quality of Work
                      </label>
                      <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                        {["poor", "average", "good"].map((val) => {
                          const active = formData.work_quality === val
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleSelectChange("work_quality", val)}
                              className={`py-2 rounded-lg text-xs font-extrabold capitalize transition-all ${
                                active
                                  ? "bg-slate-900 border border-slate-700 text-white shadow-sm"
                                  : "text-slate-500 hover:text-slate-300"
                              }`}
                            >
                              {val}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Issue Resolved Switch */}
                  <div className="flex items-center justify-between bg-slate-950/20 border border-slate-800/80 rounded-2xl p-4 mt-2">
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4 text-indigo-400" />
                        Was the issue resolved?
                      </div>
                      <div className="text-[10px] text-slate-500">Please confirm if the requested service is complete.</div>
                    </div>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleSelectChange("issue_resolved", false)}
                        className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                          !formData.issue_resolved
                            ? "bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectChange("issue_resolved", true)}
                        className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                          formData.issue_resolved
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Additional Comments (Optional)</label>
                    <textarea
                      rows={3}
                      value={formData.comment}
                      onChange={handleCommentChange}
                      placeholder="Share your experience or provide additional suggestions..."
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                    />
                  </div>

                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-extrabold text-xs uppercase tracking-widest py-4 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group disabled:opacity-75"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting Feedback...
                    </>
                  ) : (
                    <>
                      Submit Feedback
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>

              </motion.form>
            ) : (
              <motion.div
                key="feedback-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-6"
              >
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle className="w-8 h-8" />
                </div>

                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white">Thank You for Your Feedback!</h2>
                  <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                    Your rating and review has been received. This helps us ensure the highest standards of service for our customers.
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 text-left max-w-sm mx-auto flex items-center gap-4">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Your Rating</span>
                    <span className="text-3xl font-black text-amber-400 mt-1 block">{formData.rating}/5</span>
                  </div>
                  <div className="border-l border-slate-800 pl-4 space-y-1">
                    <div className="text-xs text-slate-300 font-semibold">
                      Work Quality: <span className="text-indigo-400 font-extrabold capitalize">{formData.work_quality}</span>
                    </div>
                    <div className="text-xs text-slate-300 font-semibold">
                      Resolution: <span className="text-indigo-400 font-extrabold">{formData.issue_resolved ? "Resolved" : "Unresolved"}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}
