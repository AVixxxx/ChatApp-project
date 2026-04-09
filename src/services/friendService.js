import axios from "axios";
import { DEFAULT_AVATAR_URL } from "../constants/avatar";
import { getAvatarUrl, normalizeUserEntity } from "../utils/userNormalizer";

const BASE_URL = "https://be-chatbox-1.onrender.com";
const FRIENDS_API_URL = `${BASE_URL}/api/friends`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`
  };
};

const fetchFriendRelations = async () => {
  const response = await axios.get(FRIENDS_API_URL, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return Array.isArray(response.data) ? response.data : [];
};

const fetchIncomingFriendRequests = async () => {
  const response = await axios.get(`${FRIENDS_API_URL}/request`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return Array.isArray(response.data) ? response.data : [];
};

const parseOnlineStatus = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "online";
  }
  return false;
};

export const normalizeFriend = (friendRequest, currentUserId) => {
  if (!friendRequest || typeof friendRequest !== "object") {
    return {
      id: "",
      relationId: "",
      senderId: "",
      receiverId: "",
      status: "pending",
      type: "incoming",
      name: "User unkno",
      avatar: DEFAULT_AVATAR_URL,
      isOnline: false,
      raw: friendRequest
    };
  }

  const senderId = String(friendRequest.sender_id || "");
  const receiverId = String(friendRequest.receiver_id || "");
  const directUserId = String(friendRequest.user_id || "");
  const me = String(currentUserId || "");

  let friendId = "";
  if (senderId && me && senderId === me) {
    friendId = receiverId;
  } else if (receiverId && me && receiverId === me) {
    friendId = senderId;
  } else if (directUserId) {
    friendId = directUserId;
  } else {
    friendId = senderId || receiverId;
  }

  const type = senderId && me && senderId === me ? "outgoing" : "incoming";
  const relationId = String(friendRequest.friend_id || friendRequest.id || "");
  const fallbackName = friendRequest.username || friendRequest.name;
  const status = friendRequest.status || friendRequest.request_status || "pending";
  const safeFriendId = String(friendId || "unkno");
  const normalizedFriend = normalizeUserEntity({
    ...friendRequest,
    id: safeFriendId,
    user_id: safeFriendId
  });
  const isOnline = parseOnlineStatus(
    friendRequest.is_online ?? friendRequest.isOnline ?? friendRequest.online
  );

  return {
    id: safeFriendId,
    relationId,
    senderId,
    receiverId,
    status,
    type,
    name: normalizedFriend?.name || fallbackName || `User ${safeFriendId.slice(0, 5)}`,
    email: normalizedFriend?.email || friendRequest?.email || "",
    phone:
      normalizedFriend?.phone ||
      normalizedFriend?.phone_number ||
      friendRequest?.phone ||
      friendRequest?.phone_number ||
      "",
    phone_number:
      normalizedFriend?.phone_number ||
      normalizedFriend?.phone ||
      friendRequest?.phone_number ||
      friendRequest?.phone ||
      "",
    avatar: getAvatarUrl(normalizedFriend, DEFAULT_AVATAR_URL),
    isOnline,
    raw: friendRequest
  };
};

export const getFriendList = async (currentUserId) => {
  const relations = await fetchFriendRelations();
  return relations.map((item) => {
    const normalized = normalizeFriend(item, currentUserId);
    return {
      ...normalized,
      status: "accepted"
    };
  });
};

export const getFriendRequests = async (currentUserId) => {
  const relations = await fetchIncomingFriendRequests();
  return relations
    .map((item) => normalizeFriend(item, currentUserId))
    .filter((item) => item.status === "pending");
};

export const acceptFriendRequest = async (requestId) => {
  if (!requestId || requestId === "unkno") {
    throw new Error("Invalid request id");
  }

  const response = await axios.post(
    `${FRIENDS_API_URL}/accept/${requestId}`,
    {},
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return response.data;
};

export const declineFriendRequest = async (requestId) => {
  const response = await axios.delete(`${FRIENDS_API_URL}/${requestId}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return response.data;
};

export const removeFriend = async (friendId) => {
  const response = await axios.delete(`${FRIENDS_API_URL}/${friendId}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return response.data;
};

export const sendFriendRequest = async (receiverId) => {
  const response = await axios.post(
    `${FRIENDS_API_URL}/request`,
    {
      receiverId
    },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return response.data;
};
