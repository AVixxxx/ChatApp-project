import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaFileAlt,
  FaFilePdf,
  FaFileWord,
  FaImage,
  FaPaperclip,
  FaPaperPlane,
  FaSpinner,
  FaSmile
} from "react-icons/fa";
import EmojiPicker from "./EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";
import ActionDialog from "./ActionDialog";

const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_VOICE_MIME_TYPES = new Set(["audio/m4a", "audio/mpeg"]);

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

const splitAcceptedAttachments = (files) => {
  const acceptedFiles = [];
  const rejectedFiles = [];

  (Array.isArray(files) ? files : []).forEach((file) => {
    if ((file?.size || 0) > MAX_ATTACHMENT_SIZE_BYTES) {
      rejectedFiles.push(file);
      return;
    }

    acceptedFiles.push(file);
  });

  return { acceptedFiles, rejectedFiles };
};

function MessageInput({
  newMessage,
  onChangeNewMessage,
  onSendMessage,
  replyTarget,
  onClearReplyTarget
}) {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendFeedback, setSendFeedback] = useState(null);
  const [voiceRecorderResetKey, setVoiceRecorderResetKey] = useState(0);
  const [dialogState, setDialogState] = useState(null);
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const draftAttachmentsRef = useRef([]);

  useEffect(() => {
    draftAttachmentsRef.current = draftAttachments;
  }, [draftAttachments]);

  useEffect(
    () => () => {
      draftAttachmentsRef.current.forEach((attachment) => {
        if (attachment?.previewUrl) {
          window.URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    },
    []
  );

  useEffect(() => {
    if (!replyTarget) return;

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();

      const inputElement = inputRef.current;
      if (inputElement && typeof inputElement.setSelectionRange === "function") {
        const cursorPosition = String(inputElement.value || "").length;
        inputElement.setSelectionRange(cursorPosition, cursorPosition);
      }
    });
  }, [replyTarget]);

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

  const addVoiceAttachment = useCallback((voiceAttachment) => {
    if (voiceAttachment?.remove) {
      setDraftAttachments((currentAttachments) => {
        const nextAttachments = currentAttachments.filter(
          (attachment) => attachment.id !== voiceAttachment.id
        );

        if (currentAttachments.length !== nextAttachments.length) {
          currentAttachments.forEach((attachment) => {
            if (attachment.id === voiceAttachment.id && attachment.previewUrl) {
              window.URL.revokeObjectURL(attachment.previewUrl);
            }
          });
        }

        return nextAttachments;
      });

      return;
    }

    if (!voiceAttachment?.file || !voiceAttachment?.previewUrl) {
      return;
    }

    const voiceMimeType = String(voiceAttachment.file.type || "").toLowerCase();
    if (!SUPPORTED_VOICE_MIME_TYPES.has(voiceMimeType)) {
      setSendFeedback({
        type: "error",
        message:
          "Định dạng ghi âm không tương thích. Hãy thử lại bằng trình duyệt hỗ trợ audio m4a hoặc mp3."
      });
      return;
    }

    setSendFeedback(null);

    setDraftAttachments((currentAttachments) => [
      ...currentAttachments.filter((attachment) => attachment.id !== voiceAttachment.id),
      {
        id: voiceAttachment.id || `voice-${voiceAttachment.file.name}-${voiceAttachment.file.lastModified}`,
        file: voiceAttachment.file,
        kind: "voice",
        name: voiceAttachment.name || voiceAttachment.file.name,
        previewUrl: voiceAttachment.previewUrl,
        durationSec: voiceAttachment.durationSec || 0
      }
    ]);
  }, []);

  const getFriendlySendError = (error) => {
    const status = error?.response?.status;

    if (status === 500) {
      return "Máy chủ đang gặp lỗi khi xử lý voice message. Vui lòng thử lại.";
    }

    if (status === 413) {
      return "File ghi âm quá lớn. Hãy thử bản ghi ngắn hơn.";
    }

    if (status === 415) {
      return "Định dạng file ghi âm không được hỗ trợ.";
    }

    return (
      error?.response?.data?.error ||
      error?.message ||
      "Không thể gửi tin nhắn lúc này. Vui lòng thử lại."
    );
  };

  const handleUploadProgress = (progressEvent) => {
    if (!progressEvent?.total) return;

    const nextProgress = Math.min(
      100,
      Math.max(0, Math.round((progressEvent.loaded / progressEvent.total) * 100))
    );
    setSendProgress(nextProgress);
  };

  const showAlertDialog = (message, options = {}) => {
    setDialogState({
      title: options.title || "Thông báo",
      message,
      tone: options.tone || "neutral",
      confirmLabel: options.confirmLabel || "Đã hiểu"
    });
  };

  const removeDraftAttachment = useCallback((attachmentId) => {
    setDraftAttachments((currentAttachments) => {
      const nextAttachments = currentAttachments.filter((attachment) => {
        if (attachment.id !== attachmentId) return true;
        if (attachment.previewUrl) {
          window.URL.revokeObjectURL(attachment.previewUrl);
        }
        return false;
      });

        const removedAttachment = currentAttachments.find((attachment) => attachment.id === attachmentId);
        if (removedAttachment?.kind === "voice") {
          setVoiceRecorderResetKey((currentKey) => currentKey + 1);
        }

      return nextAttachments;
    });
  }, []);

  const clearDraftAttachments = useCallback(() => {
    setDraftAttachments((currentAttachments) => {
      currentAttachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          window.URL.revokeObjectURL(attachment.previewUrl);
        }
      });

      setVoiceRecorderResetKey((currentKey) => currentKey + 1);

      return [];
    });
  }, []);

  const handleSend = async () => {
    if (isSending) {
      return;
    }

    setIsEmojiPickerOpen(false);
    setSendFeedback(null);
    setIsSending(true);
    setSendProgress(0);

    const payload = {
      text: newMessage,
      attachments: draftAttachments.map((attachment) => ({
        kind: attachment.kind,
        file: attachment.file
      })),
      onUploadProgress: handleUploadProgress
    };

    try {
      await onSendMessage(payload);
      onChangeNewMessage("");
      clearDraftAttachments();
      setSendFeedback(null);
    } catch (error) {
      setSendFeedback({
        type: "error",
        message: getFriendlySendError(error)
      });
    } finally {
      setIsSending(false);
      setSendProgress(0);
      inputRef.current?.focus();
    }
  };

  const handleImageChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const { acceptedFiles, rejectedFiles } = splitAcceptedAttachments(selectedFiles);

    if (rejectedFiles.length > 0) {
      showAlertDialog("Chỉ có thể tải lên file hoặc ảnh nhỏ hơn 20MB.", {
        title: "Kích thước file không hợp lệ",
        tone: "warning"
      });
    }

    if (acceptedFiles.length > 0) {
      setDraftAttachments((currentAttachments) => [
        ...currentAttachments,
        ...acceptedFiles.map((file) => createDraftAttachment(file, "image"))
      ]);
    }

    event.target.value = "";
  };

  const handleAttachmentChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const { acceptedFiles, rejectedFiles } = splitAcceptedAttachments(selectedFiles);

    if (rejectedFiles.length > 0) {
      showAlertDialog("Chỉ có thể tải lên file hoặc ảnh nhỏ hơn 20MB.", {
        title: "Kích thước file không hợp lệ",
        tone: "warning"
      });
    }

    if (acceptedFiles.length > 0) {
      setDraftAttachments((currentAttachments) => [
        ...currentAttachments,
        ...acceptedFiles.map((file) => createDraftAttachment(file, "file"))
      ]);
    }

    event.target.value = "";
  };

  return (
    <div className="chat-input">
      {sendFeedback && (
        <div
          className={`chat-input-toast ${sendFeedback.type === "error" ? "is-error" : "is-success"}`}
          role="status"
          aria-live="polite"
        >
          <span className="chat-input-toast-text">{sendFeedback.message}</span>
          {sendFeedback.type === "error" && (
            <button type="button" className="chat-input-toast-action" onClick={handleSend} disabled={isSending}>
              Thử lại
            </button>
          )}
          <button type="button" className="chat-input-toast-close" onClick={() => setSendFeedback(null)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      {replyTarget && (
        <div className="chat-input-reply">
          <span className="chat-input-reply-indicator" aria-hidden="true" />
          <div className="chat-input-reply-content">
            <span className="chat-input-reply-label">Trả lời</span>
            <span className="chat-input-reply-sender">
              {replyTarget.senderName || "Unknown"}
            </span>
            <span className="chat-input-reply-text">{replyTarget.content || "Tin nhắn"}</span>
            {replyTarget.attachment?.name && (
              <span className="chat-input-reply-attachment">
                {replyTarget.attachment.name}
              </span>
            )}
          </div>
          <button
            type="button"
            className="chat-input-reply-close"
            onClick={() => onClearReplyTarget?.()}
            aria-label="Clear reply target"
          >
            ×
          </button>
        </div>
      )}

      {isEmojiPickerOpen && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setIsEmojiPickerOpen(false)}
        />
      )}

      <ActionDialog
        isOpen={Boolean(dialogState)}
        title={dialogState?.title}
        message={dialogState?.message}
        tone={dialogState?.tone || "neutral"}
        confirmLabel={dialogState?.confirmLabel || "Đã hiểu"}
        showCancel={false}
        onConfirm={() => setDialogState(null)}
        onCancel={() => setDialogState(null)}
      />

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
                ) : attachment.kind === "voice" ? (
                  <div className="chat-input-preview-voice">
                    <audio controls preload="metadata" src={attachment.previewUrl} />
                    <span>
                      {attachment.durationSec
                        ? `${Math.floor(attachment.durationSec / 60)
                            .toString()
                            .padStart(2, "0")}:${Math.floor(attachment.durationSec % 60)
                            .toString()
                            .padStart(2, "0")}`
                        : "00:00"}
                    </span>
                  </div>
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

      <div className="chat-input-body">
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
            disabled={isSending}
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
            disabled={isSending}
          >
            <FaPaperclip className="input-action-icon" />
          </button>
          <VoiceRecorder
            key={voiceRecorderResetKey}
            onCreateVoiceAttachment={addVoiceAttachment}
            disabled={isSending}
          />
          <button
            type="button"
            className="send-btn"
            onClick={handleSend}
            disabled={isSending || (!newMessage.trim() && draftAttachments.length === 0)}
            aria-busy={isSending}
            title={isSending ? "Đang gửi..." : "Gửi tin nhắn"}
          >
            {isSending ? <FaSpinner className="send-btn-spinner" /> : <FaPaperPlane />}
          </button>
        </div>
      </div>

    </div>
  );
}

export default MessageInput;
