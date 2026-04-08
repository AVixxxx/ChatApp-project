import axios from "axios";

const API_URL = "https://be-chatbox-1.onrender.com/api/auth";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const registerUser = async (userData) => {
  const response = await axios.post(`${API_URL}/register-request`, userData);
  return response.data;
};

export const requestRegistrationOtp = async (userData) => {
  const response = await axios.post(`${API_URL}/register-request`, userData);
  return response.data;
};

export const verifyRegisterWithOtp = async ({ email, otp }) => {
  const response = await axios.post(`${API_URL}/verify-register`, { email, otp });
  return response.data;
};

export const loginUser = async (userData) => {
  const response = await axios.post(`${API_URL}/login`, userData);
  return response.data;
};

export const findAccount = async (value) => {
  const response = await axios.post(
    `${API_URL}/find`,
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