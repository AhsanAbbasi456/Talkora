import { createSlice } from "@reduxjs/toolkit";

const apiLoadingSlice = createSlice({
  name: "apiLoading",

  initialState: {},
  // will look like: { uploadAvatar: true, login: false, fetchMessages: true }

  reducers: {
    startApiLoading: (state, action) => {
      state[action.payload] = true;
    },

    stopApiLoading: (state, action) => {
      state[action.payload] = false;
    },
  },
});

export const { startApiLoading, stopApiLoading } = apiLoadingSlice.actions;

export default apiLoadingSlice.reducer;