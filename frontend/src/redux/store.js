import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./authSlice";
import apiLoadingReducer from "./apiLoadingSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    apiLoading: apiLoadingReducer,
  },
});