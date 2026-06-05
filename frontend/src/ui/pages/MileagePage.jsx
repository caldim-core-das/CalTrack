import { useEffect, useState, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import {
  fetchTrips,
  fetchPolicies,
  fetchYTDSummary,
  createTrip,
  deleteTrip,
  approveTrip,
  rejectTrip,
  previewReimbursement,
  createFromTasks,
  createFromTransfer,
  injectPayroll,
} from "../../store/mileageSlice.js"
import { Card, Button, Input, Select, TextArea, Pill } from "../components/kit.jsx"
import {
  Car,
  Calendar,
  MapPin,
  TrendingUp,
  CheckCircle,
  XCircle,
  Plus,
  Coins,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  Search,
  CheckSquare,
  Package,
  Zap,
} from "lucide-react"

export function MileagePage() {
  const dispatch = useDispatch()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"

  // Tabs: overview | my_trips | submit_trip | approvals | reports
  const [activeTab, setActiveTab] = useState("overview")

  // Global Redux State
  const { trips, policies, ytdSummary, loading, error } = useSelector((state) => state.mileage)

  // Local state
  const [employees, setEmployees] = useState([])
  const [jobSites, setJobSites] = useState([])
  const [payrollRecords, setPayrollRecords] = useState([])
  const [activePolicy, setActivePolicy] = useState(null)
  
  // Submit Trip Form
  const [tripDate, setTripDate] = useState(new Date().toISOString().split("T")[0])
  const [fromSite, setFromSite] = useState("")
  const [toSite, setToSite] = useState("")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [distanceMiles, setDistanceMiles] = useState("")
  const [distanceKm, setDistanceKm] = useState("")
  const [odometerStart, setOdometerStart] = useState("")
  const [odometerEnd, setOdometerEnd] = useState("")
  const [purpose, setPurpose] = useState("task_travel")
  const [jurisdiction, setJurisdiction] = useState("US")
  const [notes, setNotes] = useState("")
  const [fetchingGps, setFetchingGps] = useState(false)

  const handleFetchGpsTravel = async () => {
    if (!tripDate) {
      alert("Please select a Trip Date first.")
      return
    }
    setFetchingGps(true)
    try {
      const res = await apiRequest(`/mileage/trips/fetch_gps_travel/?date=${tripDate}`)
      if (res.found) {
        setDistanceKm(res.distance_km.toString())
        setDistanceMiles(res.distance_miles.toString())
        
        // Find matching job site by name (case-insensitive)
        const matchedFrom = jobSites.find(
          (s) => s.name.toLowerCase().trim() === res.from_location.toLowerCase().trim()
        )
        if (matchedFrom) {
          setFromSite(matchedFrom.id.toString())
          setCustomFrom("")
        } else {
          setFromSite("")
          setCustomFrom(res.from_location)
        }
        
        const matchedTo = jobSites.find(
          (s) => s.name.toLowerCase().trim() === res.to_location.toLowerCase().trim()
        )
        if (matchedTo) {
          setToSite(matchedTo.id.toString())
          setCustomTo("")
        } else {
          setToSite("")
          setCustomTo(res.to_location)
        }
        
        alert(`Successfully fetched GPS travel: ${res.distance_km} km / ${res.distance_miles} miles computed.`)
      } else {
        alert(res.message || "No GPS pings found for this date.")
      }
    } catch (err) {
      console.error(err)
      alert(err.message || "Failed to fetch GPS travel data.")
    } finally {
      setFetchingGps(false)
    }
  }
  
  // Live calculation preview
  const [previewResult, setPreviewResult] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Auto-generation lists
  const [selectedTasks, setSelectedTasks] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [selectedEmployeeForTasks, setSelectedEmployeeForTasks] = useState("")
  const [transferId, setTransferId] = useState("")
  const [selectedEmployeeForTransfer, setSelectedEmployeeForTransfer] = useState("")

  // Payroll Injection Form
  const [selectedPayrollRecord, setSelectedPayrollRecord] = useState("")
  const [payrollStart, setPayrollStart] = useState("")
  const [payrollEnd, setPayrollEnd] = useState("")
  const [payrollResult, setPayrollResult] = useState(null)

  // Approval Modal Rejection Reason
  const [rejectionTripId, setRejectionTripId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")

  // Load Initial Metadata
  useEffect(() => {
    dispatch(fetchPolicies())
    dispatch(fetchTrips())
    
    // Load YTD summary for current employee
    dispatch(fetchYTDSummary())

    // Load JobSites
    apiRequest("/time/sites/")
      .then((res) => setJobSites(Array.isArray(res) ? res : unwrapResults(res)))
      .catch((err) => console.error("Failed to load job sites:", err))

    if (isAdmin) {
      // Load all employees
      apiRequest("/employees/")
        .then((res) => setEmployees(Array.isArray(res) ? res : unwrapResults(res)))
        .catch((err) => console.error("Failed to load employees:", err))

      // Load payroll records
      apiRequest("/payroll/records/")
        .then((res) => setPayrollRecords(Array.isArray(res) ? res : unwrapResults(res)))
        .catch((err) => console.error("Failed to load payroll records:", err))

      // Load tasks
      apiRequest("/tasks/admin/")
        .then((res) => setAllTasks(Array.isArray(res) ? res : unwrapResults(res)))
        .catch((err) => console.error("Failed to load tasks:", err))
    }
  }, [dispatch, isAdmin])

  // Sync Active Policy
  useEffect(() => {
    if (policies && policies.length > 0) {
      setActivePolicy(policies[0])
    }
  }, [policies])

  // Live calculation preview effect
  useEffect(() => {
    const triggerPreview = async () => {
      const milesVal = parseFloat(distanceMiles) || 0
      const kmVal = parseFloat(distanceKm) || 0
      if (milesVal <= 0 && kmVal <= 0) {
        setPreviewResult(null)
        return
      }

      setPreviewLoading(true)
      try {
        const res = await apiRequest("/mileage/trips/preview/", {
          method: "POST",
          json: {
            distance_miles: milesVal || (kmVal * 0.621371).toFixed(4),
            distance_km: kmVal || (milesVal / 0.621371).toFixed(4),
            jurisdiction: jurisdiction,
            trip_date: tripDate,
          },
        })
        if (res.success) {
          setPreviewResult(res.data)
        } else {
          setPreviewResult(null)
        }
      } catch (err) {
        console.error(err)
        setPreviewResult(null)
      } finally {
        setPreviewLoading(false)
      }
    }

    const timer = setTimeout(triggerPreview, 400)
    return () => clearTimeout(timer)
  }, [distanceMiles, distanceKm, jurisdiction, tripDate])

  const handleManualSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      trip_date: tripDate,
      from_location_name: fromSite ? jobSites.find((s) => s.id === parseInt(fromSite))?.name : customFrom,
      to_location_name: toSite ? jobSites.find((s) => s.id === parseInt(toSite))?.name : customTo,
      from_location: fromSite ? parseInt(fromSite) : null,
      to_location: toSite ? parseInt(toSite) : null,
      distance_miles: parseFloat(distanceMiles) || (parseFloat(distanceKm) * 0.621371).toFixed(4),
      distance_km: parseFloat(distanceKm) || (parseFloat(distanceMiles) / 0.621371).toFixed(4),
      odometer_start: odometerStart ? parseFloat(odometerStart) : null,
      odometer_end: odometerEnd ? parseFloat(odometerEnd) : null,
      purpose: purpose,
      jurisdiction: jurisdiction,
      employee_notes: notes,
    }

    try {
      await dispatch(createTrip(payload)).unwrap()
      // Reset form
      setFromSite("")
      setToSite("")
      setCustomFrom("")
      setCustomTo("")
      setDistanceMiles("")
      setDistanceKm("")
      setOdometerStart("")
      setOdometerEnd("")
      setNotes("")
      setPreviewResult(null)
      setActiveTab("my_trips")
      dispatch(fetchYTDSummary())
    } catch (err) {
      alert("Error: " + err)
    }
  }

  const handleCreateFromTasks = async () => {
    if (!selectedEmployeeForTasks || selectedTasks.length < 2) {
      alert("Please select an employee and at least 2 tasks in sequence.")
      return
    }
    try {
      const res = await dispatch(
        createFromTasks({
          employeeId: selectedEmployeeForTasks,
          taskIds: selectedTasks,
        })
      ).unwrap()
      alert(`Successfully generated ${res.created_trip_ids?.length || 0} trip(s).`)
      setSelectedTasks([])
      setActiveTab("my_trips")
      dispatch(fetchTrips())
    } catch (err) {
      alert("Error: " + err)
    }
  }

  const handleCreateFromTransfer = async () => {
    if (!selectedEmployeeForTransfer || !transferId) {
      alert("Please select an employee and enter an inventory transfer ID.")
      return
    }
    try {
      const res = await dispatch(
        createFromTransfer({
          transferId: parseInt(transferId),
          employeeId: selectedEmployeeForTransfer,
        })
      ).unwrap()
      if (res.created_trip_id) {
        alert("Successfully generated mileage trip from inventory transfer.")
        setTransferId("")
        setActiveTab("my_trips")
        dispatch(fetchTrips())
      }
    } catch (err) {
      alert("Error: " + err)
    }
  }

  const handleInjectPayroll = async (e) => {
    e.preventDefault()
    if (!selectedPayrollRecord || !payrollStart || !payrollEnd) {
      alert("Please specify a payroll record and period dates.")
      return
    }
    try {
      const res = await dispatch(
        injectPayroll({
          payrollRecordId: parseInt(selectedPayrollRecord),
          periodStart: payrollStart,
          periodEnd: payrollEnd,
        })
      ).unwrap()
      setPayrollResult(res)
      dispatch(fetchTrips())
    } catch (err) {
      alert("Error: " + err)
    }
  }

  const handleApprove = async (id) => {
    if (confirm("Are you sure you want to approve this mileage claim?")) {
      try {
        await dispatch(approveTrip(id)).unwrap()
        dispatch(fetchYTDSummary())
      } catch (err) {
        alert("Error: " + err)
      }
    }
  }

  const handleReject = async () => {
    if (!rejectionReason) {
      alert("Please specify a rejection reason.")
      return
    }
    try {
      await dispatch(rejectTrip({ id: rejectionTripId, reason: rejectionReason })).unwrap()
      setRejectionTripId(null)
      setRejectionReason("")
    } catch (err) {
      alert("Error: " + err)
    }
  }

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this trip request?")) {
      try {
        await dispatch(deleteTrip(id)).unwrap()
        dispatch(fetchYTDSummary())
      } catch (err) {
        alert("Error: " + err)
      }
    }
  }

  // Format currencies helper
  const getCurrencySymbol = (cur) => {
    switch (cur) {
      case "GBP":
        return "£"
      case "INR":
        return "₹"
      default:
        return "$"
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-stroke dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Car size={32} className="text-rose-500" />
            Mileage Calculator
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">
            Manage tax-compliant mileage reimbursements, preview estimates, approve claims, and export to payroll.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-stroke dark:border-slate-800 gap-1 overflow-x-auto pb-px">
        {[
          { id: "overview", label: "Overview", icon: <TrendingUp size={16} /> },
          { id: "my_trips", label: "My Trips", icon: <Car size={16} /> },
          { id: "submit_trip", label: "Submit Trip", icon: <Plus size={16} /> },
          ...(isAdmin
            ? [
                { id: "approvals", label: "Approvals Center", icon: <CheckCircle size={16} /> },
                { id: "reports", label: "Reports & Payroll", icon: <FileSpreadsheet size={16} /> },
              ]
            : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 text-xs uppercase tracking-wider font-black transition-all ${
              activeTab === tab.id
                ? "border-rose-500 text-rose-500 dark:text-rose-400 bg-rose-50/10"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* YTD Stats Cards */}
          <div className="lg:col-span-2 space-y-6">
            <Card title="Year-to-Date Reimbursement Summary">
              {ytdSummary ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Total Miles */}
                  <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-blue-600/5 border border-indigo-500/20 dark:border-indigo-500/10 shadow-sm flex flex-col justify-between h-[130px]">
                    <div className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                      Total YTD Miles
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                      {parseFloat(ytdSummary.total_miles || 0).toFixed(1)} <span className="text-sm font-bold opacity-60">mi</span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                      Tax Year: {ytdSummary.tax_year}
                    </div>
                  </div>

                  {/* High Rate / Low Rate breakdown */}
                  <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-600/5 border border-pink-500/20 dark:border-pink-500/10 shadow-sm flex flex-col justify-between h-[130px]">
                    <div className="text-[11px] font-black text-pink-600 dark:text-pink-400 uppercase tracking-widest">
                      HMRC Approved Rates
                    </div>
                    <div className="flex flex-col mt-2">
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        High Rate: {parseFloat(ytdSummary.miles_at_high_rate || 0).toFixed(1)} mi
                      </div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        Low Rate: {parseFloat(ytdSummary.miles_at_low_rate || 0).toFixed(1)} mi
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      Remaining at High Rate: {ytdSummary.miles_remaining_at_high_rate != null ? `${parseFloat(ytdSummary.miles_remaining_at_high_rate).toFixed(1)} mi` : "N/A"}
                    </div>
                  </div>

                  {/* Total Reimbursements */}
                  <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 dark:border-emerald-500/10 shadow-sm flex flex-col justify-between h-[130px]">
                    <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      Total YTD Reimbursed
                    </div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                      {getCurrencySymbol(ytdSummary.jurisdiction === "UK" ? "GBP" : ytdSummary.jurisdiction === "IN" ? "INR" : "USD")}
                      {parseFloat(ytdSummary.total_reimbursed_gbp || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                      Jurisdiction: {ytdSummary.jurisdiction}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 font-bold uppercase tracking-wider text-xs">
                  No YTD logs found. Submit a trip to build tracking.
                </div>
              )}
            </Card>

            <Card title="Organization Mileage Policies">
              {activePolicy ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-stroke dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">US (IRS Rate)</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        ${parseFloat(activePolicy.rate_per_mile_usd).toFixed(4)} <span className="text-[11px] opacity-60">/ mile</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-stroke dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">UK (HMRC Banded)</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        £{parseFloat(activePolicy.rate_per_mile_gbp_first).toFixed(2)} / £{parseFloat(activePolicy.rate_per_mile_gbp_after).toFixed(2)}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-1">10k miles threshold, starting April 6</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-stroke dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">India (INR per Km)</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        ₹{parseFloat(activePolicy.rate_per_km_inr).toFixed(2)} <span className="text-[11px] opacity-60">/ km</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-slate-950/20 border border-stroke dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-indigo-500" />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Require receipt above: {activePolicy.require_receipt_above_miles ? `${activePolicy.require_receipt_above_miles} mi` : "None"} | Auto-approve below: {activePolicy.auto_approve_below_miles ? `${activePolicy.auto_approve_below_miles} mi` : "None"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 font-bold uppercase tracking-wider text-xs">
                  No policy configured. Contact administrator.
                </div>
              )}
            </Card>
          </div>

          {/* Quick Guide Card */}
          <div className="space-y-6">
            <Card title="Mileage Guide">
              <ul className="space-y-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span>
                    <strong>IRS Guidelines:</strong> Reimbursed flat per-mile. Odometer readings or map coordinates must match the claim.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span>
                    <strong>HMRC 10,000 Mile Banding:</strong> The first 10,000 miles in a UK tax year (starting April 6) are reimbursed at 45p. Subsequent miles drop to 25p.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span>
                    <strong>Integration with Time & Task:</strong> When an admin approves a mileage trip, a corresponding travel timelog is generated automatically (calculated at 50 km/h) to capture FLSA/WTR compensable travel hours.
                  </span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* My Trips Tab */}
      {activeTab === "my_trips" && (
        <Card title="Mileage Trip Claims">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
          ) : trips && trips.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Trip Date</th>
                    <th className="px-6 py-4">Route / Locations</th>
                    <th className="px-6 py-4 text-right">Distance</th>
                    <th className="px-6 py-4 text-right">Reimbursement</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-slate-800">
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{trip.employee_name}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">ID: {trip.employee_id_code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          {trip.trip_date}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-1 max-w-xs">
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-rose-500 shrink-0" />
                            <strong>From: </strong> {trip.from_location_name || "Custom Lat/Lng"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-emerald-500 shrink-0" />
                            <strong>To: </strong> {trip.to_location_name || "Custom Lat/Lng"}
                          </span>
                          {trip.employee_notes && (
                            <span className="text-[10px] text-slate-400 italic font-medium mt-1">"{trip.employee_notes}"</span>
                          )}
                          {trip.rejection_reason && (
                            <span className="text-[10px] text-red-500 font-bold mt-1">Rejection reason: "{trip.rejection_reason}"</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{parseFloat(trip.distance_miles).toFixed(1)} mi</span>
                          <span className="text-[9px] text-slate-400 font-medium">({parseFloat(trip.distance_km).toFixed(1)} km)</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {getCurrencySymbol(trip.currency)}
                            {parseFloat(trip.reimbursement_amount).toFixed(2)}
                          </span>
                          {trip.jurisdiction === "UK" && (
                            <span className="text-[9px] text-slate-400 font-medium">
                              Rate: £{parseFloat(trip.rate_applied).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Pill
                          tone={
                            trip.approval_status === "approved"
                              ? "good"
                              : trip.approval_status === "paid"
                              ? "good"
                              : trip.approval_status === "rejected"
                              ? "bad"
                              : "warn"
                          }
                        >
                          {trip.approval_status}
                        </Pill>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {trip.approval_status === "pending" && (
                          <Button variant="danger" onClick={() => handleDelete(trip.id)} className="px-3 py-1.5">
                            Delete
                          </Button>
                        )}
                        {trip.approval_status !== "pending" && (
                          <span className="text-slate-300 dark:text-slate-700 text-xs font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
              No mileage claims found. Submit one under the 'Submit Trip' tab.
            </div>
          )}
        </Card>
      )}

      {/* Submit Trip Tab */}
      {activeTab === "submit_trip" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Submit Forms */}
          <div className="lg:col-span-2 space-y-6">
            <Card title="Submit Mileage Reimbursement Request">
              <form onSubmit={handleManualSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date */}
                  <div className="flex flex-col gap-2">
                    <Input
                      label="Trip Date"
                      type="date"
                      value={tripDate}
                      onChange={(e) => setTripDate(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleFetchGpsTravel}
                      disabled={fetchingGps}
                      className="px-4 py-2 text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm border border-rose-100 dark:border-rose-900/30 uppercase tracking-wider"
                    >
                      {fetchingGps ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Fetching GPS Travel…</span>
                        </>
                      ) : (
                        <>
                          <Zap size={12} />
                          <span>Auto-Fetch My GPS Travel</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Jurisdiction */}
                  <Select
                    label="Jurisdiction / Region"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    options={[
                      { value: "US", label: "United States (IRS Rate)" },
                      { value: "UK", label: "United Kingdom (HMRC Banded)" },
                      { value: "IN", label: "India (INR Rate)" },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* From Site */}
                  <Select
                    label="From Job Site"
                    value={fromSite}
                    onChange={(e) => setFromSite(e.target.value)}
                    options={[
                      { value: "", label: "-- Custom Address (Type Below) --" },
                      ...jobSites.map((site) => ({ value: site.id.toString(), label: site.name })),
                    ]}
                  />

                  {/* To Site */}
                  <Select
                    label="To Job Site"
                    value={toSite}
                    onChange={(e) => setToSite(e.target.value)}
                    options={[
                      { value: "", label: "-- Custom Address (Type Below) --" },
                      ...jobSites.map((site) => ({ value: site.id.toString(), label: site.name })),
                    ]}
                  />
                </div>

                {(!fromSite || !toSite) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {!fromSite && (
                      <Input
                        label="Custom From Address"
                        placeholder="e.g. 123 Main St, London"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        required
                      />
                    )}
                    {!toSite && (
                      <Input
                        label="Custom To Address"
                        placeholder="e.g. 456 Kings Rd, London"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        required
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Distance Input */}
                  <Input
                    label="Distance (Miles)"
                    type="number"
                    step="0.01"
                    placeholder="Enter miles"
                    value={distanceMiles}
                    onChange={(e) => {
                      setDistanceMiles(e.target.value)
                      if (e.target.value) {
                        setDistanceKm((parseFloat(e.target.value) / 0.621371).toFixed(2))
                      } else {
                        setDistanceKm("")
                      }
                    }}
                  />

                  <Input
                    label="Distance (Kilometers)"
                    type="number"
                    step="0.01"
                    placeholder="Enter km"
                    value={distanceKm}
                    onChange={(e) => {
                      setDistanceKm(e.target.value)
                      if (e.target.value) {
                        setDistanceMiles((parseFloat(e.target.value) * 0.621371).toFixed(2))
                      } else {
                        setDistanceMiles("")
                      }
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Odometer readings */}
                  <Input
                    label="Starting Odometer (Optional)"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 12450.5"
                    value={odometerStart}
                    onChange={(e) => setOdometerStart(e.target.value)}
                  />

                  <Input
                    label="Ending Odometer (Optional)"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 12510.2"
                    value={odometerEnd}
                    onChange={(e) => {
                      setOdometerEnd(e.target.value)
                      if (e.target.value && odometerStart) {
                        const calculatedDist = parseFloat(e.target.value) - parseFloat(odometerStart)
                        if (calculatedDist > 0) {
                          setDistanceMiles(calculatedDist.toFixed(1))
                          setDistanceKm((calculatedDist / 0.621371).toFixed(2))
                        }
                      }
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Purpose */}
                  <Select
                    label="Trip Purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    options={[
                      { value: "task_travel", label: "Task Travel" },
                      { value: "tool_collection", label: "Tool Collection" },
                      { value: "emergency", label: "Emergency Callout" },
                      { value: "training", label: "Training" },
                      { value: "client_visit", label: "Client Visit" },
                    ]}
                  />
                </div>

                <TextArea
                  label="Employee Notes"
                  placeholder="Reason for travel, job order numbers, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <Button type="submit" className="w-full">
                  Submit Claim Request
                </Button>
              </form>
            </Card>

            {isAdmin && (
              <div className="space-y-6">
                {/* Auto Generation Card from Tasks */}
                <Card title="Auto-Generate Trips from Task Sequences">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Select
                        label="Select Employee"
                        value={selectedEmployeeForTasks}
                        onChange={(e) => setSelectedEmployeeForTasks(e.target.value)}
                        options={[
                          { value: "", label: "-- Choose Employee --" },
                          ...employees.map((emp) => ({
                            value: emp.id.toString(),
                            label: emp.user?.first_name ? `${emp.user.first_name} ${emp.user.last_name}` : emp.user.username,
                          })),
                        ]}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                        Select Tasks in Scheduled Order (Minimum 2)
                      </label>
                      <div className="max-h-[200px] overflow-y-auto border border-stroke dark:border-slate-800 rounded-2xl p-4 space-y-2 bg-slate-50 dark:bg-slate-900">
                        {allTasks.map((task) => (
                          <label key={task.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={selectedTasks.includes(task.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTasks([...selectedTasks, task.id])
                                } else {
                                  setSelectedTasks(selectedTasks.filter((id) => id !== task.id))
                                }
                              }}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                            />
                            <div className="flex flex-col">
                              <span>#{task.id} - {task.title}</span>
                              <span className="text-[10px] text-slate-400">Scheduled: {task.scheduled_start || "Unscheduled"}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <Button onClick={handleCreateFromTasks} className="w-full">
                      Generate Sequence Trips
                    </Button>
                  </div>
                </Card>

                {/* Auto Generation Card from Inventory Transfer */}
                <Card title="Auto-Generate Trip from Inventory Transfer">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Select
                        label="Select Employee"
                        value={selectedEmployeeForTransfer}
                        onChange={(e) => setSelectedEmployeeForTransfer(e.target.value)}
                        options={[
                          { value: "", label: "-- Choose Employee --" },
                          ...employees.map((emp) => ({
                            value: emp.id.toString(),
                            label: emp.user?.first_name ? `${emp.user.first_name} ${emp.user.last_name}` : emp.user.username,
                          })),
                        ]}
                      />
                      <Input
                        label="Inventory Transfer ID"
                        type="number"
                        placeholder="Enter transfer ID"
                        value={transferId}
                        onChange={(e) => setTransferId(e.target.value)}
                      />
                    </div>

                    <Button onClick={handleCreateFromTransfer} className="w-full">
                      Generate Transfer Trip
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Live Preview Panel */}
          <div className="space-y-6">
            <Card title="Calculation Preview">
              {previewLoading ? (
                <div className="flex justify-center items-center py-12">
                  <RefreshCw size={24} className="animate-spin text-slate-400" />
                </div>
              ) : previewResult ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="text-center p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 shadow-inner">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated Reimbursement</div>
                    <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                      {getCurrencySymbol(previewResult.currency)}
                      {parseFloat(previewResult.reimbursement_amount).toFixed(2)}
                    </div>
                  </div>

                  <div className="space-y-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {previewResult.ytd_miles_before !== undefined && (
                      <div className="flex justify-between border-b border-stroke dark:border-slate-800 pb-2">
                        <span>YTD Miles Claimed:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {parseFloat(previewResult.ytd_miles_before).toFixed(1)} mi
                        </span>
                      </div>
                    )}
                    {previewResult.miles_at_high_rate !== undefined && parseFloat(previewResult.miles_at_high_rate) > 0 && (
                      <div className="flex justify-between border-b border-stroke dark:border-slate-800 pb-2">
                        <span>High Rate Miles:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {parseFloat(previewResult.miles_at_high_rate).toFixed(1)} mi
                        </span>
                      </div>
                    )}
                    {previewResult.miles_at_low_rate !== undefined && parseFloat(previewResult.miles_at_low_rate) > 0 && (
                      <div className="flex justify-between border-b border-stroke dark:border-slate-800 pb-2 text-rose-500">
                        <span>Low Rate Miles (Post 10k):</span>
                        <span className="font-bold">
                          {parseFloat(previewResult.miles_at_low_rate).toFixed(1)} mi
                        </span>
                      </div>
                    )}
                    {previewResult.is_taxable_excess && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                        ⚠️ This trip crosses the UK threshold. Low-rate portion is taxable.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                  Enter trip distance to preview estimate.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && isAdmin && (
        <Card title="Pending Mileage Claims Center">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
          ) : trips && trips.filter((t) => t.approval_status === "pending").length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Claim Date</th>
                    <th className="px-6 py-4">Route Details</th>
                    <th className="px-6 py-4 text-right">Distance</th>
                    <th className="px-6 py-4 text-right">Reimbursement</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-slate-800">
                  {trips
                    .filter((trip) => trip.approval_status === "pending")
                    .map((trip) => (
                      <tr key={trip.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{trip.employee_name}</span>
                            <span className="text-[9px] text-slate-400 uppercase tracking-tight">ID: {trip.employee_id_code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {trip.trip_date}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <div className="flex flex-col gap-1">
                            <span><strong>From: </strong> {trip.from_location_name}</span>
                            <span><strong>To: </strong> {trip.to_location_name}</span>
                            {trip.employee_notes && (
                              <span className="text-[10px] text-slate-400 italic mt-1">"{trip.employee_notes}"</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                          {parseFloat(trip.distance_miles).toFixed(1)} mi
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {getCurrencySymbol(trip.currency)}
                            {parseFloat(trip.reimbursement_amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <Button onClick={() => handleApprove(trip.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                              Approve
                            </Button>
                            <Button
                              onClick={() => {
                                setRejectionTripId(trip.id)
                              }}
                              variant="danger"
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
              No pending mileage claims to approve. Great job!
            </div>
          )}

          {/* Rejection Modal */}
          {rejectionTripId && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-stroke dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight">Reject Mileage Claim</h3>
                <TextArea
                  label="Rejection Reason"
                  placeholder="Specify why this claim is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="ghost" onClick={() => setRejectionTripId(null)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleReject}>
                    Reject Claim
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Reports & Payroll Tab */}
      {activeTab === "reports" && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Payroll Injection Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card title="Export Reimbursable Mileage to Payroll">
              <form onSubmit={handleInjectPayroll} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select
                    label="Select Payroll Record"
                    value={selectedPayrollRecord}
                    onChange={(e) => setSelectedPayrollRecord(e.target.value)}
                    options={[
                      { value: "", label: "-- Choose Record --" },
                      ...payrollRecords.map((rec) => ({
                        value: rec.id.toString(),
                        label: `Record #${rec.id} - ${rec.employee?.user ? `${rec.employee.user.first_name} ${rec.employee.user.last_name}` : rec.employee_id} (${rec.period?.start_date} to ${rec.period?.end_date})`,
                      })),
                    ]}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Period Start"
                    type="date"
                    value={payrollStart}
                    onChange={(e) => setPayrollStart(e.target.value)}
                    required
                  />
                  <Input
                    label="Period End"
                    type="date"
                    value={payrollEnd}
                    onChange={(e) => setPayrollEnd(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  Inject Mileage Reimbursements
                </Button>
              </form>
            </Card>

            {payrollResult && (
              <Card title="Payroll Export Result" className="animate-in slide-in-from-bottom duration-300">
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle size={18} />
                    Successfully updated Payroll Record #{payrollResult.payroll_record_id}!
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-xs font-semibold">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-stroke dark:border-slate-800">
                      <div className="text-slate-400">Trips Linked</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {payrollResult.injected}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-stroke dark:border-slate-800">
                      <div className="text-slate-400">Total Reimbursements</div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        ${parseFloat(payrollResult.total_usd || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-stroke dark:border-slate-800">
                      <div className="text-slate-400">Total GBP</div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        £{parseFloat(payrollResult.total_gbp || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Org Statistics Summary */}
          <div className="space-y-6">
            <Card title="Mileage Claim Overview">
              <div className="space-y-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-stroke dark:border-slate-800 pb-2">
                  <span>Total Organization Trips:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {trips?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between border-b border-stroke dark:border-slate-800 pb-2">
                  <span>Pending Approval:</span>
                  <span className="font-bold text-amber-600">
                    {trips?.filter((t) => t.approval_status === "pending").length || 0}
                  </span>
                </div>
                <div className="flex justify-between border-b border-stroke dark:border-slate-800 pb-2">
                  <span>Approved & Paid:</span>
                  <span className="font-bold text-emerald-600">
                    {trips?.filter((t) => t.approval_status === "approved" || t.approval_status === "paid").length || 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
