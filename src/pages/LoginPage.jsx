import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";
import { saveAuthUserToStorage } from "../utils/userNormalizer";
import facebookIcon from "../assets/icons/facebook.png";
import googleIcon from "../assets/icons/google.png";
import appleIcon from "../assets/icons/apple.png";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    const { email, password } = formData;

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      const data = await loginUser({ email, password });

      localStorage.setItem("token", data.token);
      saveAuthUserToStorage(data.user);

      setSuccess("Login successful. Redirecting...");

      setTimeout(() => {
        navigate("/home");
      }, 1200);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Login failed."
      );
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1 className="login-title">Login to Chatbox</h1>
        <p className="login-subtitle">
          Welcome back! Sign in using your social account or email to continue us
        </p>

        <div className="social-icons">
          <button className="social-btn" type="button">
            <img src={facebookIcon} alt="Facebook" className="social-img" />
          </button>

          <button className="social-btn" type="button">
            <img src={googleIcon} alt="Google" className="social-img" />
          </button>

          <button className="social-btn" type="button">
            <img src={appleIcon} alt="Apple" className="social-img" />
          </button>
        </div>

        <div className="or-divider">
          <span className="line"></span>
          <span className="or-text">OR</span>
          <span className="line"></span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Your email</label>
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
          </div>

          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}

          <button type="submit" className="login-btn">
            Log in
          </button>
        </form>

        <p className="forgot-password">Forgot password?</p>

        <p className="switch-auth">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;