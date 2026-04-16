import { useRef, useState } from "react";
import { FaPaperclip, FaMicrophone, FaPaperPlane, FaSmile } from "react-icons/fa";
import EmojiPicker from "./EmojiPicker";

function MessageInput({ newMessage, onChangeNewMessage, onSendMessage }) {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const inputRef = useRef(null);

  const handleEmojiButtonClick = () => {
    if (isEmojiPickerOpen) {
      setIsEmojiPickerOpen(false);
      return;
    }

    setIsEmojiPickerOpen(true);
  };

  const handleSelectEmoji = (emoji) => {
    const inputElement = inputRef.current;

    if (!emoji) {
      return;
    }

    if (!inputElement) {
      onChangeNewMessage(`${newMessage}${emoji}`);
      setIsEmojiPickerOpen(false);
      return;
    }

    const selectionStart = inputElement.selectionStart ?? newMessage.length;
    const selectionEnd = inputElement.selectionEnd ?? newMessage.length;
    const nextMessage = `${newMessage.slice(0, selectionStart)}${emoji}${newMessage.slice(selectionEnd)}`;

    onChangeNewMessage(nextMessage);
    setIsEmojiPickerOpen(false);

    window.requestAnimationFrame(() => {
      const nextCursorPosition = selectionStart + emoji.length;
      inputElement.focus();
      inputElement.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleSend = () => {
    setIsEmojiPickerOpen(false);
    onSendMessage();
    inputRef.current?.focus();
  };

  return (
    <div className="chat-input">
      {isEmojiPickerOpen && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setIsEmojiPickerOpen(false)}
        />
      )}

      <div className="chat-input-left">
        <button
          type="button"
          className="emoji-toggle-btn"
          onClick={handleEmojiButtonClick}
          aria-label="Open emoji picker"
        >
          <FaSmile className="input-icon" />
        </button>
        <input
          ref={inputRef}
          placeholder="Chat Anyway..."
          value={newMessage}
          onChange={(e) => onChangeNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
        />
      </div>

      <div className="chat-input-actions">
        <FaPaperclip className="input-action-icon" />
        <FaMicrophone className="input-action-icon" />
        <button type="button" className="send-btn" onClick={handleSend}>
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
