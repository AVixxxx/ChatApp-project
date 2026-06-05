import { useEffect, useRef } from "react";
import { FaEllipsisV } from "react-icons/fa";

function MessageActions({
  isOpen,
  message,
  onToggle,
  onClose,
  canRecall,
  canDeleteForMe,
  onReplyMessage,
  onCopyMessage,
  onCopyImage,
  onDownloadImage,
  onDownloadFile,
  onForwardMessage,
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

  const messageType =
    message?.type ||
    message?.messageType ||
    message?.message_type ||
    (message?.fileUrl || message?.file_url ? "file" : "text");
  const groupedItems = Array.isArray(message?.groupedItems) ? message.groupedItems : [];
  const hasGroupedItems = groupedItems.length > 1;
  const isRecalled = Boolean(message?.isRecalled ?? message?.is_recalled);

  const closeAfter = (handler) => () => {
    handler?.(message);
    onClose?.();
  };

  const forwardButton = (
    <button
      type="button"
      className="message-action-item"
      onClick={closeAfter(onForwardMessage)}
    >
      Chuyển tiếp
    </button>
  );

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
                onClick={closeAfter(onDeleteMessage)}
              >
                Xóa với tôi
              </button>
            ) : null
          ) : messageType === "image" ? (
            <>
              <button
                type="button"
                className="message-action-item"
                onClick={closeAfter(onReplyMessage)}
              >
                Trả lời
              </button>
              <button
                type="button"
                className="message-action-item"
                onClick={closeAfter(onCopyImage)}
              >
                Sao chép ảnh
              </button>
              <button
                type="button"
                className="message-action-item"
                onClick={closeAfter(onDownloadImage)}
              >
                Tải ảnh xuống
              </button>
              {forwardButton}
              {canRecall ? (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={closeAfter(onRecallMessage)}
                  >
                    Thu hồi ảnh
                  </button>
                  {hasGroupedItems ? (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={closeAfter(onRecallMessageGroup)}
                    >
                      Thu hồi tất cả ảnh
                    </button>
                  ) : null}
                </>
              ) : null}
              {canDeleteForMe ? (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={closeAfter(onDeleteMessage)}
                  >
                    Xóa ảnh với tôi
                  </button>
                  {hasGroupedItems ? (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={closeAfter(onDeleteMessageGroup)}
                    >
                      Xóa tất cả ảnh với tôi
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : messageType === "file" ? (
            <>
              <button
                type="button"
                className="message-action-item"
                onClick={closeAfter(onReplyMessage)}
              >
                Trả lời
              </button>
              <button
                type="button"
                className="message-action-item"
                onClick={closeAfter(onDownloadFile)}
              >
                Tải tệp xuống
              </button>
              {forwardButton}
              {canRecall ? (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={closeAfter(onRecallMessage)}
                  >
                    Thu hồi tệp
                  </button>
                  {hasGroupedItems ? (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={closeAfter(onRecallMessageGroup)}
                    >
                      Thu hồi tất cả tệp
                    </button>
                  ) : null}
                </>
              ) : null}
              {canDeleteForMe ? (
                <>
                  <button
                    type="button"
                    className="message-action-item"
                    onClick={closeAfter(onDeleteMessage)}
                  >
                    Xóa tệp với tôi
                  </button>
                  {hasGroupedItems ? (
                    <button
                      type="button"
                      className="message-action-item"
                      onClick={closeAfter(onDeleteMessageGroup)}
                    >
                      Xóa tất cả tệp với tôi
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                className="message-action-item"
                onClick={closeAfter(onReplyMessage)}
              >
                Trả lời
              </button>
              <button
                type="button"
                className="message-action-item"
                onClick={closeAfter(onCopyMessage)}
              >
                Sao chép tin nhắn
              </button>
              {forwardButton}
              {canRecall ? (
                <button
                  type="button"
                  className="message-action-item"
                  onClick={closeAfter(onRecallMessage)}
                >
                  Thu hồi tin nhắn
                </button>
              ) : null}
              {canDeleteForMe ? (
                <button
                  type="button"
                  className="message-action-item"
                  onClick={closeAfter(onDeleteMessage)}
                >
                  Xóa với tôi
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageActions;
