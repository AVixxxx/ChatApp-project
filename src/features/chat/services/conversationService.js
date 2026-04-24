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

  const lastMessage = conversation.lastMessage || conversation.last_message;
  const resolvedType = conversation.type || (conversation.isGroup ? "group" : "private");
  const normalizedMembers = Array.isArray(conversation.members)
    ? conversation.members.map(normalizeUser)
    : resolvedType === "private" && conversation.friend_id
      ? [
          normalizeUser({
            id: conversation.friend_id,
            user_id: conversation.friend_id,
            username: conversation.name,
            avatar: conversation.avatar
          })
        ]
      : [];

  return {
    ...conversation,
    id: conversation.id || conversation.conversation_id || conversation._id,
    isGroup: Boolean(
      conversation.isGroup ?? conversation.is_group ?? resolvedType === "group"
    ),
    groupName:
      conversation.groupName || conversation.group_name || conversation.name || "",
    createdAt: conversation.createdAt || conversation.created_at || conversation.create_at,
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
    { receiverIds: [receiverId] },
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

export const createGroupConversation = async ({ members, groupName, avatar = null }) => {
  const receiverIds = Array.isArray(members)
    ? members.map((memberId) => String(memberId || "").trim()).filter(Boolean)
    : [];

  const response = await chatApi.post(
    `${CONVERSATION_API_PATH}/merge`,
    {
      receiverIds,
      name: groupName,
      avatar,
      type: "group"
    },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return normalizeConversation(response.data);
};

export const getConversationMembers = async (conversationId) => {
  if (!conversationId) {
    return [];
  }

  const response = await chatApi.get(`${CONVERSATION_API_PATH}/${conversationId}/members`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  const payload = Array.isArray(response.data) ? response.data : [];

  return payload.map((member) => {
    const normalizedMember = normalizeUser(member);

    return {
      ...normalizedMember,
      role: member.role || normalizedMember.role || "member"
    };
  });
};

export const addMemberToGroup = async (conversationId, userId) => {
  const response = await chatApi.post(
    `${CONVERSATION_API_PATH}/${conversationId}/add-members`,
    { userId },
    { headers: { ...getAuthHeaders() } }
  );
  return response.data;
};

export const removeMemberFromGroup = async (conversationId, targetUserId) => {
  const response = await chatApi.delete(
    `${CONVERSATION_API_PATH}/group/remove-member`,
    {
      headers: { ...getAuthHeaders() },
      data: { conversation_id: conversationId, targetUserId }
    }
  );
  return response.data;
};

export const leaveGroupConversation = async (conversationId, currentUserId) => {
  const response = await chatApi.delete(
    `${CONVERSATION_API_PATH}/group/remove-member`,
    {
      headers: { ...getAuthHeaders() },
      data: { conversation_id: conversationId, targetUserId: currentUserId }
    }
  );

  return response.data;
};

export const setGroupAdmin = async (conversationId, targetUserId) => {
  const response = await chatApi.put(
    `${CONVERSATION_API_PATH}/group/set-admin`,
    {
      conversation_id: conversationId,
      targetUserId
    },
    {
      headers: { ...getAuthHeaders() }
    }
  );

  return response.data;
};

export const deleteGroupConversation = async (conversationId) => {
  const response = await chatApi.delete(
    `${CONVERSATION_API_PATH}/${conversationId}/delete-group`,
    {
      headers: { ...getAuthHeaders() }
    }
  );

  return response.data;
};

export const updateGroupInfo = async (conversationId, { name, avatarFile } = {}) => {
  const formData = new FormData();
  formData.append("conversation_id", conversationId);
  if (name !== undefined && name !== null) formData.append("name", name);
  if (avatarFile) formData.append("avatar", avatarFile);

  const response = await chatApi.put(
    `${CONVERSATION_API_PATH}/group/info`,
    formData,
    { headers: { ...getAuthHeaders() } }
  );
  return response.data;
};
