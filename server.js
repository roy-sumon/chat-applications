/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Unified Next.js + Socket.io Server for Render.com & Production
 *
 * Runs both the Next.js fullstack application and the real-time Socket.io
 * WebSocket server on the same HTTP port (process.env.PORT || 3000).
 */

const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error("Error handling HTTP request:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  });

  // Attach Socket.io to the exact same HTTP server
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

    // 2. Join conversation room for group/direct chat
    socket.on("join-conversation", (conversationId) => {
      if (conversationId) {
        socket.join(`conv:${conversationId}`);
      }
    });

    // 3. WebRTC Call Signaling (offer, answer, ice-candidate, reject, end)
    socket.on("call-signal", (payload) => {
      if (!payload) return;

      if (payload.targetUserId) {
        socket.to(`user:${payload.targetUserId}`).emit("call-signal", payload);
      }

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
      // client disconnected
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> [Pulse Chat] Server ready at http://${hostname}:${port} (Production: ${!dev})`);
  });
});
