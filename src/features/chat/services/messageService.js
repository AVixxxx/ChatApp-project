import axios from "axios";
import { API_URL } from "@/config/api";
import { normalizeUserEntity } from "@/utils/userNormalizer";

const chatApi = axios.create({
  baseURL: API_URL
});

const MESSAGE_API_PATH = "/api/messages";
const MESSAGE_API_FALLBACK_PATH = "/api/message";
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeUser = (user) => normalizeUserEntity(user);

const normalizeMessage = (message) => {
  if (!message || typeof message !== "object") return message;

  const isRecalled = Boolean(message.isRecalled ?? message.is_recalled);

  const text =
    isRecalled
      ? "[Tin nhắn đã được thu hồi]"
      : message.text ||
        message.content ||
        message.message ||
        message.last_message ||
        "";

  const hasFileUrl = Boolean(message.file_url || message.fileUrl);
  const rawMessageType =
    message.messageType || message.message_type || message.type || "";
  const messageType = rawMessageType || (hasFileUrl ? "image" : "text");

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
    isRecalled,
    is_recalled: isRecalled,
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryUploadRequest = (error) => {
  const status = error?.response?.status;
  return RETRYABLE_STATUSES.has(status);
};

const createMessageUploadFormData = (messageData) => {
  const formData = new FormData();
  formData.append("conversation_id", messageData?.conversationId || "");
  formData.append("content", messageData?.text || messageData?.content || "");
  formData.append("message_type", messageData?.messageType || "file");

  const parentId = messageData?.parent_id || messageData?.parentId;
  if (parentId) {
    formData.append("parent_id", parentId);
  }

  (Array.isArray(messageData?.files) ? messageData.files : []).forEach((file) => {
    const safeFile = createSafeUploadFile(file);

    formData.append("files", safeFile, safeFile.name);
  });

  return formData;
};

const sanitizeUploadFileName = (fileName) => {
  const normalizedName = String(fileName || "").trim();

  if (!normalizedName) {
    return `upload-${Date.now()}`;
  }

  const lastDotIndex = normalizedName.lastIndexOf(".");
  const hasExtension = lastDotIndex > 0 && lastDotIndex < normalizedName.length - 1;
  const baseName = hasExtension ? normalizedName.slice(0, lastDotIndex) : normalizedName;
  const extension = hasExtension ? normalizedName.slice(lastDotIndex + 1) : "";

  const safeBaseName = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 80);

  const fallbackBaseName = safeBaseName || `upload-${Date.now()}`;
  const safeExtension = extension
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 10);

  return safeExtension ? `${fallbackBaseName}.${safeExtension}` : fallbackBaseName;
};

const createSafeUploadFile = (file) => {
  if (!(file instanceof File)) {
    return file;
  }

  const safeName = sanitizeUploadFileName(file.name);
  if (safeName === file.name) {
    return file;
  }

  return new File([file], safeName, {
    type: file.type,
    lastModified: file.lastModified
  });
};

const uploadMultipartMessage = async (messageData, maxAttemptsPerPath = 2) => {
  const candidatePaths = [MESSAGE_API_PATH, MESSAGE_API_FALLBACK_PATH];
  let lastError;

  for (const apiPath of candidatePaths) {
    for (let attempt = 1; attempt <= maxAttemptsPerPath; attempt += 1) {
      try {
        return await chatApi.post(
          `${apiPath}/send`,
          createMessageUploadFormData(messageData),
          {
            headers: {
              ...getAuthHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 180000,
            onUploadProgress: messageData?.onUploadProgress
          }
        );
      } catch (error) {
        lastError = error;

        const status = error?.response?.status;
        const shouldTryNextPath = status === 404 || status === 405;

        if (shouldTryNextPath) {
          break;
        }

        if (!shouldRetryUploadRequest(error) || attempt === maxAttemptsPerPath) {
          break;
        }

        await sleep(500 * attempt);
      }
    }
  }

  if (axios.isAxiosError(lastError) && !lastError.response) {
    const uploadTimedOut =
      lastError.code === "ECONNABORTED" ||
      String(lastError.message || "").toLowerCase().includes("timeout");

    const wrappedError = new Error(
      uploadTimedOut
        ? "Tải file hoặc ảnh lên máy chủ quá lâu và đã bị hủy. Hãy thử lại hoặc dùng file nhỏ hơn 20MB."
        : "Không thể tải file hoặc ảnh lên máy chủ. Kết nối đã bị ngắt trong lúc upload."
    );
    wrappedError.cause = lastError;
    throw wrappedError;
  }

  throw lastError;
};

const toTimestamp = (message) => {
  const value = message?.createdAt || message?.created_at || message?.create_at;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortMessagesOldestFirst = (messages) =>
  [...messages].sort((a, b) => toTimestamp(a) - toTimestamp(b));

const toBackendCursor = (cursor) => {
  if (!cursor) return null;

  const parsed = new Date(cursor);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Backend compares against TIMESTAMP (without timezone), so send a neutral format.
  return parsed.toISOString().replace("T", " ").replace("Z", "");
};

export const getMessagesByConversation = async (conversationId) => {
  const page = await getMessagesPage(conversationId);
  return page.messages;
};

export const getMessagesPage = async (conversationId, options = {}) => {
  const { cursor = null, limit = 20 } = options;
  const normalizedCursor = toBackendCursor(cursor);

  let response;

  try {
    response = await chatApi.get(`${MESSAGE_API_PATH}/${conversationId}`, {
      ...getApiHeaders(),
      params: {
        limit,
        ...(normalizedCursor ? { cursor: normalizedCursor } : {})
      }
    });
  } catch (error) {
    const shouldRetryWithRawCursor =
      Boolean(cursor) &&
      Boolean(normalizedCursor) &&
      error?.response?.status === 500;

    if (!shouldRetryWithRawCursor) {
      throw error;
    }

    response = await chatApi.get(`${MESSAGE_API_PATH}/${conversationId}`, {
      ...getApiHeaders(),
      params: {
        limit,
        cursor
      }
    });
  }

  const payload = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.messages)
      ? response.data.messages
      : [];

  return {
    messages: sortMessagesOldestFirst(payload.map(normalizeMessage)),
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
  const parentId = messageData?.parent_id || messageData?.parentId;

  let response;

  if (hasFiles) {
    response = await uploadMultipartMessage({
      ...messageData,
      messageType
    });
  } else {
    const payload = {
      conversation_id: messageData?.conversationId,
      content: messageData?.text,
      message_type: messageType,
      ...(parentId ? { parent_id: parentId } : {})
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

export const sendVoiceMessage = async ({ conversationId, file }) => {
  if (!file) return null;

  const response = await uploadMultipartMessage({
    conversationId,
    text: "",
    files: [file],
    messageType: "audio"
  });

  const payload = Array.isArray(response.data)
    ? response.data
    : response.data
      ? [response.data]
      : [];

  return normalizeMessage(payload[0] || null);
};

export const deleteMessage = async (messageId) => {
  const response = await chatApi.post(
    `${MESSAGE_API_PATH}/delete`,
    { message_id: messageId },
    getApiHeaders()
  );

  return response.data;
};

export const recallMessage = async (messageId) => {
  const response = await chatApi.post(
    `${MESSAGE_API_PATH}/recall`,
    { message_id: messageId },
    getApiHeaders()
  );

  return response.data;
};

export { normalizeMessage };
