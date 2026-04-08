import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  loginUser,
  requestRegistrationOtp,
  verifyRegisterWithOtp
} from "../services/authService";
import { saveAuthUserToStorage } from "../utils/userNormalizer";
import OtpModal from "../components/auth/OtpModal";
import "./RegisterPage.css";

const getApiErrorMessage = (err, fallbackMessage) => {
  const responseData = err?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (responseData?.message) {
    return responseData.message;
  }

  if (responseData?.error) {
    return responseData.error;
  }

  return fallbackMessage;
};

function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [pendingRegisterData, setPendingRegisterData] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setOtpError("");

    const { name, email, password, confirmPassword } = formData;

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const passwordRegex = /^(?=.*\d).{6,}$/;

    if (!passwordRegex.test(password)) {
      setError(
        "Password must be 6-18 characters and include a number"
      );
      return;
    }

    const payload = {
      username: name,
      email,
      password,
      phone: "",
      avatar: "",
      is_online: true,
      create_at: new Date().toISOString()
    };

    try {
      setIsSubmitting(true);
      await requestRegistrationOtp(payload);
      setPendingRegisterData(payload);
      setIsOtpModalOpen(true);
      setSuccess("OTP da duoc gui. Vui long kiem tra email.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Register failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseOtpModal = () => {
    if (isVerifyingOtp || isResendingOtp) return;
    setIsOtpModalOpen(false);
    setOtpError("");
  };

  const handleResendOtp = async () => {
    if (!pendingRegisterData) return;

    try {
      setOtpError("");
      setIsResendingOtp(true);
      await requestRegistrationOtp(pendingRegisterData);
      setSuccess("Da gui lai OTP thanh cong.");
    } catch (err) {
      setOtpError(getApiErrorMessage(err, "Khong the gui lai OTP."));
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleConfirmOtp = async (otp) => {
    if (!pendingRegisterData) return;

    try {
      setOtpError("");
      setIsVerifyingOtp(true);

      await verifyRegisterWithOtp({
        email: pendingRegisterData.email,
        otp
      });

      const loginData = await loginUser({
        email: pendingRegisterData.email,
        password: pendingRegisterData.password
      });

      localStorage.setItem("token", loginData.token);
      saveAuthUserToStorage(loginData.user);

      setIsOtpModalOpen(false);
      setPendingRegisterData(null);
      setSuccess("Dang ky thanh cong. Dang chuyen vao he thong...");

      setTimeout(() => {
        navigate("/home");
      }, 1000);
    } catch (err) {
      setOtpError(getApiErrorMessage(err, "OTP khong dung hoac da het han."));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-box">
        <img src="/logo.png" alt="Chatbox" className="register-logo" />
        <h1 className="register-title">Sign up with email</h1>
        <p className="register-subtitle">
          Get chatting with friends and family today by signing up for our chat app!
        </p>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Your name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
            />
            <p className="password-hint">
              Password must be 6-18 characters and include a number
            </p>
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}

          <button type="submit" className="register-btn" disabled={isSubmitting}>
            {isSubmitting ? "Đang gửi mã OTP..." : "Create an account"}
          </button>
        </form>

        <p className="switch-login">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>

      <OtpModal
        isOpen={isOtpModalOpen}
        email={pendingRegisterData?.email}
        error={otpError}
        isVerifying={isVerifyingOtp}
        isResending={isResendingOtp}
        onClose={handleCloseOtpModal}
        onConfirm={handleConfirmOtp}
        onResend={handleResendOtp}
      />
    </div>
  );
}

export default RegisterPage;