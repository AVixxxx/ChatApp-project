import { useEffect, useRef } from "react";
import { FaEllipsisV } from "react-icons/fa";

function MessageActions({
  isOpen,
  message,
  onToggle,
  onClose,
  canRecall,
  canDeleteForMe,
  onCopyMessage,
  onCopyImage,
  onDownloadImage,
  onDownloadFile,
  onRecallMessage,
  onRecallMessageGroup,
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
  const isRecalled = Boolean(message?.isRecalled ?? message?.is_recalled);

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
          {isRecalled ? (
            canDeleteForMe ? (
              <button
                type="button"
                className="message-action-item"
                onClick={() => {
                  onDeleteMessage?.(message);
                  onClose?.();
                }}
              >
                Xóa với tôi
              </button>
            ) : null
          ) : messageType === "image" ? (
            <>
              <button
                type="button"
                className="message-action-item"
                onClick={() => {
                  onCopyImage?.(message);
                  onClose?.();
                }}
              >
                Sao chép ảnh
              </button>
              <button
                type="button"
                className="message-action-item"
                onClick={() => {
                  onDownloadImage?.(message);
                  onClose?.();
                }}
              >
                Tải ảnh xuống
              </button>
              {canRecall && (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={() => {
                      onRecallMessage?.(message);
                      onClose?.();
                    }}
                  >
                    Thu hồi ảnh
                  </button>
                  {hasGroupedItems && (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={() => {
                        onRecallMessageGroup?.(message);
                        onClose?.();
                      }}
                    >
                      Thu hồi tất cả ảnh
                    </button>
                  )}
                </>
              )}
              {canDeleteForMe && (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={() => {
                      onDeleteMessage?.(message);
                      onClose?.();
                    }}
                  >
                    Xóa ảnh với tôi
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
                      Xóa tất cả ảnh với tôi
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
                Tải tệp xuống
              </button>
              {canRecall && (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={() => {
                      onRecallMessage?.(message);
                      onClose?.();
                    }}
                  >
                    Thu hồi tệp
                  </button>
                  {hasGroupedItems && (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={() => {
                        onRecallMessageGroup?.(message);
                        onClose?.();
                      }}
                    >
                      Thu hồi tất cả tệp
                    </button>
                  )}
                </>
              )}
              {canDeleteForMe && (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={() => {
                      onDeleteMessage?.(message);
                      onClose?.();
                    }}
                  >
                    Xóa tệp với tôi
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
                      Xóa tất cả tệp với tôi
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
                Sao chép tin nhắn
              </button>
              {canRecall && (
                <button
                  type="button"
                  className="message-action-item"
                  onClick={() => {
                    onRecallMessage?.(message);
                    onClose?.();
                  }}
                >
                  Thu hồi tin nhắn
                </button>
              )}
              {canDeleteForMe && (
                <button
                  type="button"
                  className="message-action-item"
                  onClick={() => {
                    onDeleteMessage?.(message);
                    onClose?.();
                  }}
                >
                  Xóa với tôi
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
