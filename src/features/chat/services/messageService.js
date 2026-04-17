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

  const hasFileUrl = Boolean(message.file_url || message.fileUrl);
  const messageType =
    message.messageType ||
    message.message_type ||
    message.type ||
    (hasFileUrl ? "image" : "text");

  const imageUrl =
    message.imageUrl ||
    message.image_url ||
    message.fileUrl ||
    message.file_url ||
    "";

  return {
    ...message,
    id: message.id || message.message_id || message._id,
    conversationId:
      message.conversationId || message.conversation_id || message.conversation,
    text,
    createdAt: message.createdAt || message.created_at || message.create_at,
    type: messageType,
    messageType,
    imageUrl,
    fileUrl: imageUrl,
    file_url: imageUrl,
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
  const page = await getMessagesPage(conversationId);
  return page.messages;
};

export const getMessagesPage = async (conversationId, options = {}) => {
  const { cursor = null, limit = 20 } = options;

  const response = await chatApi.get(`${MESSAGE_API_PATH}/${conversationId}`, {
    ...getApiHeaders(),
    params: {
      limit,
      ...(cursor ? { cursor } : {})
    }
  });

  const payload = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.messages)
      ? response.data.messages
      : [];

  return {
    messages: payload.map(normalizeMessage),
    nextCursor: response.data?.nextCursor || null
  };
};

export const getAllMessagesByConversation = async (conversationId) => {
  const collectedMessages = [];
  let cursor = null;

  while (true) {
    const page = await getMessagesPage(conversationId, { cursor, limit: 100 });
    collectedMessages.push(...page.messages);

    if (!page.nextCursor) {
      break;
    }

    cursor = page.nextCursor;
  }

  return sortMessagesOldestFirst(collectedMessages);
};

export const sendMessage = async (messageData) => {
  const hasFiles = Array.isArray(messageData?.files) && messageData.files.length > 0;
  const messageType = messageData?.messageType || (hasFiles ? "image" : "text");

  let response;

  if (hasFiles) {
    const formData = new FormData();
    formData.append("conversation_id", messageData?.conversationId || "");
    formData.append("content", messageData?.text || messageData?.content || "");
    formData.append("message_type", messageType);

    messageData.files.forEach((file) => {
      formData.append("files", file);
    });

    response = await chatApi.post(`${MESSAGE_API_PATH}/send`, formData, {
      headers: {
        ...getAuthHeaders()
      }
    });
  } else {
    const payload = {
      conversation_id: messageData?.conversationId,
      content: messageData?.text,
      message_type: messageType
    };

    response = await chatApi.post(
      `${MESSAGE_API_PATH}/send`,
      payload,
      getApiHeaders()
    );
  }

  const responsePayload = Array.isArray(response.data)
    ? response.data[0]
    : response.data;

  return normalizeMessage(responsePayload);
};

export const sendImageMessage = async ({ conversationId, files = [] }) => {
  const validFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  if (validFiles.length === 0) return [];

  const response = await chatApi.post(
    `${MESSAGE_API_PATH}/send`,
    (() => {
      const formData = new FormData();
      formData.append("conversation_id", conversationId || "");
      formData.append("content", "");
      formData.append("message_type", "image");
      validFiles.forEach((file) => {
        formData.append("files", file);
      });
      return formData;
    })(),
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  const payload = Array.isArray(response.data)
    ? response.data
    : response.data
      ? [response.data]
      : [];

  return payload.map(normalizeMessage);
};

export const sendFileMessage = async ({ conversationId, files = [] }) => {
  const validFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  if (validFiles.length === 0) return [];

  const response = await chatApi.post(
    `${MESSAGE_API_PATH}/send`,
    (() => {
      const formData = new FormData();
      formData.append("conversation_id", conversationId || "");
      formData.append("content", "");
      formData.append("message_type", "file");
      validFiles.forEach((file) => {
        formData.append("files", file);
      });
      return formData;
    })(),
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  const payload = Array.isArray(response.data)
    ? response.data
    : response.data
      ? [response.data]
      : [];

  return payload.map(normalizeMessage);
};

export const deleteMessage = async (messageId) => {
  const response = await chatApi.post(
    `${MESSAGE_API_PATH}/delete`,
    { message_id: messageId },
    getApiHeaders()
  );

  return response.data;
};

export { normalizeMessage };