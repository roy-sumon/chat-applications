"use client";

import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export function getSocketClient(): Socket | null {
  if (typeof window === "undefined") return null;

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  if (!socketUrl) return null;

  if (!socketInstance) {
    try {
      socketInstance = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        autoConnect: true,
      });
    } catch (err) {
      console.warn("[Socket.io] Client initialization notice:", err);
      return null;
    }
  }

  return socketInstance;
}
