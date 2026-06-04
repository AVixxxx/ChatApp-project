import { useEffect, useMemo, useState } from "react";
import { FaTimes, FaUserCircle, FaPhoneAlt, FaEnvelope, FaTrashAlt, FaSpinner } from "react-icons/fa";
import { getAvatarUrl } from "@/utils/userNormalizer";
import "./FriendProfileModal.css";

function FriendProfileModal({ isOpen, contact, onClose, onUnfriend, initialAction = "view" }) {
  const [isConfirmingUnfriend, setIsConfirmingUnfriend] = useState(false);
  const [isSubmittingUnfriend, setIsSubmittingUnfriend] = useState(false);
  const [actionToast, setActionToast] = useState(null);

  useEffect(() => {
    setIsConfirmingUnfriend(isOpen && initialAction === "unfriend");
    setIsSubmittingUnfriend(false);
    setActionToast(null);
  }, [contact, initialAction, isOpen]);

  useEffect(() => {
    if (!actionToast) return undefined;

    const timeout = window.setTimeout(() => {
      setActionToast(null);
      if (actionToast.type === "success") {
        onClose?.();
      }
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [actionToast, onClose]);

  const toastClassName = useMemo(
    () => `friend-profile-toast ${actionToast?.type === "error" ? "is-error" : "is-success"}`,
    [actionToast]
  );

  if (!isOpen || !contact) return null;

  const displayName = contact?.name || contact?.raw?.username || "Người dùng";
  const displayPhone =
    contact?.phone ||
    contact?.phone_number ||
    contact?.raw?.phone ||
    contact?.raw?.phone_number ||
    "Chưa cập nhật";
  const displayEmail = contact?.email || contact?.raw?.email || "Chưa cập nhật";

  const handleOpenUnfriendConfirm = () => {
    setIsConfirmingUnfriend(true);
  };

  const handleCloseUnfriendConfirm = () => {
    if (isSubmittingUnfriend) return;
    setIsConfirmingUnfriend(false);
  };

  const handleConfirmUnfriend = async () => {
    if (isSubmittingUnfriend) return;

    setIsSubmittingUnfriend(true);

    try {
      await onUnfriend?.(contact);
      setActionToast({ type: "success", message: "Đã hủy kết bạn" });
      setIsConfirmingUnfriend(false);
    } catch (error) {
      console.error("Failed to unfriend:", error);
      setActionToast({ type: "error", message: "Không thể hủy kết bạn lúc này" });
    } finally {
      setIsSubmittingUnfriend(false);
    }
  };

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

        <div className="friend-profile-actions">
          <button
            type="button"
            className="friend-profile-danger-btn"
            onClick={handleOpenUnfriendConfirm}
          >
            <FaTrashAlt />
            Xóa bạn bè
          </button>
        </div>

        {actionToast && (
          <div className={toastClassName} role="status" aria-live="polite">
            <span>{actionToast.message}</span>
          </div>
        )}

        {isConfirmingUnfriend && (
          <div className="friend-profile-confirm-overlay" onClick={handleCloseUnfriendConfirm}>
            <div
              className="friend-profile-confirm-dialog"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Xác nhận xóa bạn bè"
            >
              <h4>Xóa bạn bè</h4>
              <p>Bạn có chắc muốn xóa bạn bè này không?</p>
              <div className="friend-profile-confirm-actions">
                <button
                  type="button"
                  className="friend-profile-cancel-btn"
                  onClick={handleCloseUnfriendConfirm}
                  disabled={isSubmittingUnfriend}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="friend-profile-confirm-btn"
                  onClick={handleConfirmUnfriend}
                  disabled={isSubmittingUnfriend}
                >
                  {isSubmittingUnfriend ? <FaSpinner className="spin" /> : null}
                  Xóa bạn bè
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FriendProfileModal;
