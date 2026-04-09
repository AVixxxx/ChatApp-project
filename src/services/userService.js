import axios from "axios";
import { normalizeUserEntity } from "../utils/userNormalizer";

const BASE_URL = "https://be-chatbox-1.onrender.com";
const AUTH_API_URL = `${BASE_URL}/api/auth`;
const FRIENDS_API_URL = `${BASE_URL}/api/friends`;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeUser = (user) => normalizeUserEntity(user);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error) => {
  const status = error?.response?.status;
  return !status || RETRYABLE_STATUSES.has(status);
};

const requestWithRetry = async (requestFn, maxAttempts = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(500 * attempt);
    }
  }

  throw lastError;
};

export const getMe = async () => {
  const response = await requestWithRetry(() =>
    axios.get(`${AUTH_API_URL}/me`, {
      headers: {
        ...getAuthHeaders()
      }
    })
  );

  return normalizeUser(response.data);
};

export const getFriends = async () => {
  const response = await requestWithRetry(() =>
    axios.get(FRIENDS_API_URL, {
      headers: {
        ...getAuthHeaders()
      }
    })
  );

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

    const response = await requestWithRetry(() =>
      axios.put(`${AUTH_API_URL}/update`, formData, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data"
        }
      })
    );

    return normalizeUser(response.data?.user || response.data);
  }

  const response = await requestWithRetry(() =>
    axios.put(`${AUTH_API_URL}/update`, cleanedPayload, {
      headers: {
        ...getAuthHeaders()
      }
    })
  );

  return normalizeUser(response.data?.user || response.data);
};