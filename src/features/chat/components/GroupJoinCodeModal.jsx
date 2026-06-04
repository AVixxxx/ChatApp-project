import { useEffect } from "react";
import { FaCopy, FaTimes } from "react-icons/fa";

function GroupJoinCodeModal({
  isOpen,
  joinCode,
  isLoading,
  onClose,
  onCopy
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="group-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="group-modal group-code-modal" role="dialog" aria-modal="true" aria-label="Mã tham gia nhóm">
        <div className="group-modal-header">
          <h3>Mã tham gia nhóm</h3>
          <button type="button" className="group-modal-close" onClick={onClose} aria-label="Đóng">
            <FaTimes />
          </button>
        </div>

        <div className="group-modal-body group-code-display-wrap">
          {isLoading ? (
            <p className="group-helper-text">Đang tạo mã...</p>
          ) : (
            <div className="group-code-display">{joinCode || "------"}</div>
          )}
        </div>

        <div className="group-modal-footer">
          <button type="button" className="group-cancel-btn" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="group-create-btn"
            onClick={onCopy}
            disabled={!joinCode || isLoading}
          >
            <FaCopy />
            <span>Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupJoinCodeModal;
