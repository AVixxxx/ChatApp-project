import { useEffect, useRef } from "react";
import { FaEllipsisV } from "react-icons/fa";

function MessageActions({
  isOpen,
  message,
  onToggle,
  onClose,
  canDelete,
  onCopyMessage,
  onCopyImage,
  onDownloadImage,
  onDownloadFile,
  onDeleteMessage,
  onDeleteMessageGroup
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onClose]);

  const messageType = message?.type || message?.messageType || message?.message_type || (message?.fileUrl || message?.file_url ? "file" : "text");
  const groupedItems = Array.isArray(message?.groupedItems) ? message.groupedItems : [];
  const hasGroupedItems = groupedItems.length > 1;

  return (
    <div className="message-actions-wrap" ref={menuRef}>
      <button
        type="button"
        className="message-actions-trigger"
        onClick={(event) => {
          event.stopPropagation();
          onToggle?.();
        }}
        aria-label="Message actions"
      >
        <FaEllipsisV />
      </button>

      {isOpen && (
        <div className="message-actions-menu" onClick={(event) => event.stopPropagation()}>
          {messageType === "image" ? (
            <>
              <button
                type="button"
                className="message-action-item"
                onClick={() => {
                  onCopyImage?.(message);
                  onClose?.();
                }}
              >
                Copy image
              </button>
              <button
                type="button"
                className="message-action-item"
                onClick={() => {
                  onDownloadImage?.(message);
                  onClose?.();
                }}
              >
                Download image
              </button>
              {canDelete && (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={() => {
                      onDeleteMessage?.(message);
                      onClose?.();
                    }}
                  >
                    Delete image
                  </button>
                  {hasGroupedItems && (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={() => {
                        onDeleteMessageGroup?.(message);
                        onClose?.();
                      }}
                    >
                      Delete all in group
                    </button>
                  )}
                </>
              )}
            </>
          ) : messageType === "file" ? (
            <>
              <button
                type="button"
                className="message-action-item"
                onClick={() => {
                  onDownloadFile?.(message);
                  onClose?.();
                }}
              >
                Download file
              </button>
              {canDelete && (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={() => {
                      onDeleteMessage?.(message);
                      onClose?.();
                    }}
                  >
                    Delete file
                  </button>
                  {hasGroupedItems && (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={() => {
                        onDeleteMessageGroup?.(message);
                        onClose?.();
                      }}
                    >
                      Delete all in group
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="message-action-item"
                onClick={() => {
                  onCopyMessage?.(message);
                  onClose?.();
                }}
              >
                Copy message
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="message-action-item"
                  onClick={() => {
                    onDeleteMessage?.(message);
                    onClose?.();
                  }}
                >
                  Delete message
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageActions;