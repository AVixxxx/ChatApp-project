import axios from "axios";

const BASE_URL = "https://be-chatbox-1.onrender.com";
const API_URL = `${BASE_URL}/api/conversations`;

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

const normalizeConversation = (conversation) => {
  if (!conversation || typeof conversation !== "object") return conversation;

  const normalizedMembers = Array.isArray(conversation.members)
    ? conversation.members.map(normalizeUser)
    : [];

  const lastMessage = conversation.lastMessage || conversation.last_message;

  return {
    ...conversation,
    id: conversation.id || conversation.conversation_id || conversation._id,
    isGroup: Boolean(conversation.isGroup ?? conversation.is_group),
    groupName: conversation.groupName || conversation.group_name || "",
    members: normalizedMembers,
    lastMessage,
    lastMessageTime:
      conversation.lastMessageTime ||
      conversation.last_message_time ||
      conversation.updatedAt ||
      conversation.updated_at ||
      lastMessage?.createdAt ||
      lastMessage?.created_at
  };
};

export const getConversations = async () => {
  const response = await axios.get(API_URL, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return Array.isArray(response.data)
    ? response.data.map(normalizeConversation)
    : [];
};

export const createPrivateConversation = async (members) => {
  const response = await axios.post(
    API_URL,
    { members },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return normalizeConversation(response.data);
};

export const createGroupConversation = async ({ members, groupName }) => {
  const response = await axios.post(
    API_URL,
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