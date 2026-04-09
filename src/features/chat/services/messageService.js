import axios from "axios";
import { API_URL } from "@/config/api";
import { normalizeUserEntity } from "@/utils/userNormalizer";

const MESSAGE_API_URL = `${API_URL}/api/messages`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`
  };
};

const normalizeUser = (user) => normalizeUserEntity(user);

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
  const response = await axios.get(`${MESSAGE_API_URL}/${conversationId}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return Array.isArray(response.data)
    ? response.data.map(normalizeMessage)
    : [];
};

export const sendMessage = async (messageData) => {
  const response = await axios.post(`${MESSAGE_API_URL}/send`, messageData, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return normalizeMessage(response.data);
};