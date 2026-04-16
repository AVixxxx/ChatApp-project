import axios from "axios";
import { API_URL } from "@/config/api";
import { normalizeUserEntity } from "@/utils/userNormalizer";

const chatApi = axios.create({
  baseURL: API_URL
});

const MESSAGE_API_PATH = "/api/messages";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeUser = (user) => normalizeUserEntity(user);

const normalizeMessage = (message) => {
  if (!message || typeof message !== "object") return message;

  const text =
    message.text ||
    message.content ||
    message.message ||
    message.last_message ||
    "";

  return {
    ...message,
    id: message.id || message.message_id || message._id,
    conversationId:
      message.conversationId || message.conversation_id || message.conversation,
    text,
    createdAt: message.createdAt || message.created_at || message.create_at,
    sender:
      typeof message.sender === "object"
        ? normalizeUser(message.sender)
        : message.sender,
    sender_id: message.sender_id || message.senderId
  };
};

const getApiHeaders = () => ({
  headers: {
    ...getAuthHeaders()
  }
});

const toTimestamp = (message) => {
  const value = message?.createdAt || message?.created_at || message?.create_at;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortMessagesOldestFirst = (messages) =>
  [...messages].sort((a, b) => toTimestamp(a) - toTimestamp(b));

export const getMessagesByConversation = async (conversationId) => {
  const response = await chatApi.get(
    `${MESSAGE_API_PATH}/${conversationId}`,
    getApiHeaders()
  );

  const payload = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.messages)
      ? response.data.messages
      : [];

  return sortMessagesOldestFirst(payload.map(normalizeMessage));
};

export const sendMessage = async (messageData) => {
  const payload = {
    conversation_id: messageData?.conversationId,
    content: messageData?.text,
    message_type: "text"
  };

  const response = await chatApi.post(
    `${MESSAGE_API_PATH}/send`,
    payload,
    getApiHeaders()
  );

  const responsePayload = Array.isArray(response.data)
    ? response.data[0]
    : response.data;

  return normalizeMessage(responsePayload);
};