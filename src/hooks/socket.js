// src/socket.js
import { io } from "socket.io-client";

let socket = null;

export const connectSocket = () => {
  const token = localStorage.getItem("token");

  if (!socket || !socket.connected) {
    socket = io("https://livechatcrm-byj4.onrender.com", {
       path: "/socket.io",
      auth: { token },   // ✅ match backend socket.handshake.auth.token
      transports: ["websocket"],
      createConnection: true,
      secure: true,
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("⚠️ Socket connection error:", err.message);
    });
  }

  return socket;
};

export const getSocket = () => socket;
