import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaComments, FaCog, FaSave, FaArrowLeft, FaCamera } from "react-icons/fa";
import { getMe, updateMe } from "../services/userService";
import {
  getAvatarUrl,
  getStoredAuthUser,
  normalizeUserEntity,
  saveAuthUserToStorage
} from "../utils/userNormalizer";
import "./ProfilePage.css";

const toFormState = (user) => ({
  name: user?.name || user?.username || "",
  email: user?.email || "",
  phone: user?.phone || user?.phone_number || ""
});

function ProfilePage() {
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [form, setForm] = useState(() => toFormState(getStoredAuthUser()));
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const displayAvatar = useMemo(() => {
    if (previewUrl) return previewUrl;
    return getAvatarUrl(user);
  }, [previewUrl, user]);

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
            <button type="button" className="tab-item active">
              Tài khoản
            </button>
            <button type="button" className="tab-item">
              Cấu hình
            </button>
            <button type="button" className="tab-item">
              Bảo mật
            </button>
          </div>

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
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;