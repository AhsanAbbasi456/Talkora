const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path"); // NEW
const { Server } = require("socket.io");
require("dotenv/config");
const aiRoutes = require("./src/routes/ai.routes");
const prisma = require("./src/config/prisma");
const smartReplyRoutes = require("./src/routes/smartReply.routes");
const userRoutes = require("./src/routes/user.routes");
const authRoutes = require("./src/routes/auth.routes");
const cloudinaryRoutes = require("./src/routes/cloudinary.routes");
const conversationRoutes = require("./src/routes/conversation.routes");
const messageRoutes = require("./src/routes/message.routes");
const profileRoutes = require("./src/routes/profile.routes");
const registerMessageSocket = require("./src/socket/message.socket");
const registerPresenceSocket = require("./src/socket/presenceSocket");
const registerCallSocket = require("./src/socket/call.socket");
const app = express();
const PORT = Number(process.env.PORT || 3002);
const MAX_PORT_ATTEMPTS = 10;
   const viewOnceRoutes = require("./src/routes/viewOnce.routes");


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// NEW: serve uploaded files (photos, videos, documents)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ==========================================
// API ROUTES
// ==========================================

app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/smart-replies", smartReplyRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api", viewOnceRoutes);
// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", async (req, res) => {
  let databaseStatus = "unknown";

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseStatus = "ok";
  } catch (error) {
    databaseStatus = "down";
  }

  const isHealthy = databaseStatus === "ok";

  res.json({
    status: isHealthy ? "OK" : "DEGRADED",
    message: isHealthy
      ? "Server is healthy"
      : "Server is running but PostgreSQL is unavailable",
    database: databaseStatus,
    timestamp: new Date(),
  });
});

// ==========================================
// UPLOAD ERROR HANDLER (NEW)
// Must come after all routes
// ==========================================

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large (max 50MB)" });
  }
  if (err.message === "File type not allowed") {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

// ==========================================
// SOCKET CONNECTION
// ==========================================

function registerSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
    },

    // Faster detection of dropped connections
    // (defaults are 25000 and 20000)
    pingInterval: 10000, // ping every 10 seconds
    pingTimeout: 5000, // wait 5 seconds for a reply
  });

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
      registerCallSocket(io, socket);
    } catch (error) {
      console.error("Socket authentication failed:", error.message);
      socket.disconnect();
    }
  });

  return io;
}

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

function startServer(port, attempt = 1) {
  const httpServer = http.createServer(app);

  // keep io and share it with the routes/controllers
  const io = registerSocketServer(httpServer);
  app.set("io", io);

  httpServer.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      if (attempt >= MAX_PORT_ATTEMPTS) {
        console.error(
          `Port ${port} is unavailable and no fallback ports are available after ${MAX_PORT_ATTEMPTS} attempts.`
        );
        process.exit(1);
        return;
      }

      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Retrying on http://localhost:${nextPort}`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error("Server startup error:", error);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    const preferredPort = Number(process.env.PORT || 3000);
    const messagePort = port !== preferredPort ? ` (fallback from ${preferredPort})` : "";
    console.log(`Server running on http://localhost:${port}${messagePort}`);
  });
}

startServer(PORT);