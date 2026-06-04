import { useEffect, useRef, useState } from "react";
import { FaSearch, FaUserPlus, FaUsers, FaThumbtack, FaSpinner, FaPlus, FaHashtag } from "react-icons/fa";

function ConversationList({
  searchTerm,
  onSearchTermChange,
  onOpenAddFriend,
  onOpenCreateGroup,
  onOpenJoinByCode,
  conversations,
  filteredConversations,
  selectedConversationId,
  onSelectConversation,
  getConversationAvatar,
  getConversationDisplayName,
  getConversationStatusText,
  getUnreadCount,
  formatConversationTime,
  getConversationPreview,
  onAvatarClick,
  onTogglePinConversation,
  pinActionLoadingByConversationId
}) {
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  useEffect(() => {
    if (!isCreateMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!createMenuRef.current?.contains(event.target)) {
        setIsCreateMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCreateMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateMenuOpen]);

  const handleOpenCreateGroup = () => {
    setIsCreateMenuOpen(false);
    onOpenCreateGroup?.();
  };

  const handleOpenJoinByCode = () => {
    setIsCreateMenuOpen(false);
    onOpenJoinByCode?.();
  };

  return (
    <div className="conversation-list">
      <div className="conversation-search-toolbar">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search chats..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="search-action-btn"
          title="Add Friend"
          onClick={onOpenAddFriend}
        >
          <FaUserPlus />
        </button>
        <div className="toolbar-menu-anchor" ref={createMenuRef}>
          <button
            type="button"
            className={`search-action-btn ${isCreateMenuOpen ? "is-active" : ""}`}
            title="Create Group"
            onClick={() => setIsCreateMenuOpen((current) => !current)}
          >
            <FaUsers />
          </button>

          {isCreateMenuOpen && (
            <div className="toolbar-popover-menu" role="menu" aria-label="Tạo hoặc tham gia nhóm">
              <button type="button" className="toolbar-popover-item" onClick={handleOpenCreateGroup}>
                <FaPlus />
                <span>Tạo nhóm mới</span>
              </button>
              <button type="button" className="toolbar-popover-item" onClick={handleOpenJoinByCode}>
                <FaHashtag />
                <span>Tham gia bằng mã</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {conversations.length === 0 ? (
        <p className="empty-text">No conversations yet.</p>
      ) : filteredConversations.length === 0 ? (
        <p className="empty-text">No matching conversations.</p>
      ) : (
        filteredConversations.map((conversation) => {
          const unreadCount = Number(getUnreadCount?.(conversation) || 0);
          const isPinned = Boolean(conversation?.isPinned ?? conversation?.is_pinned ?? false);
          const pinLoading = Boolean(pinActionLoadingByConversationId?.[conversation?.id]);

          return (
            <div
              key={conversation.id}
              className={`conversation ${
                selectedConversationId === conversation.id ? "selected" : ""
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
            <button
              type="button"
              className="conversation-avatar-btn"
              onClick={(event) => {
                event.stopPropagation();
                onAvatarClick?.(conversation);
              }}
              aria-label={`View profile of ${getConversationDisplayName(conversation)}`}
            >
              <img src={getConversationAvatar(conversation)} alt="conversation" />
            </button>
            <div className="conversation-content">
              <div className="conversation-top">
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <h4>{getConversationDisplayName(conversation)}</h4>
                  <button
                    type="button"
                    className={`conversation-pin-btn ${isPinned ? "pinned" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePinConversation?.(conversation);
                    }}
                    title={isPinned ? "Unpin conversation" : "Pin conversation"}
                    aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
                  >
                    {pinLoading ? <FaSpinner className="spin" /> : <FaThumbtack />}
                  </button>
                </div>
                <div className="conversation-meta">
                  <span className="conversation-time">
                    {formatConversationTime(conversation.lastMessageTime)}
                  </span>
                  {unreadCount > 0 && (
                    <span className="unread-badge" aria-label={`${unreadCount} unread messages`}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="conversation-bottom">
                <p>{getConversationPreview(conversation)}</p>
                {!conversation.isGroup && (
                  <span
                    className={`conversation-status ${
                      getConversationStatusText(conversation) === "Online"
                        ? "online"
                        : "offline"
                    }`}
                  >
                    <span className="status-dot" aria-hidden="true" />
                    {getConversationStatusText(conversation)}
                  </span>
                )}
              </div>
            </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default ConversationList;
