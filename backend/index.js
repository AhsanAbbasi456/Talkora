  const express = require("express");
  const cors = require("cors");
  require("dotenv/config");

  const userRoutes = require("./src/routes/user.routes");
  const authRoutes = require("./src/routes/auth.routes");
  const cloudinaryRoutes = require("./src/routes/cloudinary.routes");
  const conversationRoutes = require("./src/routes/conversation.routes");
  const profileRoutes = require("./src/routes/profile.routes"); 
  const messageRoutes = require("./src/routes/message.routes");

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  app.use("/api/profile", profileRoutes); // NEW
  app.use("/api/users", userRoutes); // CHANGED from "/api"
  app.use("/api/auth", authRoutes);
  app.use("/api/cloudinary", cloudinaryRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/messages", messageRoutes);

  app.get("/api/health", (req, res) => {
    res.json({
      status: "OK",
      message: "Server is healthy",
      timestamp: new Date(),
    });
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });