import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest } from "../api/client.js"; // existing API client

export const fetchTrialStatus = createAsyncThunk(
  "trial/fetchStatus",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiRequest("/trial/status/");
      return res.data;
    } catch (e) {
      return rejectWithValue(null);
    }
  }
);

export const fetchTrialNotifications = createAsyncThunk(
  "trial/fetchNotifications",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiRequest("/trial/notifications/");
      return res.data;
    } catch (e) {
      return rejectWithValue([]);
    }
  }
);

const trialSlice = createSlice({
  name: "trial",
  initialState: {
    status: null,       // "active" | "expired" | "converted" | null
    daysRemaining: null,
    trialEnd: null,
    isActive: false,
    notifications: [],
    loading: false,
  },
  reducers: {
    clearTrialNotifications(state) {
      state.notifications = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrialStatus.pending, (s) => { s.loading = true; })
      .addCase(fetchTrialStatus.fulfilled, (s, a) => {
        s.loading = false;
        if (a.payload) {
          s.status = a.payload.status;
          s.daysRemaining = a.payload.days_remaining;
          s.trialEnd = a.payload.trial_end;
          s.isActive = a.payload.is_active;
        }
      })
      .addCase(fetchTrialStatus.rejected, (s) => { s.loading = false; })
      .addCase(fetchTrialNotifications.fulfilled, (s, a) => {
        s.notifications = a.payload || [];
      });
  },
});

export const { clearTrialNotifications } = trialSlice.actions;
export default trialSlice.reducer;
