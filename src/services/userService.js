import axios from "axios";

const BASE_URL = "https://be-chatbox-1.onrender.com";
const AUTH_API_URL = `${BASE_URL}/api/auth`;
const FRIENDS_API_URL = `${BASE_URL}/api/friends`;

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

export const getMe = async () => {
  const response = await axios.get(`${AUTH_API_URL}/me`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return normalizeUser(response.data);
};

export const getFriends = async () => {
  const response = await axios.get(FRIENDS_API_URL, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return Array.isArray(response.data)
    ? response.data.map(normalizeUser)
    : [];
};