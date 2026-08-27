import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// ==========================================
// REGISTER USER
// ==========================================

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/register",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(userData),
        }
      );

      const data = await response.json();

      // If backend returns an error
      if (!response.ok) {
        return rejectWithValue(data.message);
      }

      return data;
    } catch (error) {
      return rejectWithValue("Unable to connect to server");
    }
  }
);

// ==========================================
// LOGIN USER
// ==========================================

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (loginData, { rejectWithValue }) => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(loginData),
        }
      );

      const data = await response.json();

      // If backend returns an error
      if (!response.ok) {
        return rejectWithValue(data.message);
      }

      return data;
    } catch (error) {
      return rejectWithValue("Unable to connect to server");
    }
  }
);

// ==========================================
// GET SAVED AUTH DATA
// ==========================================

const savedUser = localStorage.getItem("user");
const savedToken = localStorage.getItem("token");

// ==========================================
// INITIAL STATE
// ==========================================

const initialState = {
  user: savedUser ? JSON.parse(savedUser) : null,

  token: savedToken || null,

  isAuthenticated: !!savedToken,

  loading: false,

  error: null,
};

// ==========================================
// AUTH SLICE
// ==========================================

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    logoutUser: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;

      // Remove saved login data
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    },

    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // ==========================================
    // REGISTER
    // ==========================================

    builder

      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;

        state.user = action.payload.user;

        state.error = null;
      })

      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;

        state.error = action.payload;
      });

    // ==========================================
    // LOGIN
    // ==========================================

    builder

      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;

        state.user = action.payload.user;

        state.token = action.payload.token;

        state.isAuthenticated = true;

        state.error = null;

        // Save login data in browser
        localStorage.setItem(
          "user",
          JSON.stringify(action.payload.user)
        );

        localStorage.setItem(
          "token",
          action.payload.token
        );
      })

      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;

        state.error = action.payload;

        state.isAuthenticated = false;
      });
  },
});

export const {
  logoutUser,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;