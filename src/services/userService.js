import axios from "axios";
import { normalizeUserEntity } from "../utils/userNormalizer";

const BASE_URL = "https://be-chatbox-1.onrender.com";
const AUTH_API_URL = `${BASE_URL}/api/auth`;
const FRIENDS_API_URL = `${BASE_URL}/api/friends`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`
  };
};

const normalizeUser = (user) => normalizeUserEntity(user);

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

export const updateMe = async (payload, avatarFile = null) => {
  const payloadWithServerKeys = {
    ...payload,
    username: payload?.name ?? payload?.username
  };

  const cleanedPayload = Object.fromEntries(
    Object.entries(payloadWithServerKeys).filter(([, value]) => value !== undefined)
  );

  if (avatarFile) {
    const formData = new FormData();
    Object.entries(cleanedPayload).forEach(([key, value]) => {
      formData.append(key, value ?? "");
    });
    formData.append("avatar", avatarFile);

    const response = await axios.put(`${AUTH_API_URL}/update`, formData, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "multipart/form-data"
      }
    });

    return normalizeUser(response.data?.user || response.data);
  }

  const response = await axios.put(`${AUTH_API_URL}/update`, cleanedPayload, {
    headers: {
      ...getAuthHeaders()
    }
  });

  return normalizeUser(response.data?.user || response.data);
};