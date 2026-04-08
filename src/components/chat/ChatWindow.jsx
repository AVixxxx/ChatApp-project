import { FaPhone, FaVideo, FaInfoCircle } from "react-icons/fa";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

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
  formatTime,
  messagesEndRef,
  newMessage,
  setNewMessage,
  handleSendMessage
}) {
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
        formatTime={formatTime}
        messagesEndRef={messagesEndRef}
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
