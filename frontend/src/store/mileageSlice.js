import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { apiRequest, unwrapResults } from "../api/client.js"

export const fetchTrips = createAsyncThunk(
  "mileage/fetchTrips",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          queryParams.append(key, val)
        }
      })
      const queryString = queryParams.toString()
      const path = `/mileage/trips/${queryString ? `?${queryString}` : ""}`
      const response = await apiRequest(path)
      return unwrapResults(response)
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to fetch trips")
    }
  }
)

export const fetchPolicies = createAsyncThunk(
  "mileage/fetchPolicies",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiRequest("/mileage/policies/")
      return unwrapResults(response)
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to fetch policies")
    }
  }
)

export const fetchYTDSummary = createAsyncThunk(
  "mileage/fetchYTDSummary",
  async ({ employeeId, jurisdiction } = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (employeeId) queryParams.append("employee_id", employeeId)
      if (jurisdiction) queryParams.append("jurisdiction", jurisdiction)
      const queryString = queryParams.toString()
      const response = await apiRequest(`/mileage/ytd/summary/${queryString ? `?${queryString}` : ""}`)
      return response.success ? response.data : response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to fetch YTD summary")
    }
  }
)

export const createTrip = createAsyncThunk(
  "mileage/createTrip",
  async (tripData, { rejectWithValue }) => {
    try {
      const response = await apiRequest("/mileage/trips/", {
        method: "POST",
        json: tripData,
      })
      return response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to create trip")
    }
  }
)

export const updateTrip = createAsyncThunk(
  "mileage/updateTrip",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await apiRequest(`/mileage/trips/${id}/`, {
        method: "PATCH",
        json: data,
      })
      return response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to update trip")
    }
  }
)

export const deleteTrip = createAsyncThunk(
  "mileage/deleteTrip",
  async (id, { rejectWithValue }) => {
    try {
      await apiRequest(`/mileage/trips/${id}/`, {
        method: "DELETE",
      })
      return id
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to delete trip")
    }
  }
)

export const approveTrip = createAsyncThunk(
  "mileage/approveTrip",
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiRequest(`/mileage/trips/${id}/approve/`, {
        method: "POST",
      })
      return response.success ? response.data : response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to approve trip")
    }
  }
)

export const rejectTrip = createAsyncThunk(
  "mileage/rejectTrip",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const response = await apiRequest(`/mileage/trips/${id}/reject/`, {
        method: "POST",
        json: { reason },
      })
      return response.success ? response.data : response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to reject trip")
    }
  }
)

export const previewReimbursement = createAsyncThunk(
  "mileage/previewReimbursement",
  async (previewData, { rejectWithValue }) => {
    try {
      const response = await apiRequest("/mileage/trips/preview/", {
        method: "POST",
        json: previewData,
      })
      return response.success ? response.data : response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to preview reimbursement")
    }
  }
)

export const createFromTasks = createAsyncThunk(
  "mileage/createFromTasks",
  async ({ employeeId, taskIds }, { rejectWithValue }) => {
    try {
      const response = await apiRequest("/mileage/trips/create_from_tasks/", {
        method: "POST",
        json: { employee_id: employeeId, task_ids: taskIds },
      })
      return response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to create trips from tasks")
    }
  }
)

export const createFromTransfer = createAsyncThunk(
  "mileage/createFromTransfer",
  async ({ transferId, employeeId }, { rejectWithValue }) => {
    try {
      const response = await apiRequest("/mileage/trips/create_from_transfer/", {
        method: "POST",
        json: { transfer_id: transferId, employee_id: employeeId },
      })
      return response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to create trip from transfer")
    }
  }
)

export const injectPayroll = createAsyncThunk(
  "mileage/injectPayroll",
  async ({ payrollRecordId, periodStart, periodEnd }, { rejectWithValue }) => {
    try {
      const response = await apiRequest("/mileage/trips/inject_payroll/", {
        method: "POST",
        json: {
          payroll_record_id: payrollRecordId,
          period_start: periodStart,
          period_end: periodEnd,
        },
      })
      return response.success ? response.data : response
    } catch (err) {
      return rejectWithValue(err.body?.detail || err.message || "Failed to inject mileage into payroll")
    }
  }
)

const initialState = {
  trips: [],
  policies: [],
  ytdSummary: null,
  loading: false,
  error: null,
}

const mileageSlice = createSlice({
  name: "mileage",
  initialState,
  reducers: {
    clearMileageState: (state) => {
      state.trips = []
      state.policies = []
      state.ytdSummary = null
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrips.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchTrips.fulfilled, (state, action) => {
        state.loading = false
        state.trips = action.payload
      })
      .addCase(fetchTrips.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchPolicies.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchPolicies.fulfilled, (state, action) => {
        state.loading = false
        state.policies = action.payload
      })
      .addCase(fetchPolicies.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(fetchYTDSummary.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchYTDSummary.fulfilled, (state, action) => {
        state.loading = false
        state.ytdSummary = action.payload
      })
      .addCase(fetchYTDSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createTrip.fulfilled, (state, action) => {
        state.trips.unshift(action.payload)
      })
      .addCase(updateTrip.fulfilled, (state, action) => {
        const index = state.trips.findIndex((t) => t.id === action.payload.id)
        if (index !== -1) {
          state.trips[index] = action.payload
        }
      })
      .addCase(deleteTrip.fulfilled, (state, action) => {
        state.trips = state.trips.filter((t) => t.id !== action.payload)
      })
      .addCase(approveTrip.fulfilled, (state, action) => {
        const index = state.trips.findIndex((t) => t.id === action.payload.id)
        if (index !== -1) {
          state.trips[index] = action.payload
        }
      })
      .addCase(rejectTrip.fulfilled, (state, action) => {
        const index = state.trips.findIndex((t) => t.id === action.payload.id)
        if (index !== -1) {
          state.trips[index] = action.payload
        }
      })
  },
})

export const { clearMileageState } = mileageSlice.actions
export default mileageSlice.reducer
