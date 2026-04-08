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
  formatConversationTime,
  getConversationPreview
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
        filteredConversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`conversation ${
              selectedConversationId === conversation.id ? "selected" : ""
            }`}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <img src={getConversationAvatar(conversation)} alt="conversation" />
            <div className="conversation-content">
              <div className="conversation-top">
                <h4>{getConversationDisplayName(conversation)}</h4>
                <span className="conversation-time">
                  {formatConversationTime(conversation.lastMessageTime)}
                </span>
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
        ))
      )}
    </div>
  );
}

export default ConversationList;
