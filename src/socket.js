import { io } from "socket.io-client";

const socket = io("https://be-chatbox-1.onrender.com");

export default socket;