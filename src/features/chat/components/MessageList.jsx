import { FaDownload, FaFileAlt, FaFilePdf, FaFileWord, FaHeart } from "react-icons/fa";
import MessageActions from "./MessageActions";
import VoiceMessagePlayer from "./VoiceMessagePlayer";

const getMessageType = (message) =>
  message?.type ||
  message?.messageType ||
  message?.message_type ||
  (message?.fileUrl || message?.file_url ? "file" : "text");

const getMessageAttachmentUrl = (message) =>
  message?.imageUrl || message?.fileUrl || message?.file_url || "";

const getMessageTimestamp = (message) =>
  message?.createdAt || message?.created_at || message?.create_at || "";

const isSystemMessage = (message) =>
  Boolean(
    message?.isSystemMessage ||
      message?.is_system_message ||
      message?.type === "system" ||
      message?.messageType === "system" ||
      message?.message_type === "system"
  );

const isAttachmentMessageType = (messageType) =>
  messageType === "image" ||
  messageType === "file" ||
  messageType === "voice" ||
  messageType === "audio";

const isPollMessageType = (messageType) => messageType === "poll";

function PollMessageCard({ poll, creatorName, onVotePoll, isVoting = false }) {
  const options = Array.isArray(poll?.options) ? poll.options : [];

  return (
    <div className="poll-card">
      <div className="poll-card-header">
        <h5>{poll?.question || "Poll"}</h5>
        {creatorName ? <span>{creatorName}</span> : null}
      </div>

      <div className="poll-options">
        {options.map((option, index) => {
          const optionLabel =
            typeof option === "string" ? option : option?.option_text || option?.text || "";
          const optionId = option?.option_id || option?.id || null;
          const voteCount = Number(option?.vote_count || 0);
          const isVotedByMe = Boolean(option?.is_voted_by_me);

          return (
            <div
              key={option?.option_id || option?.id || `${optionLabel}-${index}`}
              className={`poll-option-wrapper ${isVotedByMe ? "voted-option" : ""}`}
            >
              <button
                type="button"
                className="poll-option-btn"
                disabled={!optionId || isVoting}
                onClick={() => onVotePoll?.(poll?.pollId, optionId)}
              >
                <span>{optionLabel}</span>
                <span>{voteCount}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

const getFileExtension = (fileName) => {
  const safeName = String(fileName || "").trim().toLowerCase();
  if (!safeName || !safeName.includes(".")) return "";
  return safeName.split(".").pop() || "";
};

const getFileIconByName = (fileName) => {
  const extension = getFileExtension(fileName);

  if (extension === "pdf") {
    return FaFilePdf;
  }

  if (extension === "docx" || extension === "doc") {
    return FaFileWord;
  }

  return FaFileAlt;
};

const getFilePresentation = (fileName) => {
  const extension = getFileExtension(fileName);

  if (extension === "pdf") {
    return {
      Icon: FaFilePdf,
      iconClassName: "message-file-icon message-file-icon--pdf",
      typeLabel: "PDF"
    };
  }

  if (extension === "docx" || extension === "doc") {
    return {
      Icon: FaFileWord,
      iconClassName: "message-file-icon message-file-icon--word",
      typeLabel: extension.toUpperCase()
    };
  }

  return {
    Icon: getFileIconByName(fileName),
    iconClassName: "message-file-icon",
    typeLabel: extension ? extension.toUpperCase() : "FILE"
  };
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
  getMessageSenderName,
  isGroupConversation,
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
  onReplyMessage,
  highlightedMessageId,
  onReplyPreviewDoubleClick,
  onCopyMessage,
  onCopyImage,
  onDownloadImage,
  onDownloadFile,
  onForwardMessage,
  onVotePoll,
  votingPollId,
  onRecallMessage,
  onRecallMessageGroup,
  onDeleteMessage,
  onDeleteMessageGroup
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
            const isSystem = isSystemMessage(latestMessage);
            const isMe = group.senderId === String(userId || "");
            const messageType = group.type;
            const hasMultipleItems = group.items.length > 1;
            const isRecalled = Boolean(
              latestMessage?.isRecalled ?? latestMessage?.is_recalled
            );
            const replyPreview = latestMessage?.replyPreview || latestMessage?.reply_preview;
            const groupMessageIds = group.items
              .map((item) => String(item?.id || item?.message_id || item?._id || ""))
              .filter(Boolean);
            const isHighlighted = groupMessageIds.includes(String(highlightedMessageId || ""));
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

            if (isSystem) {
              return (
                <div key={group.id} className="message-row system-row">
                  <div className="system-message">
                    <span className="system-message-text">
                      {latestMessage?.text || "Group updated"}
                    </span>
                    <span className="system-message-time">
                      {formatTime(getMessageTimestamp(latestMessage))}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={group.id}
                className={`message-row ${isMe ? "me-row" : "other-row"} ${isHighlighted ? "is-reply-highlight" : ""}`}
                data-message-ids={groupMessageIds.join(" ")}
                tabIndex={-1}
              >
                {!isMe && (
                  <div className="message-sender-column">
                    <img
                      src={getMessageSenderAvatar(latestMessage)}
                      alt="sender"
                      className="message-avatar"
                    />
                    {isGroupConversation ? (
                      <span className="message-sender-name">
                        {getMessageSenderName?.(latestMessage) || "Unknown"}
                      </span>
                    ) : null}
                  </div>
                )}

                <div className={`message-block ${isMe ? "me-block" : ""}`}>
                  <div className="message-card">
                    <MessageActions
                      isOpen={openMessageActionsId === latestMessage.id}
                      message={actionMessage}
                      onToggle={() => onToggleMessageActions?.(latestMessage.id)}
                      onClose={onCloseMessageActions}
                      canRecall={isMe}
                      canDeleteForMe
                      onReplyMessage={onReplyMessage}
                      onCopyMessage={onCopyMessage}
                      onCopyImage={onCopyImage}
                      onDownloadImage={onDownloadImage}
                      onDownloadFile={onDownloadFile}
                      onForwardMessage={onForwardMessage}
                      onRecallMessage={onRecallMessage}
                      onRecallMessageGroup={onRecallMessageGroup}
                      onDeleteMessage={onDeleteMessage}
                      onDeleteMessageGroup={onDeleteMessageGroup}
                    />

                    <div className={`message ${isMe ? "me" : "other"} ${messageType === "image" ? "image-message" : ""} ${isRecalled ? "message-recalled" : ""}`}>
                      {latestMessage?.isForwarded ? (
                        <div className="message-forwarded-badge">Forwarded</div>
                      ) : null}
                      {replyPreview && (
                        <button
                          type="button"
                          className="message-reply-preview message-reply-preview--clickable"
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            onReplyPreviewDoubleClick?.(replyPreview);
                          }}
                          title="Double click to jump to original message"
                        >
                          <span className="message-reply-preview-indicator" aria-hidden="true" />
                          <div className="message-reply-preview-body">
                            <span className="message-reply-preview-sender">
                              {replyPreview.senderName || "Unknown"}
                            </span>
                            <span className="message-reply-preview-content">
                              {replyPreview.content || "Tin nhắn"}
                            </span>
                            {replyPreview.attachment?.name && (
                              <span className="message-reply-preview-attachment">
                                {replyPreview.attachment.name}
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                      {isRecalled ? (
                        <p>{latestMessage.text || "[Tin nhắn đã được thu hồi]"}</p>
                      ) : messageType === "image" ? (
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
                          {attachmentItems.map(({ message, fileName }, index) => {
                            const {
                              Icon: FileIcon,
                              iconClassName,
                              typeLabel
                            } = getFilePresentation(fileName);

                            return (
                              <button
                                key={message.id || `${group.id}-file-${index}`}
                                type="button"
                                className="message-file-button"
                                onClick={() => onDownloadFile?.(message)}
                                aria-label={`Download ${fileName}`}
                              >
                                <span className={iconClassName} aria-hidden="true">
                                  <FileIcon />
                                </span>
                                <span className="message-file-content">
                                  <span className="message-file-topline">
                                    <span className="message-file-name">{fileName}</span>
                                    <span className="message-file-type">{typeLabel}</span>
                                  </span>
                                  <span className="message-file-cta">
                                    <FaDownload />
                                    Download
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : messageType === "voice" || messageType === "audio" ? (
                        <div className="message-voice-list">
                          {attachmentItems.map(({ message, attachmentUrl }, index) => (
                            <VoiceMessagePlayer
                              key={message.id || `${group.id}-voice-${index}`}
                              message={message}
                              fileUrl={attachmentUrl}
                              onDownload={onDownloadFile}
                            />
                          ))}
                        </div>
                      ) : isPollMessageType(messageType) ? (
                        <PollMessageCard
                          poll={latestMessage?.poll}
                          creatorName={getMessageSenderName?.(latestMessage)}
                          onVotePoll={onVotePoll}
                          isVoting={String(votingPollId || "") === String(latestMessage?.poll?.pollId || "")}
                        />
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
