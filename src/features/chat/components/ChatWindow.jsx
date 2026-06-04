import { useEffect, useRef, useState } from "react";
import {
  FaPhone,
  FaVideo,
  FaInfoCircle,
  FaSearch,
  FaTimes,
  FaSpinner,
  FaUserPlus,
  FaHashtag,
  FaChartBar
} from "react-icons/fa";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ImagePreviewModal from "./ImagePreviewModal";
import ActionDialog from "./ActionDialog";
import PollComposer from "./PollComposer";
import { searchMessages } from "@/features/chat/services/messageService";

function ChatWindow({
  selectedConversation,
  selectedConversationDisplayName,
  selectedGroupMemberCount,
  headerStatusText,
  headerStatusClass,
  headerAvatar,
  setShowGroupInfoModal,
  selectedConversationId,
  messages,
  user,
  getUserId,
  getMessageSenderAvatar,
  getMessageSenderName,
  formatTime,
  messagesEndRef,
  messagesContainerRef,
  onMessageScroll,
  isLoadingOlderMessages,
  hasMoreMessages,
  isInitialMessagesLoading,
  newMessage,
  setNewMessage,
  replyTarget,
  onReplyMessage,
  onClearReplyTarget,
  highlightedMessageId,
  onReplyPreviewDoubleClick,
  handleSendMessage,
  handleRecallMessage,
  handleRecallMessageGroup,
  handleDeleteMessage,
  handleDeleteMessageGroup,
  onStartAudioCall,
  onStartVideoCall,
  onOpenAddMembers,
  onOpenGenerateJoinCode,
  onCreatePoll,
  onVotePoll,
  votingPollId = "",
  isCreatingPoll = false,
  isCallActionDisabled = false
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [openMessageActionsId, setOpenMessageActionsId] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [dialogState, setDialogState] = useState(null);
  const [isGroupActionMenuOpen, setIsGroupActionMenuOpen] = useState(false);
  const [isPollComposerOpen, setIsPollComposerOpen] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchAbortRef = useRef(null);
  const groupActionMenuRef = useRef(null);

  const getMessageAttachmentUrl = (message) =>
    message?.imageUrl || message?.fileUrl || message?.file_url || "";

  const normalizeImageUrl = (rawUrl) => {
    if (!rawUrl) return "";

    try {
      const parsedUrl = new URL(rawUrl);
      parsedUrl.protocol = "https:";
      return parsedUrl.toString();
    } catch {
      return String(rawUrl).replace(/^http:\/\//i, "https://");
    }
  };

  const openImagePreview = (message) => {
    const imageUrl = normalizeImageUrl(getMessageAttachmentUrl(message));

    if (!imageUrl) return;

    setSelectedImage({
      src: imageUrl,
      alt: message?.text || "Image message"
    });
    setIsPreviewOpen(true);
  };

  const closeImagePreview = () => {
    setIsPreviewOpen(false);
    setSelectedImage(null);
  };

  const toggleMessageActions = (messageId) => {
    setOpenMessageActionsId((currentId) => (currentId === messageId ? null : messageId));
  };

  const closeMessageActions = () => setOpenMessageActionsId(null);

  const showAlertDialog = (message, options = {}) => {
    setDialogState({
      title: options.title || "Thông báo",
      message,
      tone: options.tone || "neutral",
      confirmLabel: options.confirmLabel || "Đã hiểu"
    });
  };

  const copyTextMessage = async (message) => {
    const text = message?.text || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy text message:", error);
    }
  };

  const copyImageMessage = (message) => {
    console.log("Copy image demo", normalizeImageUrl(getMessageAttachmentUrl(message)));
  };

  const getDownloadFileName = (message, attachmentUrl) => {
    const explicitName = (message?.text || "").trim();
    if (explicitName) return explicitName;

    try {
      const pathname = new URL(attachmentUrl).pathname;
      const rawName = pathname.split("/").pop();
      if (rawName) return decodeURIComponent(rawName);
    } catch {
      // Ignore URL parsing errors and fallback to default name.
    }

    return "image";
  };

  const downloadSingleAttachment = async (message) => {
    const attachmentUrl = normalizeImageUrl(getMessageAttachmentUrl(message));
    if (!attachmentUrl) return;

    const response = await fetch(attachmentUrl, {
      mode: "cors",
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = getDownloadFileName(message, attachmentUrl);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const downloadAttachmentMessage = async (message) => {
    const groupedItems = Array.isArray(message?.groupedItems)
      ? message.groupedItems.filter(Boolean)
      : [];

    const downloadTargets = groupedItems.length > 0 ? groupedItems : [message];

    try {
      for (const item of downloadTargets) {
        await downloadSingleAttachment(item);
      }
    } catch (error) {
      console.error("Failed to download attachment:", error);
      showAlertDialog("Khong the tai tep. Vui long thu lai sau.", {
        title: "Không thể tải tệp",
        tone: "danger"
      });
    }
  };

  useEffect(() => {
    // Reset search when conversation changes
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setSearchError(null);

    if (searchAbortRef.current) {
      try {
        searchAbortRef.current.abort();
      } catch {
        // ignore
      }
      searchAbortRef.current = null;
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (!isGroupActionMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!groupActionMenuRef.current?.contains(event.target)) {
        setIsGroupActionMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsGroupActionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGroupActionMenuOpen]);

  useEffect(() => {
    if (!selectedConversation?.isGroup) {
      setIsPollComposerOpen(false);
    }
  }, [selectedConversation?.isGroup]);

  const performSearch = (q) => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = window.setTimeout(async () => {
      const keyword = String(q || "").trim();
      if (!keyword) {
        setSearchResults([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        const results = await searchMessages(selectedConversationId, keyword);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error("Search messages failed:", err);
        setSearchError("Lỗi khi tìm kiếm tin nhắn");
        showAlertDialog("Lỗi khi tìm kiếm tin nhắn", {
          title: "Lỗi tìm kiếm",
          tone: "danger"
        });
      } finally {
        setIsSearching(false);
      }
    }, 420);
  };

  const handleSearchInputChange = (value) => {
    setSearchQuery(value);
    performSearch(value);
  };

  const handleResultClick = (message) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);

    if (message && message.id) {
      // reuse existing jump handler from parent
      if (typeof onReplyPreviewDoubleClick === "function") {
        onReplyPreviewDoubleClick({ id: message.id });
      }
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-left">
          <img src={headerAvatar} alt="selected user" className="chat-user-avatar" />
          <div>
            <div className="group-title-row">
              <h3>
                {selectedConversationDisplayName}
              </h3>

              {selectedConversation?.isGroup && (
                <button className="group-info-btn" onClick={() => setShowGroupInfoModal(true)}>
                  <FaInfoCircle />
                </button>
              )}
            </div>

            <span
              className={
                selectedConversation?.isGroup
                  ? "chat-member-count"
                  : `chat-user-status ${headerStatusClass || "offline"}`
              }
            >
              {!selectedConversation?.isGroup && (
                <span className="status-dot" aria-hidden="true" />
              )}
              {selectedConversation?.isGroup
                ? `${selectedGroupMemberCount} members`
                : headerStatusText || "Offline"}
            </span>
          </div>
        </div>

        <div className="chat-header-actions">
          <button
            type="button"
            className="header-action-btn"
            onClick={onStartAudioCall}
            disabled={isCallActionDisabled}
            title="Start audio call"
          >
            <FaPhone className="header-action-icon" />
          </button>
          <button
            type="button"
            className="header-action-btn"
            onClick={onStartVideoCall}
            disabled={isCallActionDisabled}
            title="Start video call"
          >
            <FaVideo className="header-action-icon" />
          </button>
          <button
            type="button"
            className="header-action-btn"
            onClick={() => setIsSearchOpen((v) => !v)}
            title="Search messages"
            aria-label="Search messages"
          >
            <FaSearch className="header-action-icon" />
          </button>
          {selectedConversation?.isGroup && (
            <button
              type="button"
              className="header-action-btn"
              onClick={() => setIsPollComposerOpen(true)}
              title="Create poll"
              aria-label="Create poll"
            >
              <FaChartBar className="header-action-icon" />
            </button>
          )}
          {selectedConversation?.isGroup && (
            <div className="header-action-menu-anchor" ref={groupActionMenuRef}>
              <button
                type="button"
                className={`header-action-btn ${isGroupActionMenuOpen ? "is-active" : ""}`}
                onClick={() => setIsGroupActionMenuOpen((current) => !current)}
                title="Group actions"
                aria-label="Group actions"
              >
                <FaUserPlus className="header-action-icon" />
              </button>

              {isGroupActionMenuOpen && (
                <div className="header-action-menu" role="menu" aria-label="Tác vụ nhóm">
                  <button
                    type="button"
                    className="header-action-menu-item"
                    onClick={() => {
                      setIsGroupActionMenuOpen(false);
                      onOpenAddMembers?.();
                    }}
                  >
                    <FaUserPlus />
                    <span>Thêm bạn vào nhóm</span>
                  </button>
                  <button
                    type="button"
                    className="header-action-menu-item"
                    onClick={() => {
                      setIsGroupActionMenuOpen(false);
                      onOpenGenerateJoinCode?.();
                    }}
                  >
                    <FaHashtag />
                    <span>Tạo mã tham gia</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isSearchOpen && (
        <div className="chat-search-panel">
          <div className="chat-search-bar">
            <input
              type="text"
              placeholder="Tìm kiếm tin nhắn..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="chat-search-input"
            />
            <button
              type="button"
              className="chat-search-close"
              onClick={() => { setIsSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
              aria-label="Close search"
            >
              <FaTimes />
            </button>
          </div>

          <div className="chat-search-results">
            {isSearching ? (
              <div className="search-loading">Searching... <FaSpinner className="spin" /></div>
            ) : searchError ? (
              <div className="search-error">{searchError}</div>
            ) : Array.isArray(searchResults) && searchResults.length === 0 && searchQuery.trim() !== "" ? (
              <div className="search-empty">Không tìm thấy tin nhắn phù hợp</div>
            ) : (
              searchResults.map((result) => (
                <button
                  key={result.id || result.message_id || result._id}
                  type="button"
                  className="search-result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="search-result-left">
                    <img src={getMessageSenderAvatar(result)} alt="sender" className="search-result-avatar" />
                  </div>
                  <div className="search-result-body">
                    <div className="search-result-top">
                      <strong>{getMessageSenderName?.(result) || "Unknown"}</strong>
                      <span className="search-result-time">{formatTime(result.createdAt)}</span>
                    </div>
                    <div className="search-result-preview">{String(result.text || "").slice(0, 160)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="chat-date">Today</div>

      <MessageList
        selectedConversationId={selectedConversationId}
        messages={messages}
        userId={user?.id}
        getUserId={getUserId}
        getMessageSenderAvatar={getMessageSenderAvatar}
        getMessageSenderName={getMessageSenderName}
        isGroupConversation={Boolean(selectedConversation?.isGroup)}
        formatTime={formatTime}
        messagesEndRef={messagesEndRef}
        messagesContainerRef={messagesContainerRef}
        onScroll={onMessageScroll}
        isLoadingOlderMessages={isLoadingOlderMessages}
        hasMoreMessages={hasMoreMessages}
        isInitialMessagesLoading={isInitialMessagesLoading}
        onOpenImagePreview={openImagePreview}
        openMessageActionsId={openMessageActionsId}
        onToggleMessageActions={toggleMessageActions}
        onCloseMessageActions={closeMessageActions}
        onCopyMessage={copyTextMessage}
        onCopyImage={copyImageMessage}
        onDownloadImage={downloadAttachmentMessage}
        onDownloadFile={downloadAttachmentMessage}
        onVotePoll={onVotePoll}
        votingPollId={votingPollId}
        onRecallMessage={handleRecallMessage}
        onRecallMessageGroup={handleRecallMessageGroup}
        onDeleteMessage={handleDeleteMessage}
        onDeleteMessageGroup={handleDeleteMessageGroup}
        onReplyMessage={onReplyMessage}
        highlightedMessageId={highlightedMessageId}
        onReplyPreviewDoubleClick={onReplyPreviewDoubleClick}
      />

      <ImagePreviewModal
        isOpen={isPreviewOpen}
        image={selectedImage}
        onClose={closeImagePreview}
      />

      <PollComposer
        isOpen={isPollComposerOpen}
        isSubmitting={isCreatingPoll}
        onClose={() => {
          if (isCreatingPoll) return;
          setIsPollComposerOpen(false);
        }}
        onSubmit={async (payload) => {
          const didCreate = await onCreatePoll?.(payload);
          if (didCreate !== false) {
            setIsPollComposerOpen(false);
          }
        }}
      />

      <div className="typing-text">Typing status will be added later...</div>

      <MessageInput
        newMessage={newMessage}
        onChangeNewMessage={setNewMessage}
        replyTarget={replyTarget}
        onClearReplyTarget={onClearReplyTarget}
        onSendMessage={handleSendMessage}
      />

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
    </div>
  );
}

export default ChatWindow;
