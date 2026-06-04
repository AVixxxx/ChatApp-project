import { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

function JoinByCodeModal({
  isOpen,
  code,
  onCodeChange,
  onClose,
  onSubmit,
  isSubmitting
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

  const normalizedCode = String(code || "");
  const canSubmit = normalizedCode.trim().length > 0 && !isSubmitting;

  return (
    <div
      className="group-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="group-modal group-code-modal" role="dialog" aria-modal="true" aria-label="Tham gia nhóm">
        <div className="group-modal-header">
          <h3>Tham gia nhóm</h3>
          <button type="button" className="group-modal-close" onClick={onClose} aria-label="Đóng">
            <FaTimes />
          </button>
        </div>

        <div className="group-modal-body">
          <input
            type="text"
            className="group-name-input group-code-input"
            placeholder="Nhập mã nhóm"
            value={normalizedCode}
            onChange={(event) => onCodeChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSubmit) {
                event.preventDefault();
                onSubmit?.();
              }
            }}
            autoFocus
            maxLength={24}
          />
        </div>

        <div className="group-modal-footer">
          <button type="button" className="group-cancel-btn" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </button>
          <button
            type="button"
            className="group-create-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Đang tham gia..." : "Tham gia"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinByCodeModal;
