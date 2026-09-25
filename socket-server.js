/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Dedicated Socket.io Real-Time Signaling Server for Pulse Chat
 * 
 * Provides sub-10ms ultra-low-latency WebSockets for WebRTC audio/video calling.
 * Run standalone with: npm run socket-server
 * Or deploy as a separate Node.js service on Render, Railway, DigitalOcean, or a VPS.
 */

const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.SOCKET_PORT || process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "pulse-chat-socket-signaling",
        connections: io ? io.engine.clientsCount : 0,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  // 1. Join personal user room for direct call alerts
  socket.on("register-user", (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  // 2. Join conversation room
  socket.on("join-conversation", (conversationId) => {
    if (conversationId) {
      socket.join(`conv:${conversationId}`);
    }
  });

  // 3. WebRTC Call Signaling (offer, answer, ice-candidate, reject, end)
  socket.on("call-signal", (payload) => {
    if (!payload) return;

    // Send directly to the target user's personal room
    if (payload.targetUserId) {
      socket.to(`user:${payload.targetUserId}`).emit("call-signal", payload);
    }

    // Also broadcast to the conversation room as a backup
    if (payload.conversationId) {
      socket.to(`conv:${payload.conversationId}`).emit("call-signal", payload);
    }
  });

  // 4. Real-time Chat Events
  socket.on("chat:message", (payload) => {
    if (payload && payload.conversationId) {
      socket.to(`conv:${payload.conversationId}`).emit("chat:message", payload);
    }
  });

  socket.on("chat:typing", (payload) => {
    if (payload && payload.conversationId) {
      socket.to(`conv:${payload.conversationId}`).emit("chat:typing", payload);
    }
  });

  socket.on("chat:reaction", (payload) => {
    if (payload && payload.conversationId) {
      socket.to(`conv:${payload.conversationId}`).emit("chat:reaction", payload);
    }
  });

  socket.on("chat:seen", (payload) => {
    if (payload && payload.conversationId) {
      socket.to(`conv:${payload.conversationId}`).emit("chat:seen", payload);
    }
  });

  socket.on("chat:deleted", (payload) => {
    if (payload && payload.conversationId) {
      socket.to(`conv:${payload.conversationId}`).emit("chat:deleted", payload);
    }
  });

  socket.on("chat:updated", (payload) => {
    if (payload && payload.conversationId) {
      socket.to(`conv:${payload.conversationId}`).emit("chat:updated", payload);
    }
  });

  socket.on("disconnect", () => {
    // Clean up
  });
});

server.listen(PORT, () => {
  console.log(`[Socket.io Signaling] Server running on http://localhost:${PORT}`);
});
