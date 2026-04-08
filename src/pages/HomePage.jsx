import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";
import socket from "../socket";
import {
  getConversations,
  createGroupConversation,
  createPrivateConversation
} from "../services/conversationService";
import {
  getMessagesByConversation,
  sendMessage
} from "../services/messageService";
import { getMe, getFriends } from "../services/userService";
import {
  getAvatarUrl,
  getStoredAuthUser,
  normalizeUserEntity,
  saveAuthUserToStorage
} from "../utils/userNormalizer";
import {
  GROUP_AVATAR_URL,
  GROUP_INFO_MEMBER_AVATAR_URL,
  GROUP_PICKER_MEMBER_AVATAR_URL,
  MESSAGE_SENDER_AVATAR_URL
} from "../constants/avatar";
import Sidebar from "../components/chat/Sidebar";
import ConversationList from "../components/chat/ConversationList";
import ChatWindow from "../components/chat/ChatWindow";
import RightPanel from "../components/chat/RightPanel";
import GroupModal from "../components/chat/GroupModal";
import GroupInfoModal from "../components/chat/GroupInfoModal";

const getEntityId = (entity) => {
  if (!entity || typeof entity !== "object") return null;
  return entity.id || entity.conversation_id || entity.message_id || entity._id;
};

const getUserId = (userEntity) => {
  if (!userEntity) return null;
  if (typeof userEntity === "string") return userEntity;
  return userEntity.id || userEntity.user_id || userEntity._id;
};

const getVirtualConversationId = (friendId) => `friend-${friendId}`;
const isVirtualConversationId = (conversationId) =>
  typeof conversationId === "string" && conversationId.startsWith("friend-");

function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredAuthUser());
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
    const lastMessage = conversation?.lastMessage || conversation?.last_message;

    if (!lastMessage) {
      return conversation?.isGroup ? "Group created" : "Start chatting...";
    }

    const messageType =
      lastMessage.messageType || lastMessage.message_type || lastMessage.type;

    if (messageType === "image") {
      return "Image";
    }

    if (messageType === "file") {
      return "File";
    }

    const textPreview =
      lastMessage.text ||
      lastMessage.content ||
      lastMessage.message ||
      conversation?.lastMessageText ||
      conversation?.last_message ||
      conversation?.last_message_text;

    if (typeof textPreview === "string" && textPreview.trim()) {
      return textPreview;
    }

    return "New message";
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

  const getConversationAvatar = (conversation) => {
    if (!conversation) return getAvatarUrl(null);

    if (conversation.isGroup) {
      return getAvatarUrl(conversation, GROUP_AVATAR_URL);
    }

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    return getAvatarUrl(otherMember, getAvatarUrl(user));
  };

  const mergeConversationsWithFriends = (conversationList, friendList) => {
    const safeConversations = Array.isArray(conversationList) ? conversationList : [];
    const safeFriends = Array.isArray(friendList) ? friendList : [];

    const existingFriendIds = new Set();

    safeConversations.forEach((conversation) => {
      if (conversation?.isGroup) return;

      const otherMember = conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      );

      const otherMemberId = getUserId(otherMember);
      if (otherMemberId) {
        existingFriendIds.add(otherMemberId);
      }
    });

    const virtualConversations = safeFriends
      .filter((friend) => {
        const friendId = getUserId(friend);
        return friendId && !existingFriendIds.has(friendId);
      })
      .map((friend) => ({
        id: getVirtualConversationId(getUserId(friend)),
        isGroup: false,
        isVirtual: true,
        friendId: getUserId(friend),
        members: [friend],
        lastMessage: null,
        lastMessageTime: null,
        updatedAt: null
      }));

    return [...safeConversations, ...virtualConversations];
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
        const normalizedMe = normalizeUserEntity(me);
        setUser(normalizedMe);
        saveAuthUserToStorage(normalizedMe);
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
        const [conversationData, friendData] = await Promise.all([
          getConversations(),
          getFriends()
        ]);

        const mergedConversations = mergeConversationsWithFriends(
          conversationData,
          friendData
        );

        setConversations(mergedConversations);

        if (mergedConversations.length > 0) {
          setSelectedConversationId(mergedConversations[0].id);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversationId || isVirtualConversationId(selectedConversationId)) {
      return;
    }
    socket.emit("join_conversation", selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }

      if (isVirtualConversationId(selectedConversationId)) {
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
      let targetConversationId = selectedConversationId;

      if (isVirtualConversationId(targetConversationId)) {
        const selectedVirtualConversation = conversations.find(
          (conversation) => conversation.id === selectedConversationId
        );
        const friendId = selectedVirtualConversation?.friendId;

        if (!friendId) {
          console.error("Missing friend id for virtual conversation");
          return;
        }

        const createdConversation = await createPrivateConversation([friendId]);

        setConversations((prev) => {
          const filtered = prev.filter(
            (conversation) => conversation.id !== selectedConversationId
          );
          return [createdConversation, ...filtered];
        });

        setSelectedConversationId(createdConversation.id);
        targetConversationId = createdConversation.id;
      }

      const sentMessage = await sendMessage({
        conversationId: targetConversationId,
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

  const sidebarAvatar = getAvatarUrl(user);
  const headerAvatar = selectedConversation
    ? getConversationAvatar(selectedConversation)
    : getAvatarUrl(user);

  const getMessageSenderAvatar = (sender) =>
    getAvatarUrl(sender, MESSAGE_SENDER_AVATAR_URL);

  const getGroupInfoMemberAvatar = (member) =>
    getAvatarUrl(member, GROUP_INFO_MEMBER_AVATAR_URL);

  const getGroupPickerMemberAvatar = (member) =>
    getAvatarUrl(member, GROUP_PICKER_MEMBER_AVATAR_URL);

  const getDirectChatStatusText = (conversation) => {
    if (!conversation || conversation.isGroup) return "";

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    const isOnline =
      otherMember?.is_online ??
      otherMember?.isOnline ??
      otherMember?.online ??
      false;

    return isOnline ? "Online" : "Offline";
  };

  return (
    <div className="chat-layout">
      <Sidebar
        avatarUrl={sidebarAvatar}
        userName={user?.name}
        activeMenu="messages"
        onOpenMessages={() => navigate("/home")}
        onOpenContacts={() => navigate("/contacts")}
        onOpenProfile={() => navigate("/profile")}
      />

      <ConversationList
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        conversations={conversations}
        filteredConversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        getConversationAvatar={getConversationAvatar}
        getConversationDisplayName={getConversationDisplayName}
        formatConversationTime={formatConversationTime}
        getConversationPreview={getConversationPreview}
      />

      <ChatWindow
        selectedConversation={selectedConversation}
        selectedOtherMember={selectedOtherMember}
        selectedGroupMemberCount={selectedGroupMemberCount}
        headerStatusText={getDirectChatStatusText(selectedConversation)}
        headerAvatar={headerAvatar}
        setShowGroupInfoModal={setShowGroupInfoModal}
        selectedConversationId={selectedConversationId}
        messages={messages}
        user={user}
        getUserId={getUserId}
        getMessageSenderAvatar={getMessageSenderAvatar}
        formatTime={formatTime}
        messagesEndRef={messagesEndRef}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleSendMessage={handleSendMessage}
      />

      <RightPanel openGroupModal={openGroupModal} />

      <GroupInfoModal
        show={showGroupInfoModal}
        selectedConversation={selectedConversation}
        selectedGroupMemberCount={selectedGroupMemberCount}
        selectedGroupMembersList={selectedGroupMembersList}
        close={() => setShowGroupInfoModal(false)}
        getUserId={getUserId}
        getGroupInfoMemberAvatar={getGroupInfoMemberAvatar}
      />

      <GroupModal
        isOpen={isGroupModalOpen}
        closeGroupModal={closeGroupModal}
        groupName={groupName}
        setGroupName={setGroupName}
        allUsers={allUsers}
        selectedGroupMembers={selectedGroupMembers}
        toggleGroupMember={toggleGroupMember}
        getGroupMemberAvatar={getGroupPickerMemberAvatar}
        handleCreateGroup={handleCreateGroup}
        isCreatingGroup={isCreatingGroup}
      />
    </div>
  );
}

export default HomePage;