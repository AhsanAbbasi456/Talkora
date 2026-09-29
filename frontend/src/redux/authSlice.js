import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API_BASE_URL = "http://localhost:3000/api";

// ==========================================
// REGISTER USER
// ==========================================
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: userData.name,
            email: userData.email,
            password: userData.password,
            otp: userData.otp || "",
            picture: userData.picture || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(
          data.message || "Registration failed"
        );
      }

      return {
        user: data.user,
        token: data.token,
      };
    } catch (error) {
      console.error("Registration error:", error);

      return rejectWithValue(
        "Registration failed"
      );
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
        `${API_BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: loginData.email,
            password: loginData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(
          data.message ||
            "Invalid email or password"
        );
      }

      return {
        user: data.user,
        token: data.token,
      };
    } catch (error) {
      console.error("Login error:", error);

      return rejectWithValue("Login failed");
    }
  }
);

// ==========================================
// GOOGLE LOGIN
// ==========================================
export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async (accessToken, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/google`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(
          data.message || "Google login failed"
        );
      }

      return {
        user: data.user,
        token: data.token,
      };
    } catch (error) {
      console.error(
        "Google login error:",
        error
      );

      return rejectWithValue(
        "Google login failed"
      );
    }
  }
);

// ==========================================
// CLEAR STORED AUTH
// ==========================================
const clearStoredAuth = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
};

// ==========================================
// GET STORED AUTH
// ==========================================
const getStoredAuth = () => {
  try {
    const savedUser =
      localStorage.getItem("user");

    const savedToken =
      localStorage.getItem("token");

    if (!savedUser || !savedToken) {
      return {
        user: null,
        token: null,
        isAuthenticated: false,
      };
    }

    return {
      user: JSON.parse(savedUser),
      token: savedToken,
      isAuthenticated: true,
    };
  } catch (error) {
    clearStoredAuth();

    return {
      user: null,
      token: null,
      isAuthenticated: false,
    };
  }
};

const storedAuth = getStoredAuth();

// ==========================================
// INITIAL STATE
// ==========================================
const initialState = {
  user: storedAuth.user,
  token: storedAuth.token,
  isAuthenticated: storedAuth.isAuthenticated,
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
    // ======================================
    // LOGOUT
    // ======================================
    logoutUser: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.loading = false;

      clearStoredAuth();
    },

    // ======================================
    // CLEAR ERROR
    // ======================================
    clearError: (state) => {
      state.error = null;
    },

    // ======================================
    // UPDATE USER
    // ======================================
    updateUser: (state, action) => {
      state.user = {
        ...state.user,
        ...action.payload,
      };

      localStorage.setItem(
        "user",
        JSON.stringify(state.user)
      );
    },
  },

  extraReducers: (builder) => {
    builder

      // ====================================
      // REGISTER - PENDING
      // ====================================
      .addCase(
        registerUser.pending,
        (state) => {
          state.loading = true;
          state.error = null;
        }
      )

      // ====================================
      // REGISTER - SUCCESS
      // ====================================
      .addCase(
        registerUser.fulfilled,
        (state, action) => {
          state.loading = false;

          state.user =
            action.payload.user;

          state.token =
            action.payload.token;

          state.isAuthenticated =
            !!action.payload.token;

          state.error = null;

          localStorage.setItem(
            "user",
            JSON.stringify(
              action.payload.user
            )
          );

          localStorage.setItem(
            "token",
            action.payload.token || ""
          );
        }
      )

      // ====================================
      // REGISTER - FAILED
      // ====================================
      .addCase(
        registerUser.rejected,
        (state, action) => {
          state.loading = false;
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;

          state.error =
            action.payload ||
            "Registration failed";

          clearStoredAuth();
        }
      )

      // ====================================
      // LOGIN - PENDING
      // ====================================
      .addCase(
        loginUser.pending,
        (state) => {
          state.loading = true;
          state.error = null;
        }
      )

      // ====================================
      // LOGIN - SUCCESS
      // ====================================
      .addCase(
        loginUser.fulfilled,
        (state, action) => {
          state.loading = false;

          state.user =
            action.payload.user;

          state.token =
            action.payload.token;

          state.isAuthenticated = true;

          state.error = null;

          localStorage.setItem(
            "user",
            JSON.stringify(
              action.payload.user
            )
          );

          localStorage.setItem(
            "token",
            action.payload.token
          );
        }
      )

      // ====================================
      // LOGIN - FAILED
      // ====================================
      .addCase(
        loginUser.rejected,
        (state, action) => {
          state.loading = false;

          state.error =
            action.payload ||
            "Login failed";
        }
      )

      // ====================================
      // GOOGLE LOGIN - PENDING
      // ====================================
      .addCase(
        googleLogin.pending,
        (state) => {
          state.loading = true;
          state.error = null;
        }
      )

      // ====================================
      // GOOGLE LOGIN - SUCCESS
      // ====================================
      .addCase(
        googleLogin.fulfilled,
        (state, action) => {
          state.loading = false;

          state.user =
            action.payload.user;

          state.token =
            action.payload.token;

          state.isAuthenticated = true;

          state.error = null;

          localStorage.setItem(
            "user",
            JSON.stringify(
              action.payload.user
            )
          );

          localStorage.setItem(
            "token",
            action.payload.token
          );
        }
      )

      // ====================================
      // GOOGLE LOGIN - FAILED
      // ====================================
      .addCase(
        googleLogin.rejected,
        (state, action) => {
          state.loading = false;

          state.error =
            action.payload ||
            "Google login failed";
        }
      );
  },
});

// ==========================================
// EXPORT ACTIONS
// ==========================================
export const {
  logoutUser,
  clearError,
  updateUser,
} = authSlice.actions;

// ==========================================
// EXPORT REDUCER
// ==========================================
export default authSlice.reducer;