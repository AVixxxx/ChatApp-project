import { io } from "socket.io-client";
import { SOCKET_URL } from "@/config/api";

const getSocketToken = () => localStorage.getItem("token") || "";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
  auth: {
    token: getSocketToken()
  }
});

export const connectSocketWithToken = () => {
  const token = getSocketToken();

  if (!token) {
    return;
  }

  socket.auth = { token };

  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Socket connect error:", error?.message || error);
});

export default socket;
