import { FaSearch, FaUserPlus, FaUsers } from "react-icons/fa";

function ConversationList({
  searchTerm,
  onSearchTermChange,
  onOpenAddFriend,
  onOpenCreateGroup,
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
  onAvatarClick
}) {
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
        <button
          type="button"
          className="search-action-btn"
          title="Create Group"
          onClick={onOpenCreateGroup}
        >
          <FaUsers />
        </button>
      </div>

      {conversations.length === 0 ? (
        <p className="empty-text">No conversations yet.</p>
      ) : filteredConversations.length === 0 ? (
        <p className="empty-text">No matching conversations.</p>
      ) : (
        filteredConversations.map((conversation) => {
          const unreadCount = Number(getUnreadCount?.(conversation) || 0);

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
                <h4>{getConversationDisplayName(conversation)}</h4>
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
