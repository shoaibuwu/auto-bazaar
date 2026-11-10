import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Inquiry from "../models/inquiry.model.js";

let ioInstance = null;

// Track active socket connections per userId (supports multiple open browser tabs)
const onlineUsers = new Map();

/**
 * Parse raw Cookie header string into key-value object
 */
function parseCookieHeader(cookieHeader = "") {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== "string") return cookies;

  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(val);
        } catch {
          cookies[key] = val;
        }
      }
    }
  });

  return cookies;
}

/**
 * Helper to get array of all currently online user IDs
 */
export function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

/**
 * Initialize Socket.IO server attached to the Node HTTP server
 */
export function initSocket(httpServer) {
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev like app.js
        }
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Authenticate every socket handshake via HttpOnly cookie or auth token
  ioInstance.use(async (socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers?.cookie);
      let token = cookies.token || socket.handshake.auth?.token || null;

      if (!token && socket.handshake.headers?.authorization?.startsWith("Bearer ")) {
        token = socket.handshake.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return next(new Error("Authentication required for real-time chat"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select(
        "_id name email role avatar status"
      );

      if (!user) {
        return next(new Error("User account no longer exists"));
      }

      if (user.status === "suspended") {
        return next(new Error("Account is suspended"));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error("Invalid or expired authentication token"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    // Join personal user room for live inbox & unread badge updates
    socket.join(`user:${userId}`);

    // Register online presence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    const userSockets = onlineUsers.get(userId);
    const wasOffline = userSockets.size === 0;
    userSockets.add(socket.id);

    if (wasOffline) {
      ioInstance.emit("presence:update", { userId, isOnline: true });
    }

    // Allow client to query online status of specific user IDs
    socket.on("presence:query", (userIds = [], callback) => {
      if (typeof callback === "function") {
        const result = {};
        if (Array.isArray(userIds)) {
          userIds.forEach((id) => {
            if (id) {
              result[id] = onlineUsers.has(id.toString());
            }
          });
        }
        callback(result);
      }
    });

    // Join specific inquiry conversation room after verifying participant access
    socket.on("thread:join", async (inquiryId, callback) => {
      try {
        if (!inquiryId) return;
        const inquiry = await Inquiry.findById(inquiryId).select("buyer seller");
        if (!inquiry) {
          if (typeof callback === "function") callback({ ok: false, error: "Not found" });
          return;
        }

        const isParticipant =
          inquiry.buyer.toString() === userId || inquiry.seller.toString() === userId;

        if (!isParticipant) {
          if (typeof callback === "function") callback({ ok: false, error: "Forbidden" });
          return;
        }

        socket.join(`thread:${inquiryId}`);
        if (typeof callback === "function") callback({ ok: true });
      } catch (err) {
        if (typeof callback === "function") callback({ ok: false, error: err.message });
      }
    });

    // Leave specific conversation room
    socket.on("thread:leave", (inquiryId) => {
      if (inquiryId) {
        socket.leave(`thread:${inquiryId}`);
      }
    });

    // Live typing indicators inside a conversation thread
    socket.on("typing:start", ({ inquiryId }) => {
      if (!inquiryId) return;
      socket.to(`thread:${inquiryId}`).emit("typing:start", {
        inquiryId,
        userId,
        name: socket.user.name,
      });
    });

    socket.on("typing:stop", ({ inquiryId }) => {
      if (!inquiryId) return;
      socket.to(`thread:${inquiryId}`).emit("typing:stop", {
        inquiryId,
        userId,
      });
    });

    // Clean up presence on disconnect
    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          ioInstance.emit("presence:update", { userId, isOnline: false });
        }
      }
    });
  });

  return ioInstance;
}

/**
 * Retrieve active Socket.IO instance inside Express controllers
 */
export function getIO() {
  return ioInstance;
}

