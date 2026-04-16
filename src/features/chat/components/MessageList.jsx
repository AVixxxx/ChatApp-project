import { FaHeart } from "react-icons/fa";

function MessageList({
  selectedConversationId,
  messages,
  userId,
  getUserId,
  getMessageSenderAvatar,
  formatTime,
  messagesEndRef
}) {
  return (
    <div className="messages">
      {!selectedConversationId ? (
        <p className="empty-text">Please select a conversation.</p>
      ) : messages.length === 0 ? (
        <p className="empty-text">No messages yet.</p>
      ) : (
        messages.map((message) => {
          const senderId = getUserId(message.sender) || message.sender_id;
          const isMe = senderId === userId;

          return (
            <div key={message.id} className={`message-row ${isMe ? "me-row" : "other-row"}`}>
              {!isMe && (
                <img
                  src={getMessageSenderAvatar(message)}
                  alt="sender"
                  className="message-avatar"
                />
              )}

              <div className={`message-block ${isMe ? "me-block" : ""}`}>
                <div className={`message ${isMe ? "me" : "other"}`}>
                  <p>{message.text}</p>
                </div>

                <div className={`message-meta ${isMe ? "me-meta" : ""}`}>
                  {!isMe && <FaHeart className="quick-react" />}
                  <span>{formatTime(message.createdAt || message.created_at)}</span>
                  {isMe && <FaHeart className="quick-react" />}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef}></div>
    </div>
  );
}

export default MessageList;
