import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaComments, FaCog, FaSave, FaArrowLeft, FaCamera } from "react-icons/fa";
import axios from "axios";
import { API_URL } from "@/config/api";
import { getMe, updateMe } from "@/features/profile/services/userService";
import {
  getAvatarUrl,
  getStoredAuthUser,
  normalizeUserEntity,
  saveAuthUserToStorage
} from "@/utils/userNormalizer";
import { prefetchHomeConversationsCache } from "@/utils/homeConversationCache";
import "./ProfilePage.css";

const toFormState = (user) => ({
  name: user?.name || user?.username || "",
  email: user?.email || "",
  phone: user?.phone || user?.phone_number || ""
});

function ProfilePage() {
  const AUTH_API_URL = `${API_URL}/api/auth`;
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [form, setForm] = useState(() => toFormState(getStoredAuthUser()));
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("account");
  const [securityView, setSecurityView] = useState("menu");
  const [securityStep, setSecurityStep] = useState(1);
  const [securityOtp, setSecurityOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");
  const securityOtpInputRefs = useRef([]);

  const resetSecurityFlowState = () => {
    setSecurityStep(1);
    setSecurityOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setSecurityLoading(false);
    setSecurityError("");
    setSecuritySuccess("");
  };

  const displayAvatar = useMemo(() => {
    if (previewUrl) return previewUrl;
    return getAvatarUrl(user);
  }, [previewUrl, user]);

  const profileEmail = useMemo(() => {
    return String(form.email || user?.email || "").trim();
  }, [form.email, user?.email]);

  useEffect(() => {
    const syncUser = async () => {
      setIsLoading(true);
      try {
        const me = await getMe();
        const normalized = normalizeUserEntity(me);
        setUser(normalized);
        setForm(toFormState(normalized));
        saveAuthUserToStorage(normalized);
      } catch (syncError) {
        const hasCachedUser = Boolean(getStoredAuthUser());
        if (!hasCachedUser) {
          setError(
            syncError?.response?.data?.message ||
              "Không thể đồng bộ thông tin mới nhất."
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    syncUser();
  }, []);

  useEffect(() => {
    prefetchHomeConversationsCache(user?.id);
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const updated = await updateMe(
        {
          name: form.name,
          phone: form.phone
        },
        avatarFile
      );

      const normalized = normalizeUserEntity(updated);
      setUser(normalized);
      setForm(toFormState(normalized));
      saveAuthUserToStorage(normalized);
      setAvatarFile(null);
      setPreviewUrl("");
      setSuccess("Cập nhật thông tin thành công.");
    } catch (saveError) {
      setError(
        saveError?.response?.data?.message ||
          "Không thể cập nhật thông tin. Vui lòng thử lại."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenTab = (tabName) => {
    setActiveTab(tabName);
    if (tabName === "security") {
      setSecurityView("menu");
      resetSecurityFlowState();
    } else {
      resetSecurityFlowState();
    }
    setError("");
    setSuccess("");
  };

  const openChangePasswordFlow = () => {
    setSecurityView("changePassword");
    resetSecurityFlowState();
  };

  const backToSecurityMenu = () => {
    setSecurityView("menu");
    resetSecurityFlowState();
  };

  const handleSendPasswordOtp = async () => {
    if (!profileEmail) {
      setSecurityError("Email không hợp lệ để gửi OTP.");
      return;
    }

    try {
      setSecurityLoading(true);
      setSecurityError("");
      setSecuritySuccess("");

      await axios.post(`${AUTH_API_URL}/forgot-password`, {
        email: profileEmail
      });

      setSecurityOtp("");
      setSecurityStep(2);
      setSecuritySuccess("OTP đã được gửi về email của bạn.");
    } catch (requestError) {
      setSecurityError(
        requestError?.response?.data?.message ||
          requestError?.response?.data ||
          "Không thể gửi OTP."
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleVerifyOtpFormat = () => {
    const normalized = String(securityOtp || "").replace(/\D/g, "");
    if (normalized.length !== 6) {
      setSecurityError("OTP phải gồm đúng 6 chữ số.");
      return;
    }

    setSecurityError("");
    setSecuritySuccess("");
    setSecurityOtp(normalized);
    setSecurityStep(3);
  };

  const setSecurityOtpDigitAt = (index, value) => {
    const nextDigits = Array.from({ length: 6 }, (_, digitIndex) => securityOtp[digitIndex] || "");
    nextDigits[index] = value;
    setSecurityOtp(nextDigits.join(""));
  };

  const handleSecurityOtpChange = (index, rawValue) => {
    const numericValue = String(rawValue || "").replace(/\D/g, "");

    if (!numericValue) {
      setSecurityOtpDigitAt(index, "");
      return;
    }

    const digit = numericValue[numericValue.length - 1];
    setSecurityOtpDigitAt(index, digit);

    if (index < 5) {
      securityOtpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSecurityOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !securityOtp[index] && index > 0) {
      securityOtpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      securityOtpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      securityOtpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSecurityOtpPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const nextDigits = Array.from({ length: 6 }, () => "");
    pasted.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    setSecurityOtp(nextDigits.join(""));

    const focusIndex = Math.min(pasted.length, 6) - 1;
    securityOtpInputRefs.current[Math.max(focusIndex, 0)]?.focus();
  };

  const handleResendPasswordOtp = async () => {
    if (!profileEmail) {
      setSecurityError("Email không hợp lệ để gửi lại OTP.");
      return;
    }

    try {
      setSecurityLoading(true);
      setSecurityError("");
      setSecuritySuccess("");

      await axios.post(`${AUTH_API_URL}/forgot-password`, {
        email: profileEmail,
        resend: true
      });

      setSecuritySuccess("Đã gửi lại OTP.");
    } catch (requestError) {
      setSecurityError(
        requestError?.response?.data?.message ||
          requestError?.response?.data ||
          "Không thể gửi lại OTP."
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (securityView !== "changePassword" || securityStep !== 3) {
      setSecurityError("Vui lòng hoàn thành đủ 3 bước trước khi đổi mật khẩu.");
      return;
    }

    const normalizedOtp = String(securityOtp || "").replace(/\D/g, "");

    if (normalizedOtp.length !== 6) {
      setSecurityError("OTP không hợp lệ.");
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      setSecurityError("Vui lòng nhập đầy đủ mật khẩu mới.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setSecurityError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (newPassword.length < 6) {
      setSecurityError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    try {
      setSecurityLoading(true);
      setSecurityError("");
      setSecuritySuccess("");

      await axios.post(`${AUTH_API_URL}/reset-password`, {
        email: profileEmail,
        otp: normalizedOtp,
        newPassword,
        password: newPassword
      });

      setSecuritySuccess("Đổi mật khẩu thành công.");
      setSecurityStep(1);
      setSecurityOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (requestError) {
      setSecurityError(
        requestError?.response?.data?.message ||
          requestError?.response?.data ||
          "Không thể đổi mật khẩu."
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <div className="profile-layout">
      <aside className="profile-sidebar">
        <div className="profile-sidebar-top">
          <img src={getAvatarUrl(user)} alt="user avatar" className="profile-sidebar-avatar" />
          <h3>{user?.name || "User"}</h3>
        </div>

        <div className="profile-menu">
          <Link to="/home" className="profile-menu-item">
            <FaComments />
            <span>Message</span>
          </Link>
          <div className="profile-menu-item active">
            <FaCog />
            <span>Profile</span>
          </div>
        </div>
      </aside>

      <main className="profile-main">
        <div className="profile-topbar">
          <Link to="/home" className="back-home-btn">
            <FaArrowLeft />
            <span>Quay lại chat</span>
          </Link>
          {isLoading && <span className="sync-text">Đang đồng bộ dữ liệu...</span>}
        </div>

        <section className="profile-card">
          <div className="profile-hero">
            <div className="profile-hero-avatar-wrap">
              <img src={displayAvatar} alt="profile" className="profile-hero-avatar" />
              <label className="avatar-upload-btn" htmlFor="avatar-upload-input">
                <FaCamera />
              </label>
              <input
                id="avatar-upload-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                hidden
              />
            </div>

            <div>
              <h1>{form.name || "Người dùng"}</h1>
              <p>{form.email || "Chưa cập nhật email"}</p>
            </div>
          </div>

          <div className="profile-tabs">
            <button
              type="button"
              className={`tab-item ${activeTab === "account" ? "active" : ""}`}
              onClick={() => handleOpenTab("account")}
            >
              Tài khoản
            </button>
            <button
              type="button"
              className={`tab-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => handleOpenTab("settings")}
            >
              Cấu hình
            </button>
            <button
              type="button"
              className={`tab-item ${activeTab === "security" ? "active" : ""}`}
              onClick={() => handleOpenTab("security")}
            >
              Bảo mật
            </button>
          </div>

          {activeTab === "account" && (
            <form className="profile-form" onSubmit={handleSaveProfile}>
              <h2>Thông tin cá nhân</h2>

              <div className="profile-grid">
                <label className="profile-field">
                  <span>Tên hiển thị</span>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleFieldChange}
                    placeholder="Nhập tên"
                  />
                </label>

                <label className="profile-field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    readOnly
                    placeholder="Nhập email"
                  />
                </label>

                <label className="profile-field">
                  <span>Số điện thoại</span>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleFieldChange}
                    placeholder="Nhập số điện thoại"
                  />
                </label>
              </div>

              {error && <p className="profile-error">{error}</p>}
              {success && <p className="profile-success">{success}</p>}

              <button type="submit" className="save-profile-btn" disabled={isSaving}>
                <FaSave />
                <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
              </button>
            </form>
          )}

          {activeTab === "settings" && (
            <section className="profile-form">
              <h2>Cấu hình</h2>
              <p className="profile-placeholder-text">Mục cấu hình đang được cập nhật.</p>
            </section>
          )}

          {activeTab === "security" && (
            <section className="profile-form security-form">
              {securityView === "menu" && (
                <>
                  <h2>Bảo mật tài khoản</h2>

                  <div className="security-menu-list">
                    <button
                      type="button"
                      className="security-menu-item"
                      onClick={openChangePasswordFlow}
                    >
                      <span className="security-menu-item-title">Đổi mật khẩu</span>
                    </button>
                  </div>
                </>
              )}

              {securityView === "changePassword" && (
                <>
                  <div className="security-header-row">
                    <h2>Đổi mật khẩu</h2>
                    <button
                      type="button"
                      className="security-back-btn"
                      onClick={backToSecurityMenu}
                      disabled={securityLoading}
                    >
                      Quay lại
                    </button>
                  </div>
                  <p className="security-subtitle">Xác thực bằng OTP để đổi mật khẩu an toàn.</p>
                  <p className="security-note-text">Mật khẩu chỉ được cập nhật khi bạn bấm nút Đổi mật khẩu ở bước cuối.</p>

                  <div className="security-step-row" aria-hidden="true">
                    <span className={`security-step-item ${securityStep >= 1 ? "active" : ""}`} />
                    <span className={`security-step-item ${securityStep >= 2 ? "active" : ""}`} />
                    <span className={`security-step-item ${securityStep >= 3 ? "active" : ""}`} />
                  </div>

                  {securityStep === 1 && (
                    <div className="security-actions">
                      <label className="profile-field">
                        <span>Email nhận OTP</span>
                        <input type="email" value={profileEmail} readOnly />
                      </label>
                      <button
                        type="button"
                        className="security-primary-btn"
                        onClick={handleSendPasswordOtp}
                        disabled={securityLoading}
                      >
                        {securityLoading ? "Đang gửi OTP..." : "Gửi OTP"}
                      </button>
                    </div>
                  )}

                  {securityStep === 2 && (
                    <div className="security-actions">
                      <label className="profile-field">
                        <span>OTP (6 chữ số)</span>
                        <div className="security-otp-inputs" onPaste={handleSecurityOtpPaste}>
                          {Array.from({ length: 6 }, (_, index) => (
                            <input
                              key={index}
                              ref={(element) => {
                                securityOtpInputRefs.current[index] = element;
                              }}
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={1}
                              className="security-otp-input"
                              value={securityOtp[index] || ""}
                              onChange={(event) => handleSecurityOtpChange(index, event.target.value)}
                              onKeyDown={(event) => handleSecurityOtpKeyDown(index, event)}
                            />
                          ))}
                        </div>
                      </label>

                      <button
                        type="button"
                        className="security-primary-btn"
                        onClick={handleVerifyOtpFormat}
                        disabled={securityLoading}
                      >
                        Tiếp tục
                      </button>

                      <button
                        type="button"
                        className="security-secondary-btn"
                        onClick={handleResendPasswordOtp}
                        disabled={securityLoading}
                      >
                        {securityLoading ? "Đang gửi lại..." : "Gửi lại OTP"}
                      </button>
                    </div>
                  )}

                  {securityStep === 3 && (
                    <div className="security-actions">
                      <label className="profile-field">
                        <span>Mật khẩu mới</span>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                      </label>

                      <label className="profile-field">
                        <span>Nhập lại mật khẩu mới</span>
                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(event) => setConfirmNewPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                      </label>

                      <button
                        type="button"
                        className="security-primary-btn"
                        onClick={handleChangePassword}
                        disabled={securityLoading}
                      >
                        {securityLoading ? "Đang cập nhật..." : "Đổi mật khẩu"}
                      </button>
                    </div>
                  )}

                  {securityError && <p className="profile-error">{securityError}</p>}
                  {securitySuccess && <p className="profile-success">{securitySuccess}</p>}
                </>
              )}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;