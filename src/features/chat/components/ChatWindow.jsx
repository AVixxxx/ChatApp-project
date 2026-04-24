import { useState } from "react";
import { FaPhone, FaVideo, FaInfoCircle } from "react-icons/fa";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ImagePreviewModal from "./ImagePreviewModal";

function ChatWindow({
  selectedConversation,
  selectedConversationDisplayName,
  selectedGroupMemberCount,
  headerStatusText,
  headerStatusClass,
  headerAvatar,
  setShowGroupInfoModal,
  selectedConversationId,
  messages,
  user,
  getUserId,
  getMessageSenderAvatar,
  getMessageSenderName,
  formatTime,
  messagesEndRef,
  messagesContainerRef,
  onMessageScroll,
  isLoadingOlderMessages,
  hasMoreMessages,
  isInitialMessagesLoading,
  newMessage,
  setNewMessage,
  handleSendMessage,
  handleRecallMessage,
  handleRecallMessageGroup,
  handleDeleteMessage,
  handleDeleteMessageGroup
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [openMessageActionsId, setOpenMessageActionsId] = useState(null);

  const getMessageAttachmentUrl = (message) =>
    message?.imageUrl || message?.fileUrl || message?.file_url || "";

  const normalizeImageUrl = (rawUrl) => {
    if (!rawUrl) return "";

    try {
      const parsedUrl = new URL(rawUrl);
      parsedUrl.protocol = "https:";
      return parsedUrl.toString();
    } catch {
      return String(rawUrl).replace(/^http:\/\//i, "https://");
    }
  };

  const openImagePreview = (message) => {
    const imageUrl = normalizeImageUrl(getMessageAttachmentUrl(message));

    if (!imageUrl) return;

    setSelectedImage({
      src: imageUrl,
      alt: message?.text || "Image message"
    });
    setIsPreviewOpen(true);
  };

  const closeImagePreview = () => {
    setIsPreviewOpen(false);
    setSelectedImage(null);
  };

  const toggleMessageActions = (messageId) => {
    setOpenMessageActionsId((currentId) => (currentId === messageId ? null : messageId));
  };

  const closeMessageActions = () => setOpenMessageActionsId(null);

  const copyTextMessage = async (message) => {
    const text = message?.text || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy text message:", error);
    }
  };

  const copyImageMessage = (message) => {
    console.log("Copy image demo", normalizeImageUrl(getMessageAttachmentUrl(message)));
  };

  const getDownloadFileName = (message, attachmentUrl) => {
    const explicitName = (message?.text || "").trim();
    if (explicitName) return explicitName;

    try {
      const pathname = new URL(attachmentUrl).pathname;
      const rawName = pathname.split("/").pop();
      if (rawName) return decodeURIComponent(rawName);
    } catch {
      // Ignore URL parsing errors and fallback to default name.
    }

    return "image";
  };

  const downloadSingleAttachment = async (message) => {
    const attachmentUrl = normalizeImageUrl(getMessageAttachmentUrl(message));
    if (!attachmentUrl) return;

    const response = await fetch(attachmentUrl, {
      mode: "cors",
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = getDownloadFileName(message, attachmentUrl);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const downloadAttachmentMessage = async (message) => {
    const groupedItems = Array.isArray(message?.groupedItems)
      ? message.groupedItems.filter(Boolean)
      : [];

    const downloadTargets = groupedItems.length > 0 ? groupedItems : [message];

    try {
      for (const item of downloadTargets) {
        await downloadSingleAttachment(item);
      }
    } catch (error) {
      console.error("Failed to download attachment:", error);
      alert("Khong the tai tep. Vui long thu lai sau.");
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-left">
          <img src={headerAvatar} alt="selected user" className="chat-user-avatar" />
          <div>
            <div className="group-title-row">
              <h3>
                {selectedConversationDisplayName}
              </h3>

              {selectedConversation?.isGroup && (
                <button className="group-info-btn" onClick={() => setShowGroupInfoModal(true)}>
                  <FaInfoCircle />
                </button>
              )}
            </div>

            <span
              className={
                selectedConversation?.isGroup
                  ? "chat-member-count"
                  : `chat-user-status ${headerStatusClass || "offline"}`
              }
            >
              {!selectedConversation?.isGroup && (
                <span className="status-dot" aria-hidden="true" />
              )}
              {selectedConversation?.isGroup
                ? `${selectedGroupMemberCount} members`
                : headerStatusText || "Offline"}
            </span>
          </div>
        </div>

        <div className="chat-header-actions">
          <FaPhone className="header-action-icon" />
          <FaVideo className="header-action-icon" />
        </div>
      </div>

      <div className="chat-date">Today</div>

      <MessageList
        selectedConversationId={selectedConversationId}
        messages={messages}
        userId={user?.id}
        getUserId={getUserId}
        getMessageSenderAvatar={getMessageSenderAvatar}
        getMessageSenderName={getMessageSenderName}
        isGroupConversation={Boolean(selectedConversation?.isGroup)}
        formatTime={formatTime}
        messagesEndRef={messagesEndRef}
        messagesContainerRef={messagesContainerRef}
        onScroll={onMessageScroll}
        isLoadingOlderMessages={isLoadingOlderMessages}
        hasMoreMessages={hasMoreMessages}
        isInitialMessagesLoading={isInitialMessagesLoading}
        onOpenImagePreview={openImagePreview}
        openMessageActionsId={openMessageActionsId}
        onToggleMessageActions={toggleMessageActions}
        onCloseMessageActions={closeMessageActions}
        onCopyMessage={copyTextMessage}
        onCopyImage={copyImageMessage}
        onDownloadImage={downloadAttachmentMessage}
        onDownloadFile={downloadAttachmentMessage}
        onRecallMessage={handleRecallMessage}
        onRecallMessageGroup={handleRecallMessageGroup}
        onDeleteMessage={handleDeleteMessage}
        onDeleteMessageGroup={handleDeleteMessageGroup}
      />

      <ImagePreviewModal
        isOpen={isPreviewOpen}
        image={selectedImage}
        onClose={closeImagePreview}
      />

      <div className="typing-text">Typing status will be added later...</div>

      <MessageInput
        newMessage={newMessage}
        onChangeNewMessage={setNewMessage}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}

export default ChatWindow;
