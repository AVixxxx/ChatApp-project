import axios from "axios";
import { API_URL } from "@/config/api";

const callApi = axios.create({
  baseURL: API_URL
});

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const startCallSession = async ({ conversationId, callType = "video" }) => {
  const response = await callApi.post(
    "/api/calls/start",
    {
      conversationId,
      callType
    },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return response.data;
};

export const endCallSession = async ({ callId }) => {
  if (!callId) return null;

  const response = await callApi.post(
    "/api/calls/end",
    {
      callId
    },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return response.data;
};

export const getCallHistory = async () => {
  const response = await callApi.get("/api/calls/history", {
    headers: {
      ...getAuthHeaders()
    }
  });

  return Array.isArray(response.data) ? response.data : [];
};
