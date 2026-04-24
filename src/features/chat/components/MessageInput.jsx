import { useEffect, useRef, useState } from "react";
import {
  FaFileAlt,
  FaFilePdf,
  FaFileWord,
  FaImage,
  FaMicrophone,
  FaPaperclip,
  FaPaperPlane,
  FaSmile
} from "react-icons/fa";
import EmojiPicker from "./EmojiPicker";

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

function MessageInput({ newMessage, onChangeNewMessage, onSendMessage }) {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState([]);
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      draftAttachments.forEach((attachment) => {
        if (attachment?.previewUrl) {
          window.URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, [draftAttachments]);

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

  const createDraftAttachment = (file, kind) => {
    const previewUrl = window.URL.createObjectURL(file);
    return {
      id: `${kind}-${file.name}-${file.size}-${file.lastModified}`,
      file,
      kind,
      name: file.name,
      previewUrl
    };
  };

  const removeDraftAttachment = (attachmentId) => {
    setDraftAttachments((currentAttachments) => {
      const nextAttachments = currentAttachments.filter((attachment) => {
        if (attachment.id !== attachmentId) return true;
        if (attachment.previewUrl) {
          window.URL.revokeObjectURL(attachment.previewUrl);
        }
        return false;
      });

      return nextAttachments;
    });
  };

  const clearDraftAttachments = () => {
    setDraftAttachments((currentAttachments) => {
      currentAttachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          window.URL.revokeObjectURL(attachment.previewUrl);
        }
      });

      return [];
    });
  };

  const handleSend = async () => {
    setIsEmojiPickerOpen(false);

    const payload = {
      text: newMessage,
      attachments: draftAttachments.map((attachment) => ({
        kind: attachment.kind,
        file: attachment.file
      }))
    };

    try {
      await onSendMessage(payload);
      onChangeNewMessage("");
      clearDraftAttachments();
    } finally {
      inputRef.current?.focus();
    }
  };

  const handleImageChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      setDraftAttachments((currentAttachments) => [
        ...currentAttachments,
        ...selectedFiles.map((file) => createDraftAttachment(file, "image"))
      ]);
    }

    event.target.value = "";
  };

  const handleAttachmentChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      setDraftAttachments((currentAttachments) => [
        ...currentAttachments,
        ...selectedFiles.map((file) => createDraftAttachment(file, "file"))
      ]);
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

      {draftAttachments.length > 0 && (
        <div className="chat-input-preview-row" aria-label="File previews">
          {draftAttachments.map((attachment) => {
            const FileIcon = getFileIconByName(attachment.name);

            return (
              <div key={attachment.id} className="chat-input-preview-item">
                {attachment.kind === "image" ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="chat-input-preview-image"
                  />
                ) : (
                  <div className="chat-input-preview-file">
                    <FileIcon className="chat-input-preview-file-icon" />
                    <span>{attachment.name}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="chat-input-preview-remove"
                  onClick={() => removeDraftAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.name}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
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
