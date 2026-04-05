import { useEffect, useRef, useState } from "react";
import "./HomePage.css";
import socket from "../socket";
import {
  getConversations,
  createGroupConversation
} from "../services/conversationService";
import {
  getMessagesByConversation,
  sendMessage
} from "../services/messageService";
import { getMe, getFriends } from "../services/userService";
import {
  FaComments,
  FaPhoneAlt,
  FaAddressBook,
  FaSearch,
  FaHeart,
  FaSmile,
  FaPaperclip,
  FaMicrophone,
  FaPaperPlane,
  FaPhone,
  FaVideo,
  FaCloudUploadAlt,
  FaBriefcase,
  FaCog,
  FaImage,
  FaLink,
  FaFileAlt,
  FaUserFriends,
  FaCamera,
  FaTrashAlt,
  FaUserPlus,
  FaChevronDown,
  FaTimes,
  FaInfoCircle
} from "react-icons/fa";
import { MdCheckBox, MdCheckBoxOutlineBlank } from "react-icons/md";

const getEntityId = (entity) => {
  if (!entity || typeof entity !== "object") return null;
  return entity.id || entity.conversation_id || entity.message_id || entity._id;
};

const getUserId = (userEntity) => {
  if (!userEntity) return null;
  if (typeof userEntity === "string") return userEntity;
  return userEntity.id || userEntity.user_id || userEntity._id;
};

function HomePage() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const messagesEndRef = useRef(null);

  const formatTime = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatConversationTime = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric"
    });
  };

  const getConversationPreview = (conversation) => {
    if (!conversation?.lastMessage) {
      return conversation?.isGroup ? "Group created" : "Start chatting...";
    }

    if (conversation.lastMessage.messageType === "image") {
      return "Image";
    }

    if (conversation.lastMessage.messageType === "file") {
      return "File";
    }

    return conversation.lastMessage.text || "New message";
  };

  const getConversationDisplayName = (conversation) => {
    if (!conversation) return "Unknown";

    if (conversation.isGroup) {
      return conversation.groupName || "Unnamed Group";
    }

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    return otherMember?.name || "Unknown User";
  };

  const updateConversationWithNewMessage = (message) => {
    const targetConversationId = message.conversationId || message.conversation_id;
    if (!targetConversationId) return;

    setConversations((prev) => {
      const updated = prev.map((conversation) =>
        conversation.id === targetConversationId
          ? {
              ...conversation,
              lastMessage: message,
              lastMessageTime: message.createdAt || message.created_at,
              updatedAt: message.createdAt || message.created_at
            }
          : conversation
      );

      updated.sort(
        (a, b) =>
          new Date(b.updatedAt || b.lastMessageTime || 0) -
          new Date(a.updatedAt || a.lastMessageTime || 0)
      );

      return [...updated];
    });
  };

  const openGroupModal = async () => {
    try {
      const friends = await getFriends();
      setAllUsers(friends);
      setIsGroupModalOpen(true);
    } catch (error) {
      console.error("Failed to load friends:", error);
    }
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setSelectedGroupMembers([]);
    setGroupName("");
  };

  const toggleGroupMember = (userId) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name.");
      return;
    }

    if (selectedGroupMembers.length < 2) {
      alert("Please select at least 2 friends to create a group.");
      return;
    }

    try {
      setIsCreatingGroup(true);

      const newGroup = await createGroupConversation({
        groupName: groupName.trim(),
        members: selectedGroupMembers
      });

      setConversations((prev) => [newGroup, ...prev]);
      setSelectedConversationId(newGroup.id);
      setMessages([]);
      closeGroupModal();
    } catch (error) {
      console.error("Failed to create group:", error);
      alert(
        error?.response?.data?.message || "Failed to create group conversation."
      );
    } finally {
      setIsCreatingGroup(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user?.id) return;
    socket.emit("join_user", user.id);
  }, [user?.id]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const me = await getMe();
        setUser(me);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const handleNewConversation = (conversation) => {
      const normalizedId = getEntityId(conversation);
      if (!normalizedId) return;

      const normalizedConversation = {
        ...conversation,
        id: normalizedId
      };

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === normalizedId);
        if (exists) return prev;
        return [normalizedConversation, ...prev];
      });
    };

    socket.on("new_conversation", handleNewConversation);

    return () => {
      socket.off("new_conversation", handleNewConversation);
    };
  }, []);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await getConversations();
        setConversations(data);

        if (data.length > 0) {
          setSelectedConversationId(data[0].id);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;
    socket.emit("join_conversation", selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }

      try {
        const data = await getMessagesByConversation(selectedConversationId);
        setMessages(data);
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    fetchMessages();
  }, [selectedConversationId]);

  useEffect(() => {
    const handleReceiveMessage = (message) => {
      const normalizedMessage = {
        ...message,
        id: getEntityId(message),
        conversationId:
          message.conversationId || message.conversation_id || message.conversation
      };

      updateConversationWithNewMessage(normalizedMessage);

      if (normalizedMessage.conversationId === selectedConversationId) {
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === normalizedMessage.id);
          if (exists) return prev;
          return [...prev, normalizedMessage];
        });
      }
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    setShowGroupInfoModal(false);
  }, [selectedConversationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversationId) return;

    try {
      const sentMessage = await sendMessage({
        conversationId: selectedConversationId,
        text: newMessage
      });

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === sentMessage.id);
        if (exists) return prev;
        return [...prev, sentMessage];
      });

      updateConversationWithNewMessage(sentMessage);
      socket.emit("send_message", sentMessage);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId
  );

  const selectedOtherMember =
    selectedConversation?.members?.find(
      (member) => getUserId(member) && getUserId(member) !== user?.id
    ) || selectedConversation?.members?.[0];

  const selectedGroupMembersList = selectedConversation?.isGroup
    ? selectedConversation.members || []
    : [];

  const selectedGroupMemberCount = selectedGroupMembersList.length;

  const filteredConversations = conversations.filter((conversation) =>
    getConversationDisplayName(conversation)
      .toLowerCase()
      .includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="user-info">
          <img
            src="https://i.pravatar.cc/70?img=12"
            alt="avatar"
            className="avatar"
          />
          <h3>Hi {user?.name || "Alex"}!</h3>
        </div>

        <div className="menu">
          <div className="menu-item active">
            <FaComments className="menu-icon" />
            <span>Message</span>
          </div>

          <div className="menu-item">
            <FaPhoneAlt className="menu-icon" />
            <span>Calls</span>
          </div>

          <div className="menu-item">
            <FaAddressBook className="menu-icon" />
            <span>Contacts</span>
          </div>
        </div>

        <div className="bottom-tools">
          <div className="bottom-tool">
            <FaCloudUploadAlt />
            <span>Upload</span>
          </div>

          <div className="bottom-tool">
            <FaBriefcase />
            <span>Work</span>
          </div>

          <div className="bottom-tool">
            <FaCog />
            <span>Setting</span>
          </div>
        </div>
      </div>

      <div className="conversation-list">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search"
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {conversations.length === 0 ? (
          <p className="empty-text">No conversations yet.</p>
        ) : filteredConversations.length === 0 ? (
          <p className="empty-text">No matching conversations.</p>
        ) : (
          filteredConversations.map((conversation) => {
            const otherMember =
              conversation.members?.find(
                (member) => getUserId(member) && getUserId(member) !== user?.id
              ) || conversation.members?.[0];

            return (
              <div
                key={conversation.id}
                className={`conversation ${
                  selectedConversationId === conversation.id ? "selected" : ""
                }`}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <img
                  src={otherMember?.avatar || "https://i.pravatar.cc/45?img=13"}
                  alt="conversation"
                />
                <div className="conversation-content">
                  <div className="conversation-top">
                    <h4>{getConversationDisplayName(conversation)}</h4>
                    <span className="conversation-time">
                      {formatConversationTime(conversation.lastMessageTime)}
                    </span>
                  </div>
                  <div className="conversation-bottom">
                    <p>{getConversationPreview(conversation)}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-window">
        <div className="chat-header">
          <div className="chat-header-left">
            <img
              src={
                selectedOtherMember?.avatar || "https://i.pravatar.cc/45?img=13"
              }
              alt="selected user"
              className="chat-user-avatar"
            />
            <div>
              <div className="group-title-row">
                <h3>
                  {selectedConversation
                    ? selectedConversation.isGroup
                      ? selectedConversation.groupName || "Unnamed Group"
                      : selectedOtherMember?.name || "Unknown User"
                    : "No conversation selected"}
                </h3>

                {selectedConversation?.isGroup && (
                  <button
                    className="group-info-btn"
                    onClick={() => setShowGroupInfoModal(true)}
                  >
                    <FaInfoCircle />
                  </button>
                )}
              </div>

              <span>
                {selectedConversation?.isGroup
                  ? `${selectedGroupMemberCount} members`
                  : "Active"}
              </span>
            </div>
          </div>

          <div className="chat-header-actions">
            <FaPhone className="header-action-icon" />
            <FaVideo className="header-action-icon" />
          </div>
        </div>

        <div className="chat-date">Today</div>

        <div className="messages">
          {!selectedConversationId ? (
            <p className="empty-text">Please select a conversation.</p>
          ) : messages.length === 0 ? (
            <p className="empty-text">No messages yet.</p>
          ) : (
            messages.map((message) => {
              const senderId = getUserId(message.sender) || message.sender_id;
              const isMe = senderId === user?.id;

              return (
                <div
                  key={message.id}
                  className={`message-row ${isMe ? "me-row" : "other-row"}`}
                >
                  {!isMe && (
                    <img
                      src="https://i.pravatar.cc/38?img=13"
                      alt="sender"
                      className="message-avatar"
                    />
                  )}

                  <div className={`message-block ${isMe ? "me-block" : ""}`}>
                    <div className={`message ${isMe ? "me" : "other"}`}>
                      <p>{message.text}</p>
                    </div>

                    <div className={`message-meta ${isMe ? "me-meta" : ""}`}>
                      {!isMe && <FaHeart className="quick-react" />}
                      <span>{formatTime(message.createdAt || message.created_at)}</span>
                      {isMe && <FaHeart className="quick-react" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef}></div>
        </div>

        <div className="typing-text">Typing status will be added later...</div>

        <div className="chat-input">
          <div className="chat-input-left">
            <FaSmile className="input-icon" />
            <input
              placeholder="Chat Anyway..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
            />
          </div>

          <div className="chat-input-actions">
            <FaPaperclip className="input-action-icon" />
            <FaMicrophone className="input-action-icon" />
            <button className="send-btn" onClick={handleSendMessage}>
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>

      <div className="right-panel">
        <div className="panel-box">
          <div className="panel-header">
            <h4>Chat Files</h4>
            <FaTimes className="panel-top-icon" />
          </div>

          <div className="panel-item">
            <div className="panel-item-left">
              <FaImage className="panel-item-icon dark-icon" />
              <span>128 Photos</span>
            </div>
            <FaChevronDown className="panel-item-arrow" />
          </div>

          <div className="panel-divider"></div>

          <div className="panel-item">
            <div className="panel-item-left">
              <FaLink className="panel-item-icon dark-icon" />
              <span>13 Links</span>
            </div>
            <FaChevronDown className="panel-item-arrow" />
          </div>

          <div className="panel-divider"></div>

          <div className="panel-item">
            <div className="panel-item-left">
              <FaFileAlt className="panel-item-icon dark-icon" />
              <span>72 attachments</span>
            </div>
            <FaChevronDown className="panel-item-arrow" />
          </div>
        </div>

        <div className="panel-box">
          <h4>Reminders</h4>

          <label className="panel-check-item">
            <div className="panel-item-left">
              <MdCheckBox className="checkbox-icon checked-box" />
              <span>Design metting 10:30</span>
            </div>
          </label>

          <div className="panel-divider"></div>

          <label className="panel-check-item">
            <div className="panel-item-left">
              <MdCheckBoxOutlineBlank className="checkbox-icon" />
              <span>Create new group for study</span>
            </div>
          </label>

          <div className="panel-divider"></div>

          <label className="panel-check-item">
            <div className="panel-item-left">
              <MdCheckBoxOutlineBlank className="checkbox-icon" />
              <span>Email Erick about Scorriant for e...</span>
            </div>
          </label>
        </div>

        <div className="panel-box">
          <h4>Tool Box</h4>

          <label className="panel-check-item">
            <div className="panel-item-left blue-tool">
              <FaUserFriends className="panel-item-icon" />
              <span>Contact</span>
            </div>
          </label>

          <label className="panel-check-item">
            <div className="panel-item-left blue-tool">
              <FaCamera className="panel-item-icon" />
              <span>Camera</span>
            </div>
          </label>

          <label className="panel-check-item">
            <div className="panel-item-left blue-tool">
              <FaMicrophone className="panel-item-icon" />
              <span>Microphone</span>
            </div>
          </label>

          <label className="panel-check-item">
            <div className="panel-item-left blue-tool">
              <FaTrashAlt className="panel-item-icon" />
              <span>Delete Chat</span>
            </div>
          </label>

          <label className="panel-check-item" onClick={openGroupModal}>
            <div className="panel-item-left blue-tool">
              <FaUserPlus className="panel-item-icon" />
              <span>Add Group</span>
            </div>
          </label>
        </div>
      </div>

      {showGroupInfoModal && selectedConversation?.isGroup && (
        <div className="group-info-overlay">
          <div className="group-info-modal">
            <div className="group-info-header">
              <h3>Group Information</h3>
              <button
                className="group-info-close"
                onClick={() => setShowGroupInfoModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="group-info-body">
              <div className="group-info-section">
                <p className="group-info-label">Group name</p>
                <p className="group-info-value">
                  {selectedConversation.groupName || "Unnamed Group"}
                </p>
              </div>

              <div className="group-info-section">
                <p className="group-info-label">Created at</p>
                <p className="group-info-value">
                  {selectedConversation.createdAt
                    ? new Date(selectedConversation.createdAt).toLocaleString()
                    : "Unknown"}
                </p>
              </div>

              <div className="group-info-section">
                <p className="group-info-label">Members</p>
                <p className="group-info-value">
                  {selectedGroupMemberCount} members
                </p>
              </div>

              <div className="group-info-member-list">
                {selectedGroupMembersList.map((member) => {
                  const isAdmin =
                    getUserId(selectedConversation?.groupAdmin) === getUserId(member);

                  return (
                    <div key={member.id} className="group-info-member-row">
                      <img
                        src={member.avatar || "https://i.pravatar.cc/40?img=18"}
                        alt={member.name}
                        className="group-info-member-avatar"
                      />
                      <div className="group-info-member-text">
                        <div className="group-info-member-top">
                          <span className="group-info-member-name">
                            {member.name}
                          </span>
                          {isAdmin && (
                            <span className="group-info-admin-badge">Admin</span>
                          )}
                        </div>
                        <span className="group-info-member-email">
                          {member.email}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {isGroupModalOpen && (
        <div className="group-modal-overlay">
          <div className="group-modal">
            <div className="group-modal-header">
              <h3>Create Group</h3>
              <button className="group-modal-close" onClick={closeGroupModal}>
                <FaTimes />
              </button>
            </div>

            <div className="group-modal-body">
              <input
                type="text"
                placeholder="Enter group name"
                className="group-name-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />

              <div className="group-member-list">
                {allUsers.length === 0 ? (
                  <p className="empty-text">No friends available.</p>
                ) : (
                  allUsers.map((member) => (
                    <label key={member.id} className="group-member-item">
                      <input
                        type="checkbox"
                        checked={selectedGroupMembers.includes(member.id)}
                        onChange={() => toggleGroupMember(member.id)}
                      />
                      <img
                        src={member.avatar || "https://i.pravatar.cc/40?img=15"}
                        alt={member.name}
                        className="group-member-avatar"
                      />
                      <div className="group-member-info">
                        <span className="group-member-name">{member.name}</span>
                        <span className="group-member-email">{member.email}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="group-modal-footer">
              <button className="group-cancel-btn" onClick={closeGroupModal}>
                Cancel
              </button>
              <button
                className="group-create-btn"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup}
              >
                {isCreatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;