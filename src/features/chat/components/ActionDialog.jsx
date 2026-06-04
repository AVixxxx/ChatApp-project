import { useEffect } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from "react-icons/fa";
import "./ActionDialog.css";

const toneConfig = {
  neutral: { icon: FaInfoCircle, className: "is-neutral" },
  warning: { icon: FaExclamationTriangle, className: "is-warning" },
  danger: { icon: FaExclamationTriangle, className: "is-danger" },
  success: { icon: FaCheckCircle, className: "is-success" }
};

function ActionDialog({
  isOpen,
  title,
  message,
  tone = "neutral",
  confirmLabel = "Đã hiểu",
  cancelLabel = "Hủy",
  showCancel = true,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const config = toneConfig[tone] || toneConfig.neutral;
  const Icon = config.icon;

  return (
    <div className="action-dialog-overlay" onClick={onCancel}>
      <div
        className={`action-dialog ${config.className}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Thông báo"}
      >
        <button type="button" className="action-dialog-close" onClick={onCancel} aria-label="Close dialog">
          <FaTimes />
        </button>

        <div className="action-dialog-icon-wrap" aria-hidden="true">
          <Icon className="action-dialog-icon" />
        </div>

        <div className="action-dialog-content">
          <h3 className="action-dialog-title">{title}</h3>
          <p className="action-dialog-message">{message}</p>
        </div>

        <div className="action-dialog-actions">
          {showCancel && (
            <button type="button" className="action-dialog-btn action-dialog-btn--secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button type="button" className="action-dialog-btn action-dialog-btn--primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionDialog;