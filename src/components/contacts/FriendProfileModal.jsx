import { FaTimes, FaUserCircle, FaPhoneAlt, FaEnvelope } from "react-icons/fa";
import { getAvatarUrl } from "../../utils/userNormalizer";
import "./FriendProfileModal.css";

function FriendProfileModal({ isOpen, contact, onClose }) {
  if (!isOpen || !contact) return null;

  const displayName = contact?.name || contact?.raw?.username || "Người dùng";
  const displayPhone =
    contact?.phone ||
    contact?.phone_number ||
    contact?.raw?.phone ||
    contact?.raw?.phone_number ||
    "Chưa cập nhật";
  const displayEmail = contact?.email || contact?.raw?.email || "Chưa cập nhật";

  return (
    <div className="friend-profile-overlay" onClick={onClose}>
      <div
        className="friend-profile-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Thông tin bạn bè"
      >
        <div className="friend-profile-modal-header">
          <h3>Thông tin bạn bè</h3>
          <button type="button" className="friend-profile-close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="friend-profile-hero">
          <img
            src={getAvatarUrl(contact)}
            alt={displayName}
            className="friend-profile-avatar"
          />
          <div className="friend-profile-hero-text">
            <h2>{displayName}</h2>
            <p>{contact?.isOnline ? "Online" : "Offline"}</p>
          </div>
        </div>

        <div className="friend-profile-info-grid">
          <div className="friend-profile-info-item">
            <span className="friend-profile-icon-wrap">
              <FaUserCircle />
            </span>
            <div>
              <label>Tên</label>
              <p>{displayName}</p>
            </div>
          </div>

          <div className="friend-profile-info-item">
            <span className="friend-profile-icon-wrap">
              <FaPhoneAlt />
            </span>
            <div>
              <label>Số điện thoại</label>
              <p>{displayPhone}</p>
            </div>
          </div>

          <div className="friend-profile-info-item">
            <span className="friend-profile-icon-wrap">
              <FaEnvelope />
            </span>
            <div>
              <label>Email</label>
              <p>{displayEmail}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FriendProfileModal;
