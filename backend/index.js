const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv/config");

const prisma = require("./src/config/prisma");

const userRoutes = require("./src/routes/user.routes");
const authRoutes = require("./src/routes/auth.routes");
const cloudinaryRoutes = require("./src/routes/cloudinary.routes");
const conversationRoutes = require("./src/routes/conversation.routes");
const messageRoutes = require("./src/routes/message.routes");
const profileRoutes = require("./src/routes/profile.routes");

const registerMessageSocket = require("./src/socket/message.socket");
const registerPresenceSocket = require("./src/socket/presenceSocket");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// API ROUTES
// ==========================================

app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is healthy",
    timestamp: new Date(),
  });
});

// ==========================================
// CREATE HTTP SERVER
// ==========================================

const httpServer = http.createServer(app);

// ==========================================
// CREATE SOCKET.IO SERVER
// ==========================================

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },

  // Faster detection of dropped connections
  // (defaults are 25000 and 20000)
  pingInterval: 10000, // ping every 10 seconds
  pingTimeout: 5000, // wait 5 seconds for a reply
});

// ==========================================
// SOCKET CONNECTION
// ==========================================

io.on("connection", (socket) => {
  try {
    // Get JWT token sent by React
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.log("Socket connection rejected: No token");
      socket.disconnect();
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Save user id on the socket and join the user's private room
    socket.userId = decoded.userId;
    socket.join(`user:${socket.userId}`);

    // Register all socket features
    registerMessageSocket(io, socket);
    registerPresenceSocket(io, socket);
  } catch (error) {
    console.error("Socket authentication failed:", error.message);
    socket.disconnect();
  }
});

// ==========================================
// RESET PRESENCE ON SERVER START
// (if the server crashed, nobody should stay "online")
// ==========================================

prisma.user
  .updateMany({
    where: { isOnline: true },
    data: { isOnline: false },
  })
  .catch((err) => console.error("Reset presence error:", err));

// ==========================================
// START SERVER
// ==========================================

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});