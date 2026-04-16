import { FaDownload, FaFileAlt, FaHeart } from "react-icons/fa";
import MessageActions from "./MessageActions";

const getMessageType = (message) =>
  message?.type ||
  message?.messageType ||
  message?.message_type ||
  (message?.fileUrl || message?.file_url ? "file" : "text");

const getMessageAttachmentUrl = (message) =>
  message?.imageUrl || message?.fileUrl || message?.file_url || "";

const getMessageTimestamp = (message) =>
  message?.createdAt || message?.created_at || message?.create_at || "";

const isAttachmentMessageType = (messageType) =>
  messageType === "image" || messageType === "file";

const getMessageFileName = (message, attachmentUrl) => {
  const explicitName = (message?.text || "").trim();
  if (explicitName) return explicitName;

  try {
    const pathname = new URL(attachmentUrl).pathname;
    const rawName = pathname.split("/").pop();
    if (rawName) return decodeURIComponent(rawName);
  } catch {
    // Ignore invalid URL and fallback to default text.
  }

  return "Attachment";
};

const buildMessageGroups = (messages, getUserId) => {
  const groups = [];

  messages.forEach((message) => {
    const messageType = getMessageType(message);
    const senderId = String(getUserId(message.sender) || message.sender_id || "");
    const timestamp = String(getMessageTimestamp(message));
    const shouldGroup = isAttachmentMessageType(messageType);
    const lastGroup = groups[groups.length - 1];

    if (
      shouldGroup &&
      lastGroup &&
      lastGroup.shouldGroup &&
      lastGroup.type === messageType &&
      lastGroup.senderId === senderId &&
      lastGroup.timestamp === timestamp
    ) {
      lastGroup.items.push(message);
      return;
    }

    groups.push({
      id: message.id || `${senderId}-${timestamp}-${groups.length}`,
      type: messageType,
      senderId,
      timestamp,
      shouldGroup,
      items: [message]
    });
  });

  return groups;
};

function MessageList({
  selectedConversationId,
  messages,
  userId,
  getUserId,
  getMessageSenderAvatar,
  formatTime,
  messagesEndRef,
  messagesContainerRef,
  onScroll,
  isLoadingOlderMessages,
  hasMoreMessages,
  isInitialMessagesLoading,
  onOpenImagePreview,
  openMessageActionsId,
  onToggleMessageActions,
  onCloseMessageActions,
  onCopyMessage,
  onCopyImage,
  onDownloadImage,
  onDownloadFile
}) {
  const groupedMessages = buildMessageGroups(messages, getUserId);

  return (
    <div className="messages" ref={messagesContainerRef} onScroll={onScroll}>
      {!selectedConversationId ? (
        <p className="empty-text">Please select a conversation.</p>
      ) : isInitialMessagesLoading ? (
        <p className="messages-loading-state">Loading messages...</p>
      ) : messages.length === 0 ? (
        <p className="empty-text">No messages yet.</p>
      ) : (
        <>
          {isLoadingOlderMessages && hasMoreMessages && (
            <div className="messages-loading-more">Loading older messages...</div>
          )}

          {groupedMessages.map((group) => {
            const latestMessage = group.items[group.items.length - 1];
            const isMe = group.senderId === String(userId || "");
            const messageType = group.type;
            const hasMultipleItems = group.items.length > 1;
            const actionMessage =
              hasMultipleItems && isAttachmentMessageType(messageType)
                ? {
                    ...latestMessage,
                    groupedItems: group.items
                  }
                : latestMessage;
            const attachmentItems = group.items.map((item) => {
              const attachmentUrl = getMessageAttachmentUrl(item);
              return {
                message: item,
                attachmentUrl,
                fileName: getMessageFileName(item, attachmentUrl)
              };
            });

            return (
              <div key={group.id} className={`message-row ${isMe ? "me-row" : "other-row"}`}>
                {!isMe && (
                  <img
                    src={getMessageSenderAvatar(latestMessage)}
                    alt="sender"
                    className="message-avatar"
                  />
                )}

                <div className={`message-block ${isMe ? "me-block" : ""}`}>
                  <div className="message-card">
                    <MessageActions
                      isOpen={openMessageActionsId === latestMessage.id}
                      message={actionMessage}
                      onToggle={() => onToggleMessageActions?.(latestMessage.id)}
                      onClose={onCloseMessageActions}
                      onCopyMessage={onCopyMessage}
                      onCopyImage={onCopyImage}
                      onDownloadImage={onDownloadImage}
                      onDownloadFile={onDownloadFile}
                    />

                    <div className={`message ${isMe ? "me" : "other"} ${messageType === "image" ? "image-message" : ""}`}>
                      {messageType === "image" ? (
                        <div className={`message-image-grid count-${Math.min(attachmentItems.length, 4)}`}>
                          {attachmentItems.map(({ message, attachmentUrl }, index) => (
                            <button
                              key={message.id || `${group.id}-img-${index}`}
                              type="button"
                              className="message-image-button"
                              onClick={() => onOpenImagePreview?.(message)}
                              aria-label="Open image preview"
                            >
                              <img
                                src={attachmentUrl}
                                alt={message.text || "Image message"}
                                className="message-image"
                              />
                            </button>
                          ))}
                        </div>
                      ) : messageType === "file" ? (
                        <div className="message-file-list">
                          {attachmentItems.map(({ message, fileName }, index) => (
                            <button
                              key={message.id || `${group.id}-file-${index}`}
                              type="button"
                              className="message-file-button"
                              onClick={() => onDownloadFile?.(message)}
                              aria-label={`Download ${fileName}`}
                            >
                              <span className="message-file-icon" aria-hidden="true">
                                <FaFileAlt />
                              </span>
                              <span className="message-file-content">
                                <span className="message-file-name">{fileName}</span>
                                <span className="message-file-cta">
                                  <FaDownload />
                                  Download
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p>{latestMessage.text}</p>
                      )}
                    </div>
                  </div>

                  <div className={`message-meta ${isMe ? "me-meta" : ""}`}>
                    {!isMe && <FaHeart className="quick-react" />}
                    <span>{formatTime(getMessageTimestamp(latestMessage))}</span>
                    {isMe && <FaHeart className="quick-react" />}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
      <div ref={messagesEndRef}></div>
    </div>
  );
}

export default MessageList;
