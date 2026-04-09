import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/config/api";
import { getStoredAuthUser } from "@/utils/userNormalizer";
import { getMe } from "@/features/profile/services/userService";

const API_BASE = `${API_URL}/api/auth`;

const STEP_TITLES = {
  1: "Forgot Password",
  2: "Verify OTP",
  3: "Reset Password"
};

const STEP_DESCRIPTIONS = {
  1: "We will send a one-time password to your email.",
  2: "Enter the 6-digit OTP that you received.",
  3: "Create a new password for your account."
};

const getApiErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;

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

const postWithFallback = async (urlList, payload, fallbackError) => {
  let lastError = null;

  for (const url of urlList) {
    try {
      const response = await axios.post(url, payload);
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;

      // If endpoint is missing or method is not supported, try next endpoint.
      if (status === 404 || status === 405) {
        continue;
      }

      // For API-level validation errors, stop and show message.
      throw error;
    }
  }

  throw lastError || new Error(fallbackError);
};

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = useMemo(() => getStoredAuthUser(), []);
  const emailFromRoute =
    typeof location.state?.email === "string" ? location.state.email.trim() : "";

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(emailFromRoute || storedUser?.email || "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (emailFromRoute && !email) {
      setEmail(emailFromRoute);
    }
  }, [emailFromRoute, email]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (email && email.trim()) return;

    let isMounted = true;

    const hydrateEmailFromMe = async () => {
      try {
        const me = await getMe();
        const resolvedEmail =
          typeof me?.email === "string" ? me.email.trim() : "";
        if (isMounted && resolvedEmail) {
          setEmail(resolvedEmail);
        }
      } catch {
        // Keep page usable even when /me fails.
      }
    };

    hydrateEmailFromMe();

    return () => {
      isMounted = false;
    };
  }, [email]);

  const sendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await postWithFallback(
        [`${API_BASE}/forgot-password`],
        { email: email.trim() },
        "Cannot send OTP right now."
      );

      setStep(2);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Cannot send OTP right now."));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const normalizedOtp = otp.replace(/\D/g, "");

    if (normalizedOtp.length !== 6) {
      setError("OTP must contain exactly 6 digits.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await postWithFallback(
        [
          `${API_BASE}/verify-reset-otp`,
          `${API_BASE}/verify-forgot-password`,
          `${API_BASE}/forgot-password/verify`,
          `${API_BASE}/forgot-password`
        ],
        {
          email: email.trim(),
          otp: normalizedOtp,
          verify: true,
          action: "verify"
        },
        "OTP verification is not available right now."
      );

      setStep(3);
    } catch (verifyError) {
      setError(
        getApiErrorMessage(verifyError, "OTP is invalid or expired. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      setLoading(true);
      setError("");

      await postWithFallback(
        [`${API_BASE}/forgot-password`],
        { email: email.trim(), resend: true },
        "Cannot resend OTP right now."
      );
    } catch (resendError) {
      setError(getApiErrorMessage(resendError, "Cannot resend OTP right now."));
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!password || !confirmPassword) {
      setError("Please enter both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await postWithFallback(
        [`${API_BASE}/reset-password`],
        {
          email: email.trim(),
          otp: otp.replace(/\D/g, ""),
          password,
          newPassword: password
        },
        "Cannot update password right now."
      );

      navigate("/login", {
        replace: true,
        state: { resetDone: true }
      });
    } catch (resetError) {
      setError(getApiErrorMessage(resetError, "Cannot update password right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-page">
      <style>
        {`
          .forgot-page {
            min-height: 100dvh;
            background: linear-gradient(125deg, #1c1f6f 0%, #4a1b7a 52%, #0f5a95 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
          }

          .forgot-card {
            width: 100%;
            max-width: 520px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            box-shadow: 0 14px 34px rgba(14, 25, 61, 0.22);
            padding: 28px 24px 24px;
            animation: fadeInUp 0.28s ease;
          }

          .forgot-logo {
            width: 115px;
            display: block;
            margin: 0 auto 8px;
          }

          .forgot-title {
            margin: 0;
            color: #121a38;
            font-size: 30px;
            text-align: center;
          }

          .forgot-subtitle {
            margin: 10px 0 18px;
            text-align: center;
            color: #5f6478;
            font-size: 14px;
          }

          .forgot-step-row {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
          }

          .forgot-step-item {
            flex: 1;
            height: 6px;
            border-radius: 999px;
            background: #d9dff4;
            transition: background-color 0.2s ease;
          }

          .forgot-step-item.active {
            background: #2f6ee8;
          }

          .forgot-form {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .forgot-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #2f3754;
          }

          .forgot-group input {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #d8dce8;
            border-radius: 10px;
            background: #fff;
            padding: 12px 14px;
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
          }

          .forgot-group input:focus {
            border-color: #5f56ff;
            box-shadow: 0 0 0 3px rgba(95, 86, 255, 0.15);
          }

          .forgot-error {
            margin: 0;
            color: #d93025;
            font-size: 14px;
            background: #fde8e7;
            border: 1px solid #f7c5c2;
            border-radius: 10px;
            padding: 10px 12px;
          }

          .forgot-primary-btn,
          .forgot-secondary-btn,
          .forgot-text-btn {
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: transform 0.18s ease, filter 0.18s ease;
          }

          .forgot-primary-btn {
            width: 100%;
            height: 46px;
            background: linear-gradient(120deg, #1866cc 0%, #5e35d5 100%);
            color: #fff;
            font-size: 17px;
            font-weight: 600;
          }

          .forgot-primary-btn:hover:not(:disabled),
          .forgot-secondary-btn:hover:not(:disabled),
          .forgot-text-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            filter: brightness(1.03);
          }

          .forgot-secondary-btn {
            width: 100%;
            height: 44px;
            background: #eff3ff;
            color: #244cc2;
            font-size: 15px;
            font-weight: 600;
          }

          .forgot-text-btn {
            width: 100%;
            height: 40px;
            background: transparent;
            color: #3d4668;
            font-size: 14px;
            border: 1px solid #d8dce8;
          }

          .forgot-primary-btn:disabled,
          .forgot-secondary-btn:disabled,
          .forgot-text-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .forgot-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-top: 6px;
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (max-width: 560px) {
            .forgot-card {
              padding: 22px 16px;
              border-radius: 14px;
            }

            .forgot-title {
              font-size: 25px;
            }
          }
        `}
      </style>

      <div className="forgot-card">
        <img src="/logo.png" alt="Chatbox" className="forgot-logo" />
        <h1 className="forgot-title">{STEP_TITLES[step]}</h1>
        <p className="forgot-subtitle">{STEP_DESCRIPTIONS[step]}</p>

        <div className="forgot-step-row" aria-hidden="true">
          <span className={`forgot-step-item ${step >= 1 ? "active" : ""}`} />
          <span className={`forgot-step-item ${step >= 2 ? "active" : ""}`} />
          <span className={`forgot-step-item ${step >= 3 ? "active" : ""}`} />
        </div>

        <form className="forgot-form" onSubmit={(event) => event.preventDefault()}>
          {step === 1 && (
            <>
              <div className="forgot-group">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {error && <p className="forgot-error">{error}</p>}

              <button
                type="button"
                className="forgot-primary-btn"
                onClick={sendOtp}
                disabled={loading}
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="forgot-group">
                <label htmlFor="forgot-otp">OTP (6 digits)</label>
                <input
                  id="forgot-otp"
                  type="text"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter OTP"
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>

              {error && <p className="forgot-error">{error}</p>}

              <div className="forgot-actions">
                <button
                  type="button"
                  className="forgot-primary-btn"
                  onClick={verifyOtp}
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
                <button
                  type="button"
                  className="forgot-secondary-btn"
                  onClick={resendOtp}
                  disabled={loading}
                >
                  {loading ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="forgot-group">
                <label htmlFor="forgot-password">New Password</label>
                <input
                  id="forgot-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="forgot-group">
                <label htmlFor="forgot-confirm-password">Confirm Password</label>
                <input
                  id="forgot-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="forgot-error">{error}</p>}

              <button
                type="button"
                className="forgot-primary-btn"
                onClick={updatePassword}
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </>
          )}

          <button
            type="button"
            className="forgot-text-btn"
            onClick={() => navigate("/login")}
            disabled={loading}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
