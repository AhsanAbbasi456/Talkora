import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../utils/api";
import { logoutUser } from "./authSlice";

// The user's plan (Free / Plus) and the Upgrade window
export const fetchPlan = createAsyncThunk("plan/fetch", (token) => api("/payments/me", token));

const initialState = {
  loaded: false,
  isPlus: false,
  plusUntil: null,
  limits: { aiPerDay: 10, maxFileMB: 10 },
  aiUsedToday: 0,
  upgradeFeature: null, // e.g. "Summarize" while the Upgrade window is open
};

const planSlice = createSlice({
  name: "plan",
  initialState,
  reducers: {
    openUpgrade: (state, action) => {
      state.upgradeFeature = action.payload || "Talkora Plus";
    },
    closeUpgrade: (state) => {
      state.upgradeFeature = null;
    },
    resetPlan: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(logoutUser, () => initialState);
    builder.addCase(fetchPlan.fulfilled, (state, { payload }) => {
      state.loaded = true;
      state.isPlus = payload.isPlus;
      state.plusUntil = payload.plusUntil;
      state.limits = payload.limits;
      state.aiUsedToday = payload.aiUsedToday;
    });
  },
});

export const { openUpgrade, closeUpgrade, resetPlan } = planSlice.actions;
export default planSlice.reducer;
