import axios from "axios";
import { API_URL } from "@/config/api";
import { normalizeUserEntity } from "@/utils/userNormalizer";

const chatApi = axios.create({
  baseURL: API_URL
});

const CONVERSATION_API_PATH = "/api/conversations";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeUser = (user) => normalizeUserEntity(user);

const normalizeConversation = (conversation) => {
  if (!conversation || typeof conversation !== "object") return conversation;

  const normalizedMembers = Array.isArray(conversation.members)
    ? conversation.members.map(normalizeUser)
    : conversation.friend_id
      ? [
          normalizeUser({
            id: conversation.friend_id,
            user_id: conversation.friend_id,
            username: conversation.name,
            avatar: conversation.avatar
          })
        ]
      : [];

  const lastMessage = conversation.lastMessage || conversation.last_message;
  const resolvedType = conversation.type || (conversation.isGroup ? "group" : "private");

  return {
    ...conversation,
    id: conversation.id || conversation.conversation_id || conversation._id,
    isGroup: Boolean(
      conversation.isGroup ?? conversation.is_group ?? resolvedType === "group"
    ),
    groupName: conversation.groupName || conversation.group_name || "",
    members: normalizedMembers,
    lastMessage:
      typeof lastMessage === "object"
        ? lastMessage
        : {
            text: lastMessage || conversation.last_message || "",
            content: lastMessage || conversation.last_message || "",
            createdAt:
              conversation.lastMessageTime ||
              conversation.last_message_time ||
              conversation.last_time_message
          },
    lastMessageTime:
      conversation.lastMessageTime ||
      conversation.last_message_time ||
      conversation.last_time_message ||
      conversation.updatedAt ||
      conversation.updated_at ||
      lastMessage?.createdAt ||
      lastMessage?.created_at
  };
};

export const getConversations = async () => {
  const response = await chatApi.get(CONVERSATION_API_PATH, {
    headers: {
      ...getAuthHeaders()
    }
  });

  const payload = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.conversations)
      ? response.data.conversations
      : [];

  return payload.map(normalizeConversation);
};

export const createPrivateConversation = async (members) => {
  const safeMembers = Array.isArray(members) ? members : [];
  const receiverId = safeMembers[0];

  if (!receiverId) {
    throw new Error("Missing receiverId for private conversation");
  }

  const mergeResponse = await chatApi.post(
    `${CONVERSATION_API_PATH}/merge`,
    { receiverId },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return normalizeConversation({
    ...mergeResponse.data,
    friend_id: receiverId
  });
};

export const createGroupConversation = async ({ members, groupName }) => {
  const response = await chatApi.post(
    CONVERSATION_API_PATH,
    {
      members,
      groupName,
      isGroup: true
    },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return normalizeConversation(response.data);
};