import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getMyInquiriesWithMeta } from "../api/inquiries.api";

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineMap, setOnlineMap] = useState({});
  const socketRef = useRef(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const { totalUnread } = await getMyInquiriesWithMeta();
      setUnreadCount(totalUnread || 0);
    } catch {
      // Silent fail if unauthenticated or transient network hiccup
    }
  }, [isAuthenticated]);

  const checkUsersOnline = useCallback((userIds = []) => {
    const s = socketRef.current;
    if (!s || !s.connected || !Array.isArray(userIds) || userIds.length === 0) return;
    s.emit("presence:query", userIds, (res) => {
      if (res && typeof res === "object") {
        setOnlineMap((prev) => ({ ...prev, ...res }));
      }
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      setUnreadCount(0);
      setOnlineMap({});
      return;
    }

    // Fetch initial unread badge count
    refreshUnreadCount();

    // Establish authenticated WebSocket / Socket.IO connection using HttpOnly cookie
    const s = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => {
      setIsConnected(true);
      refreshUnreadCount();
    });

    s.on("disconnect", () => {
      setIsConnected(false);
    });

    s.on("connect_error", () => {
      setIsConnected(false);
    });

    // Live presence updates
    s.on("presence:update", ({ userId, isOnline }) => {
      if (!userId) return;
      setOnlineMap((prev) => ({ ...prev, [userId]: Boolean(isOnline) }));
    });

    // Recompute unread badge when inbox updates
    const handleInboxChange = () => {
      refreshUnreadCount();
    };

    s.on("inquiry:new", handleInboxChange);
    s.on("inquiry:updated", handleInboxChange);
    s.on("inquiry:read", handleInboxChange);
    s.on("inquiry:deleted", handleInboxChange);

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.off("connect_error");
      s.off("presence:update");
      s.off("inquiry:new", handleInboxChange);
      s.off("inquiry:updated", handleInboxChange);
      s.off("inquiry:read", handleInboxChange);
      s.off("inquiry:deleted", handleInboxChange);
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, user?._id, refreshUnreadCount]);

  const value = {
    socket,
    isConnected,
    unreadCount,
    onlineMap,
    refreshUnreadCount,
    checkUsersOnline,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}

