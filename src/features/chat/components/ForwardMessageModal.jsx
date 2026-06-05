import { useMemo, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";

function ForwardMessageModal({
  isOpen,
  conversations,
  selectedConversationIds,
  onToggleConversation,
  onClose,
  onConfirm,
  getConversationAvatar,
  getConversationDisplayName,
  isSubmitting = false,
  errorMessage = ""
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = useMemo(() => {
    const normalizedSearch = String(searchTerm || "").trim().toLowerCase();
    if (!normalizedSearch) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      getConversationDisplayName(conversation).toLowerCase().includes(normalizedSearch)
    );
  }, [conversations, getConversationDisplayName, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="forward-modal-overlay">
      <div className="forward-modal">
        <div className="forward-modal-header">
          <h3>Chuyển tiếp tin nhắn</h3>
          <button
            type="button"
            className="forward-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <FaTimes />
          </button>
        </div>

        <div className="forward-modal-body">
          <div className="forward-search-box">
            <FaSearch className="forward-search-icon" />
            <input
              type="text"
              className="forward-search-input"
              placeholder="Tìm cuộc trò chuyện..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          {errorMessage ? <p className="group-error-text">{errorMessage}</p> : null}

          <p className="group-selection-count">Đã chọn: {selectedConversationIds.length}</p>

          <div className="forward-conversation-list">
            {filteredConversations.length === 0 ? (
              <p className="empty-text">Không có cuộc trò chuyện phù hợp.</p>
            ) : (
              filteredConversations.map((conversation) => {
                const conversationId = String(conversation.id || "");
                const isSelected = selectedConversationIds.includes(conversationId);

                return (
                  <label key={conversationId} className="forward-conversation-item">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleConversation(conversationId)}
                    />
                    <img
                      src={getConversationAvatar(conversation)}
                      alt={getConversationDisplayName(conversation)}
                      className="forward-conversation-avatar"
                    />
                    <div className="forward-conversation-text">
                      <span className="forward-conversation-name">
                        {getConversationDisplayName(conversation)}
                      </span>
                      <span className="forward-conversation-type">
                        {conversation.isGroup ? "Nhóm" : "Trò chuyện riêng"}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="forward-modal-footer">
          <button
            type="button"
            className="group-cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="group-create-btn"
            onClick={onConfirm}
            disabled={isSubmitting || selectedConversationIds.length === 0}
          >
            {isSubmitting ? "Đang chuyển tiếp..." : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForwardMessageModal;
