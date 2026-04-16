import { useRef, useState } from "react";
import { FaImage, FaMicrophone, FaPaperclip, FaPaperPlane, FaSmile } from "react-icons/fa";
import EmojiPicker from "./EmojiPicker";

function MessageInput({ newMessage, onChangeNewMessage, onSendMessage, onSendImage, onSendFile }) {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleImageChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      onSendImage?.(selectedFiles);
    }

    event.target.value = "";
  };

  const handleAttachmentChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      onSendFile?.(selectedFiles);
    }

    event.target.value = "";
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
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="chat-file-input"
          onChange={handleImageChange}
        />
        <button
          type="button"
          className="chat-file-btn"
          onClick={() => imageInputRef.current?.click()}
          aria-label="Attach image"
        >
          <FaImage className="input-action-icon" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="chat-file-input"
          onChange={handleAttachmentChange}
        />
        <button
          type="button"
          className="chat-file-btn"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
        >
          <FaPaperclip className="input-action-icon" />
        </button>
        <FaMicrophone className="input-action-icon" />
        <button type="button" className="send-btn" onClick={handleSend}>
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
