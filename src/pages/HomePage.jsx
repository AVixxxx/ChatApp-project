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
import { findAccount } from "../services/authService";
import { sendFriendRequest } from "../services/friendService";
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
import AddFriendModal from "../components/chat/AddFriendModal";

const getEntityId = (entity) => {
  if (!entity || typeof entity !== "object") return null;
  return entity.id || entity.conversation_id || entity.message_id || entity._id;
};

const getUserId = (userEntity) => {
  if (!userEntity) return null;
  if (typeof userEntity === "string") return userEntity;
  return userEntity.id || userEntity.user_id || userEntity._id;
};

const getUserDisplayName = (userEntity) => {
  if (!userEntity) return "Unknown User";

  if (typeof userEntity === "string") {
    return `User ${userEntity.slice(0, 6)}`;
  }

  const normalized = normalizeUserEntity(userEntity);
  if (normalized?.name && normalized.name.trim()) {
    return normalized.name.trim();
  }

  const fallbackId = getUserId(userEntity);
  if (fallbackId) {
    return `User ${String(fallbackId).slice(0, 6)}`;
  }

  return "Unknown User";
};

const getVirtualConversationId = (friendId) => `friend-${friendId}`;
const isVirtualConversationId = (conversationId) =>
  typeof conversationId === "string" && conversationId.startsWith("friend-");

const getSafeId = (value) => {
  if (!value) return "";
  return String(value);
};

const parseOnlineValue = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "t" ||
      normalized === "online"
    );
  }
  return false;
};

const HOME_CONVERSATIONS_CACHE_KEY = "homeConversationsCacheV1";
const HOME_CONVERSATIONS_CACHE_TTL_MS = 5 * 60 * 1000;

const readHomeConversationsCache = () => {
  try {
    const raw = sessionStorage.getItem(HOME_CONVERSATIONS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const timestamp = Number(parsed.timestamp || 0);
    if (!timestamp || Date.now() - timestamp > HOME_CONVERSATIONS_CACHE_TTL_MS) {
      return null;
    }

    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      selectedConversationId: parsed.selectedConversationId || null
    };
  } catch {
    return null;
  }
};

const writeHomeConversationsCache = ({ conversations, selectedConversationId }) => {
  try {
    sessionStorage.setItem(
      HOME_CONVERSATIONS_CACHE_KEY,
      JSON.stringify({
        conversations,
        selectedConversationId,
        timestamp: Date.now()
      })
    );
  } catch {
    // Ignore cache write failures (private mode/quota issues)
  }
};

const getConversationFingerprint = (conversation) => {
  if (!conversation || typeof conversation !== "object") return "";

  const lastUpdated =
    conversation.updatedAt ||
    conversation.lastMessageTime ||
    conversation.last_message_time ||
    conversation.lastMessage?.createdAt ||
    conversation.lastMessage?.created_at ||
    "";

  return `${conversation.id}|${lastUpdated}`;
};

const isConversationListEquivalent = (currentList, incomingList) => {
  if (!Array.isArray(currentList) || !Array.isArray(incomingList)) return false;
  if (currentList.length !== incomingList.length) return false;

  for (let index = 0; index < currentList.length; index += 1) {
    if (
      getConversationFingerprint(currentList[index]) !==
      getConversationFingerprint(incomingList[index])
    ) {
      return false;
    }
  }

  return true;
};

function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [conversations, setConversations] = useState(() => {
    const cached = readHomeConversationsCache();
    return cached?.conversations || [];
  });
  const [selectedConversationId, setSelectedConversationId] = useState(() => {
    const cached = readHomeConversationsCache();
    return cached?.selectedConversationId || null;
  });
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [addFriendKeyword, setAddFriendKeyword] = useState("");
  const [addFriendResults, setAddFriendResults] = useState([]);
  const [addFriendError, setAddFriendError] = useState("");
  const [isSearchingAddFriend, setIsSearchingAddFriend] = useState(false);
  const [sendingAddFriendId, setSendingAddFriendId] = useState("");
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

    return getUserDisplayName(otherMember);
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
    const safeFriends = Array.isArray(friendList)
      ? friendList.map((friend) => normalizeUserEntity(friend))
      : [];

    const friendDirectory = new Map(
      safeFriends
        .map((friend) => [getSafeId(getUserId(friend)), friend])
        .filter(([friendId]) => Boolean(friendId))
    );

    const allowedFriendIds = new Set(friendDirectory.keys());

    const sanitizedConversations = safeConversations
      .map((conversation) => {
        if (conversation?.isGroup) return conversation;

        const otherMember = conversation.members?.find(
          (member) => getUserId(member) && getUserId(member) !== user?.id
        );

        const otherMemberId = getSafeId(getUserId(otherMember));
        if (!otherMemberId || !allowedFriendIds.has(otherMemberId)) {
          return null;
        }

        const friendProfile = friendDirectory.get(otherMemberId);
        const hydratedMembers = Array.isArray(conversation.members)
          ? conversation.members.map((member) => {
              const memberId = getSafeId(getUserId(member));
              if (memberId === otherMemberId) {
                return {
                  ...member,
                  ...friendProfile
                };
              }
              return member;
            })
          : [friendProfile];

        return {
          ...conversation,
          members: hydratedMembers
        };
      })
      .filter(Boolean);

    const existingFriendIds = new Set();

    sanitizedConversations.forEach((conversation) => {
      if (conversation?.isGroup) return;

      const otherMember = conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      );

      const otherMemberId = getSafeId(getUserId(otherMember));
      if (otherMemberId) {
        existingFriendIds.add(otherMemberId);
      }
    });

    const virtualConversations = safeFriends
      .filter((friend) => {
        const friendId = getSafeId(getUserId(friend));
        return friendId && !existingFriendIds.has(friendId);
      })
      .map((friend) => ({
        id: getVirtualConversationId(getSafeId(getUserId(friend))),
        isGroup: false,
        isVirtual: true,
        friendId: getSafeId(getUserId(friend)),
        members: [friend],
        lastMessage: null,
        lastMessageTime: null,
        updatedAt: null
      }));

    return [...sanitizedConversations, ...virtualConversations];
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
    socket.emit("user_online", user.id);
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
    writeHomeConversationsCache({ conversations, selectedConversationId });
  }, [conversations, selectedConversationId]);

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

        setConversations((prev) =>
          isConversationListEquivalent(prev, mergedConversations)
            ? prev
            : mergedConversations
        );

        setSelectedConversationId((prev) => {
          if (prev && mergedConversations.some((conversation) => conversation.id === prev)) {
            return prev;
          }

          return mergedConversations[0]?.id || null;
        });
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
    const handleUserStatus = ({ userId, status }) => {
      const targetUserId = getSafeId(userId);
      if (!targetUserId) return;

      const isOnline =
        parseOnlineValue(status) ||
        String(status || "").trim().toLowerCase() === "online";

      setConversations((prev) =>
        prev.map((conversation) => {
          if (!Array.isArray(conversation?.members)) return conversation;

          let changed = false;
          const updatedMembers = conversation.members.map((member) => {
            const memberId = getSafeId(getUserId(member));
            if (!memberId || memberId !== targetUserId) {
              return member;
            }

            changed = true;
            return {
              ...member,
              is_online: isOnline,
              isOnline,
              online: isOnline
            };
          });

          if (!changed) return conversation;
          return {
            ...conversation,
            members: updatedMembers
          };
        })
      );
    };

    socket.on("user_status", handleUserStatus);

    return () => {
      socket.off("user_status", handleUserStatus);
    };
  }, []);

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

  const selectedConversationDisplayName = selectedConversation
    ? selectedConversation.isGroup
      ? selectedConversation.groupName || "Unnamed Group"
      : getUserDisplayName(selectedOtherMember)
    : "No conversation selected";

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

  const openAddFriendModal = () => {
    setIsAddFriendModalOpen(true);
    setAddFriendKeyword("");
    setAddFriendResults([]);
    setAddFriendError("");
  };

  const closeAddFriendModal = () => {
    if (isSearchingAddFriend || sendingAddFriendId) return;
    setIsAddFriendModalOpen(false);
    setAddFriendKeyword("");
    setAddFriendResults([]);
    setAddFriendError("");
  };

  const getSearchMode = (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value) return "none";
    if (value.includes("@")) return "email";

    const digitsOnly = value.replace(/[^0-9]/g, "");
    if (digitsOnly && digitsOnly.length >= 6) return "phone";
    return "invalid";
  };

  const buildSearchResult = (candidate) => {
    const normalized = normalizeUserEntity(candidate);
    const candidateId = getSafeId(getUserId(normalized || candidate));
    if (!candidateId || candidateId === getSafeId(user?.id)) return null;

    return {
      ...normalized,
      id: candidateId,
      avatar: getAvatarUrl(normalized),
      email: normalized?.email || candidate?.email || "",
      phone:
        normalized?.phone ||
        normalized?.phone_number ||
        candidate?.phone ||
        candidate?.phone_number ||
        ""
    };
  };

  const searchUsersWithApi = async (input, mode) => {
    const normalizedValue = String(input || "").trim();
    const rawCandidates = [];

    if (mode === "phone") {
      const digits = normalizedValue.replace(/[^0-9]/g, "");
      const variants = Array.from(
        new Set([digits, `+${digits}`, `+84${digits.replace(/^0/, "")}`])
      ).filter(Boolean);

      for (const value of variants) {
        try {
          const result = await findAccount(value);
          rawCandidates.push(result);
        } catch {
          // Try next phone format
        }
      }
    } else {
      const result = await findAccount(normalizedValue);
      rawCandidates.push(result);
    }

    const flattened = rawCandidates.flatMap((item) =>
      Array.isArray(item) ? item : item ? [item] : []
    );

    return flattened
      .map(buildSearchResult)
      .filter(Boolean)
      .filter(
        (item, index, self) =>
          index === self.findIndex((entry) => getSafeId(entry.id) === getSafeId(item.id))
      );
  };

  const handleSearchAddFriend = async () => {
    const rawKeyword = String(addFriendKeyword || "").trim();
    const mode = getSearchMode(rawKeyword);

    if (!rawKeyword) {
      setAddFriendResults([]);
      setAddFriendError("Vui lòng nhập số điện thoại hoặc email");
      return;
    }

    if (mode === "invalid") {
      setAddFriendResults([]);
      setAddFriendError("Vui lòng nhập số điện thoại hoặc email hợp lệ");
      return;
    }

    const keywordForSearch =
      mode === "phone" ? rawKeyword.replace(/[^0-9]/g, "") : rawKeyword;

    try {
      setIsSearchingAddFriend(true);
      setAddFriendError("");

      const results = await searchUsersWithApi(keywordForSearch, mode);
      setAddFriendResults(results);

      if (results.length === 0) {
        setAddFriendError("Không tìm thấy người dùng");
      }
    } catch {
      setAddFriendResults([]);
      setAddFriendError("Không thể tìm kiếm lúc này");
    } finally {
      setIsSearchingAddFriend(false);
    }
  };

  const handleAddFriendFromSearch = async (receiverId) => {
    if (!receiverId) return;

    try {
      setSendingAddFriendId(String(receiverId));
      setAddFriendError("");
      await sendFriendRequest(receiverId);
      setAddFriendResults((prev) =>
        prev.filter((item) => getSafeId(item.id) !== getSafeId(receiverId))
      );
    } catch (requestError) {
      setAddFriendError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Could not send friend request"
      );
    } finally {
      setSendingAddFriendId("");
    }
  };

  const getDirectChatStatusInfo = (conversation) => {
    if (!conversation || conversation.isGroup) {
      return {
        text: "",
        className: "offline"
      };
    }

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    const isOnline =
      parseOnlineValue(
        otherMember?.is_online ??
          otherMember?.isOnline ??
          otherMember?.online ??
          false
      );

    return {
      text: isOnline ? "Online" : "Offline",
      className: isOnline ? "online" : "offline"
    };
  };

  const selectedStatusInfo = getDirectChatStatusInfo(selectedConversation);

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
        onOpenAddFriend={openAddFriendModal}
        onOpenCreateGroup={openGroupModal}
        conversations={conversations}
        filteredConversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        getConversationAvatar={getConversationAvatar}
        getConversationDisplayName={getConversationDisplayName}
        getConversationStatusText={(conversation) =>
          getDirectChatStatusInfo(conversation)?.text || "Offline"
        }
        formatConversationTime={formatConversationTime}
        getConversationPreview={getConversationPreview}
      />

      <ChatWindow
        selectedConversation={selectedConversation}
        selectedConversationDisplayName={selectedConversationDisplayName}
        selectedGroupMemberCount={selectedGroupMemberCount}
        headerStatusText={selectedStatusInfo?.text || "Offline"}
        headerStatusClass={selectedStatusInfo?.className || "offline"}
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

      <AddFriendModal
        isOpen={isAddFriendModalOpen}
        keyword={addFriendKeyword}
        onKeywordChange={setAddFriendKeyword}
        results={addFriendResults}
        error={addFriendError}
        isSearching={isSearchingAddFriend}
        sendingId={sendingAddFriendId}
        onClose={closeAddFriendModal}
        onSearch={handleSearchAddFriend}
        onAddFriend={handleAddFriendFromSearch}
      />
    </div>
  );
}

export default HomePage;