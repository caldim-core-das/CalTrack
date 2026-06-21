import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Wrench, User, Calendar, MapPin, CheckCircle2, ShieldAlert, AlertCircle, RefreshCw, Star, Upload, ArrowRight, Play, CheckCircle, Ban, FileText, LayoutGrid, Award, CheckSquare, BarChart3, Loader2, Phone, Eye } from "lucide-react"
import { apiRequest } from "../../api/client.js"

const JOB_STATUSES = {
  assigned: { bg: "bg-blue-500/10 text-blue-400 border-blue-500/20", name: "Assigned" },
  accepted: { bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", name: "Accepted" },
  in_progress: { bg: "bg-orange-500/10 text-orange-400 border-orange-500/20", name: "In Progress" },
  completed: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", name: "Completed" },
  rejected: { bg: "bg-rose-500/10 text-rose-400 border-rose-500/20", name: "Rejected" },
}

export function EmployeeJobsPage() {
  const [activeTab, setActiveTab] = useState("jobs") // jobs, performance
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [jobDetail, setJobDetail] = useState(null)
  const [performance, setPerformance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [perfLoading, setPerfLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")

  // Proof upload form
  const [proofNote, setProofNote] = useState("")
  const [proofFile, setProofFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(false)

  // Fetch jobs list
  const loadJobs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append("status", statusFilter)
      const response = await apiRequest(`/employee/jobs/?${params.toString()}`)
      if (response?.success) {
        setJobs(response.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch employee performance
  const loadPerformance = async () => {
    setPerfLoading(true)
    try {
      const response = await apiRequest("/employee/performance/")
      if (response?.success) {
        setPerformance(response.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPerfLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [statusFilter])

  useEffect(() => {
    if (activeTab === "performance") {
      loadPerformance()
    }
  }, [activeTab])

  // Fetch job detail
  useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null)
      return
    }
    let active = true
    setDetailLoading(true)
    apiRequest(`/employee/jobs/${selectedJobId}/`)
      .then((res) => {
        if (!active) return
        if (res?.success) setJobDetail(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedJobId])

  const handleJobAction = async (actionPath) => {
    setActionLoading(true)
    try {
      const response = await apiRequest(`/employee/jobs/${selectedJobId}/${actionPath}`, {
        method: "PATCH",
      })
      if (response?.success) {
        alert(response.message || "Job status updated.")
        // Refresh details & list
        const detailRes = await apiRequest(`/employee/jobs/${selectedJobId}/`)
        if (detailRes?.success) setJobDetail(detailRes.data)
        loadJobs()
      }
    } catch (err) {
      console.error(err)
      alert(err?.body?.message || err?.body?.detail || "Action failed.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleProofSubmit = async (e) => {
    e.preventDefault()
    if (!proofFile) {
      alert("Please select a file to upload.")
      return
    }
    setUploadProgress(true)

    const formData = new FormData()
    formData.append("note", proofNote)
    formData.append("photo", proofFile)

    try {
      const response = await apiRequest(`/employee/jobs/${selectedJobId}/proof/`, {
        method: "POST",
        body: formData,
      })
      if (response?.success) {
        alert("Verification proof uploaded successfully.")
        setProofNote("")
        setProofFile(null)
        // Refresh details
        const detailRes = await apiRequest(`/employee/jobs/${selectedJobId}/`)
        if (detailRes?.success) setJobDetail(detailRes.data)
      }
    } catch (err) {
      console.error(err)
      alert(err?.body?.message || err?.body?.detail || "Upload failed.")
    } finally {
      setUploadProgress(false)
    }
  }

  const renderRatingStars = (score) => {
    const num = Math.round(score || 0)
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-4 h-4 ${
              s <= num ? "fill-amber-400 text-amber-400" : "text-slate-700"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-bg text-fg font-body">
      {/* Page Header with Tabs */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-stroke dark:border-slate-800 shrink-0 bg-surface/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("jobs")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === "jobs"
                ? "bg-indigo-600/10 text-indigo-500 border border-indigo-600/20"
                : "text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            Assigned Jobs Board
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === "performance"
                ? "bg-indigo-600/10 text-indigo-500 border border-indigo-600/20"
                : "text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 border border-transparent"
            }`}
          >
            My Performance Stats
          </button>
        </div>

        <button
          onClick={loadJobs}
          className="flex items-center gap-2 px-4 py-2 bg-surface dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-stroke dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors duration-300 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Refresh</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "jobs" ? (
            <motion.div
              key="tab-jobs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-[350px_1fr] h-full divide-x divide-stroke dark:divide-slate-800"
            >
              {/* Left Column: Job Cards List */}
              <div className="flex flex-col h-full overflow-hidden bg-surface2/50 dark:bg-slate-950/20">
                <div className="p-4 border-b border-stroke dark:border-slate-800">
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-surface dark:bg-slate-900 border border-stroke dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none transition-all cursor-pointer shadow-sm"
                    >
                      <option value="">All Jobs Statuses</option>
                      <option value="assigned">Assigned</option>
                      <option value="accepted">Accepted</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Scrollable list of job cards */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center p-8 gap-3 text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Loading Jobs...</span>
                    </div>
                  ) : jobs.length === 0 ? (
                    <div className="text-center text-xs font-bold text-slate-500 p-8 uppercase tracking-widest border border-dashed border-stroke dark:border-slate-800 rounded-2xl bg-surface/50 dark:bg-slate-900/50">
                      No jobs assigned.
                    </div>
                  ) : (
                    jobs.map((job) => {
                      const isActive = selectedJobId === job.id
                      return (
                        <button
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-2 relative overflow-hidden group shadow-sm ${
                            isActive
                              ? "bg-indigo-600/5 dark:bg-indigo-500/5 border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500 dark:ring-indigo-400"
                              : "bg-surface dark:bg-slate-900 border-stroke dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:shadow-md"
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
                              {job.service_request?.request_id}
                            </span>
                            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500">
                              {new Date(job.assigned_date).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {job.service_request?.issue_title}
                          </h4>
                          <div className="flex justify-between items-center w-full mt-2">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${JOB_STATUSES[job.status]?.bg || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {JOB_STATUSES[job.status]?.name || job.status}
                            </span>
                          </div>
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 dark:bg-indigo-400" />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Job Details Pane */}
              <div className="flex-1 overflow-y-auto bg-surface dark:bg-slate-950/40 p-6 md:p-8">
                <AnimatePresence mode="wait">
                  {detailLoading ? (
                    <motion.div
                      key="job-detail-loader"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-3 text-slate-500"
                    >
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                      <span className="text-xs font-black uppercase tracking-widest">Loading job details...</span>
                    </motion.div>
                  ) : !jobDetail ? (
                    <motion.div
                      key="job-no-selection"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                        <LayoutGrid className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">Select a Job Card</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                          Choose an assigned field task to inspect client details, location coordinates, upload verification proofs, or complete task states.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="job-detail-content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      
                      {/* Job details header */}
                      <div className="flex justify-between items-start pb-5 border-b border-slate-800">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                              {jobDetail.service_request?.request_id}
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border capitalize ${JOB_STATUSES[jobDetail.status]?.bg}`}>
                              {JOB_STATUSES[jobDetail.status]?.name}
                            </span>
                          </div>
                          <h2 className="text-lg font-black text-white mt-1 leading-snug">
                            {jobDetail.service_request?.issue_title}
                          </h2>
                        </div>
                      </div>

                      {/* Job Details Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Customer contact card */}
                        <div className="space-y-5">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Customer & Location Info</h3>
                            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                              <div className="flex items-center gap-3">
                                <User className="w-4 h-4 text-indigo-400 shrink-0" />
                                <div>
                                  <div className="text-xs font-extrabold text-slate-300">{jobDetail.service_request?.customer_name}</div>
                                  <div className="text-[10px] text-slate-500">Customer contact</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Phone className="w-4 h-4 text-indigo-400 shrink-0" />
                                <div>
                                  <div className="text-xs font-extrabold text-slate-300">{jobDetail.service_request?.phone}</div>
                                  <div className="text-[10px] text-slate-500">Contact number</div>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 pt-2 border-t border-slate-800/60">
                                <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                <div>
                                  <div className="text-xs font-extrabold text-slate-300 leading-relaxed">
                                    {jobDetail.service_request?.address}
                                  </div>
                                  <div className="text-[10px] text-slate-500">Service address</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Job Scheduling Details</h3>
                            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-semibold">Category</span>
                                <span className="text-slate-300 font-bold capitalize">
                                  {jobDetail.service_request?.service_category?.replace("_", " ")}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-semibold">Preferred Date</span>
                                <span className="text-slate-300 font-bold">{jobDetail.service_request?.preferred_date}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-semibold">Assigned On</span>
                                <span className="text-slate-300 font-bold">{new Date(jobDetail.assigned_date).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Customer Issue Description */}
                        <div className="space-y-5">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Customer Issue Description</h3>
                            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                              <p className="text-xs font-semibold text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {jobDetail.service_request?.description}
                              </p>
                              {jobDetail.service_request?.photo && (
                                <div className="pt-3 border-t border-slate-800/60">
                                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Customer Attached Photo</span>
                                  <a href={jobDetail.service_request.photo} target="_blank" rel="noreferrer" className="inline-block relative w-32 h-20 rounded-xl overflow-hidden border border-slate-800 group">
                                    <img src={jobDetail.service_request.photo} alt="Issue Attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye className="w-4 h-4 text-white" />
                                    </div>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Display already uploaded proofs */}
                      {jobDetail.proofs?.length > 0 && (
                        <div className="pt-4 border-t border-slate-800">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">My Uploaded Verification Proofs</h3>
                          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {jobDetail.proofs.map((proof, idx) => (
                              <div key={proof.id || idx} className="space-y-1.5">
                                {proof.photo ? (
                                  <a href={proof.photo} target="_blank" rel="noreferrer" className="block relative h-24 rounded-xl overflow-hidden border border-slate-800 group">
                                    <img src={proof.photo} alt="Completion Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye className="w-4 h-4 text-white" />
                                    </div>
                                  </a>
                                ) : (
                                  <a href={proof.document} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center h-24 bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-900 transition-colors text-slate-400 gap-1.5">
                                    <FileText className="w-6 h-6 text-indigo-400" />
                                    <span className="text-[9px] font-black uppercase tracking-wider">Document</span>
                                  </a>
                                )}
                                {proof.note && (
                                  <span className="text-[10px] text-slate-500 font-semibold block leading-snug line-clamp-1">{proof.note}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Workflow Operations Action panel */}
                      <div className="pt-5 border-t border-slate-800 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Operation Actions</h3>
                        
                        <div className="flex flex-col gap-4">
                          
                          {/* Case: Assigned state */}
                          {jobDetail.status === "assigned" && (
                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => handleJobAction("accept/")}
                                disabled={actionLoading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Accept Job Assignment
                              </button>
                              <button
                                onClick={() => handleJobAction("reject/")}
                                disabled={actionLoading}
                                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <Ban className="w-4 h-4" />
                                Reject & Re-assign
                              </button>
                            </div>
                          )}

                          {/* Case: Accepted state */}
                          {jobDetail.status === "accepted" && (
                            <button
                              onClick={() => handleJobAction("start/")}
                              disabled={actionLoading}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 self-start"
                            >
                              <Play className="w-4 h-4 fill-white" />
                              Start On-Site Work
                            </button>
                          )}

                          {/* Case: In Progress state (Form to upload proof and Complete button) */}
                          {jobDetail.status === "in_progress" && (
                            <div className="space-y-4 w-full">
                              
                              {/* Drag/Drop File Upload Form */}
                              <form onSubmit={handleProofSubmit} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                                <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wide">Upload Work Verification Proof</h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proof Note / Description</label>
                                    <input
                                      type="text"
                                      value={proofNote}
                                      onChange={(e) => setProofNote(e.target.value)}
                                      placeholder="e.g. Cleared clogging inside pipe"
                                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Photo/File</label>
                                    <div className="flex items-center gap-3">
                                      <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 px-4 py-2.5 rounded-xl cursor-pointer transition-colors text-xs font-semibold">
                                        <Upload className="w-3.5 h-3.5 text-indigo-400" />
                                        Choose File
                                        <input
                                          type="file"
                                          accept="image/*,application/pdf"
                                          onChange={(e) => setProofFile(e.target.files[0])}
                                          className="hidden"
                                        />
                                      </label>
                                      {proofFile && (
                                        <span className="text-xs font-semibold text-indigo-400 truncate max-w-[150px]">
                                          {proofFile.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  disabled={uploadProgress || !proofFile}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {uploadProgress ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3.5 h-3.5" />
                                      Upload Proof
                                    </>
                                  )}
                                </button>
                              </form>

                              {/* Complete Job Button */}
                              <div className="bg-slate-900/20 border border-slate-800/80 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-slate-300">Complete Job Card</div>
                                  <div className="text-[10px] text-slate-500">
                                    Marking complete transitions the request status. Note: you must upload at least one proof file first!
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleJobAction("complete/")}
                                  disabled={actionLoading || !jobDetail.proofs?.length}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0 self-stretch sm:self-auto justify-center"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Mark Job Completed
                                </button>
                              </div>

                            </div>
                          )}

                          {/* Case: Completed state */}
                          {jobDetail.status === "completed" && (
                            <div className="space-y-3">
                              <div className="text-xs font-bold text-emerald-500 italic">
                                This job card has been marked as Completed. Waiting for Admin verification audit.
                              </div>
                              
                              {/* Option to upload additional proof */}
                              <form onSubmit={handleProofSubmit} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                                <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wide">Upload Additional Verification Proof</h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proof Note / Description</label>
                                    <input
                                      type="text"
                                      value={proofNote}
                                      onChange={(e) => setProofNote(e.target.value)}
                                      placeholder="e.g. Extra photos of cleanup"
                                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Photo/File</label>
                                    <div className="flex items-center gap-3">
                                      <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 px-4 py-2.5 rounded-xl cursor-pointer transition-colors text-xs font-semibold">
                                        <Upload className="w-3.5 h-3.5 text-indigo-400" />
                                        Choose File
                                        <input
                                          type="file"
                                          accept="image/*,application/pdf"
                                          onChange={(e) => setProofFile(e.target.files[0])}
                                          className="hidden"
                                        />
                                      </label>
                                      {proofFile && (
                                        <span className="text-xs font-semibold text-indigo-400 truncate max-w-[150px]">
                                          {proofFile.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  disabled={uploadProgress || !proofFile}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {uploadProgress ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3.5 h-3.5" />
                                      Upload Proof
                                    </>
                                  )}
                                </button>
                              </form>
                            </div>
                          )}

                        </div>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          ) : (
            
            // TAB 2: Performance metrics pane
            <motion.div
              key="tab-performance"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 overflow-y-auto h-full custom-scrollbar"
            >
              
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  My Performance Dashboard
                </h2>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
                  Your aggregate satisfaction score, completion rate percentage, and reviews log.
                </p>
              </div>

              {perfLoading && !performance ? (
                <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-xs font-black uppercase tracking-widest">Loading Stats...</span>
                </div>
              ) : !performance ? (
                <div className="p-8 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Performance metrics not populated yet. Submit customer feedbacks to recalculate.
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* KPI Aggregates layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    
                    {/* Jobs Completed Count */}
                    <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Jobs Completed</span>
                      <h3 className="text-2xl font-black text-white mt-1.5">{performance.jobs_completed_count}</h3>
                    </div>

                    {/* Average Customer Rating */}
                    <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Average Rating</span>
                      <h3 className="text-2xl font-black text-white mt-1.5">{performance.average_rating}</h3>
                      <div className="mt-1">{renderRatingStars(performance.average_rating)}</div>
                    </div>

                    {/* Completion rate percentage */}
                    <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Completion Rate</span>
                      <h3 className="text-2xl font-black text-white mt-1.5">{performance.completion_rate}%</h3>
                    </div>

                    {/* Customer satisfaction score */}
                    <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Satisfaction Score</span>
                      <h3 className="text-2xl font-black text-white mt-1.5">{performance.customer_satisfaction_score}</h3>
                    </div>

                  </div>

                  {/* Feedback Log history */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-400" />
                        My Customer Reviews Log
                      </h3>
                      <span className="text-[10px] font-black text-slate-500 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full">
                        {performance.recent_feedback?.length || 0} reviews
                      </span>
                    </div>

                    {!performance.recent_feedback || performance.recent_feedback.length === 0 ? (
                      <div className="p-8 text-center text-xs font-bold text-slate-500 italic">
                        No customer review comments registered for you yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/60">
                        {performance.recent_feedback.map((fb, idx) => (
                          <div key={fb.id || idx} className="p-4 space-y-2 hover:bg-slate-900/10 transition-colors">
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-indigo-400">{fb.request_id}</span>
                                <span className="text-slate-500 font-semibold">•</span>
                                <span className="text-slate-500 font-semibold">{new Date(fb.submitted_at).toLocaleDateString()}</span>
                              </div>
                              {renderRatingStars(fb.rating)}
                            </div>
                            <div className="text-xs font-semibold text-slate-300 leading-snug">
                              &ldquo;{fb.comment || "No comment provided by customer."}&rdquo;
                            </div>
                            <div className="flex gap-2.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                              <span>Work quality: <strong className="text-slate-300 font-extrabold">{fb.work_quality}</strong></span>
                              <span>Technician behavior: <strong className="text-slate-300 font-extrabold">{fb.employee_behaviour}</strong></span>
                              <span className={fb.issue_resolved ? "text-emerald-400" : "text-rose-400"}>
                                {fb.issue_resolved ? "Problem Solved" : "Unresolved"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  )
}
