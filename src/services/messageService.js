import axios from "axios";

const BASE_URL = "https://be-chatbox-1.onrender.com";
const API_URL = `${BASE_URL}/api/messages`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`
  };
};

const normalizeUser = (user) => {
  if (!user || typeof user !== "object") return user;

  return {
    ...user,
    id: user.user_id || user.id || user._id,
    name: user.name || "",
    email: user.email || ""
  };
};

const normalizeMessage = (message) => {
  if (!message || typeof message !== "object") return message;

  return {
    ...message,
    id: message.id || message.message_id || message._id,
    conversationId:
      message.conversationId || message.conversation_id || message.conversation,
    sender:
      typeof message.sender === "object"
        ? normalizeUser(message.sender)
        : message.sender
  };
};

export const getMessagesByConversation = async (conversationId) => {
  const response = await axios.get(`${API_URL}/${conversationId}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return Array.isArray(response.data)
    ? response.data.map(normalizeMessage)
    : [];
};

export const sendMessage = async (messageData) => {
  const response = await axios.post(`${API_URL}/send`, messageData, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return normalizeMessage(response.data);
};