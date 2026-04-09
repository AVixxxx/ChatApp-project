import axios from "axios";
import { API_URL } from "@/config/api";

const AUTH_API_URL = `${API_URL}/api/auth`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const registerUser = async (userData) => {
  const response = await axios.post(`${AUTH_API_URL}/register-request`, userData);
  return response.data;
};

export const requestRegistrationOtp = async (userData) => {
  const response = await axios.post(`${AUTH_API_URL}/register-request`, userData);
  return response.data;
};

export const verifyRegisterWithOtp = async ({ email, otp }) => {
  const response = await axios.post(`${AUTH_API_URL}/verify-register`, { email, otp });
  return response.data;
};

export const loginUser = async (userData) => {
  const response = await axios.post(`${AUTH_API_URL}/login`, userData);
  return response.data;
};

export const findAccount = async (value) => {
  const response = await axios.post(
    `${AUTH_API_URL}/find`,
    { value },
    {
      headers: {
        ...getAuthHeaders()
      }
    }
  );

  return response.data;
};

export default {
  registerUser,
  requestRegistrationOtp,
  verifyRegisterWithOtp,
  loginUser,
  findAccount
};