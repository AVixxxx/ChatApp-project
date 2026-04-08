import { FaSmile, FaPaperclip, FaMicrophone, FaPaperPlane } from "react-icons/fa";

function MessageInput({ newMessage, onChangeNewMessage, onSendMessage }) {
  return (
    <div className="chat-input">
      <div className="chat-input-left">
        <FaSmile className="input-icon" />
        <input
          placeholder="Chat Anyway..."
          value={newMessage}
          onChange={(e) => onChangeNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSendMessage();
            }
          }}
        />
      </div>

      <div className="chat-input-actions">
        <FaPaperclip className="input-action-icon" />
        <FaMicrophone className="input-action-icon" />
        <button className="send-btn" onClick={onSendMessage}>
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
