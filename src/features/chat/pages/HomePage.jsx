import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./HomePage.css";
import socket, { connectSocketWithToken } from "@/socket";
import {
  getConversations,
  getConversationMembers,
  createGroupConversation,
  createPrivateConversation,
  addMemberToGroup,
  generateJoinCode,
  removeMemberFromGroup,
  leaveGroupConversation,
  joinGroupByCode,
  transferAdminRole,
  deleteGroupConversation,
  updateGroupInfo,
  togglePinConversation as togglePinConversationApi,
  createPoll as createPollApi,
  getPolls as getPollsApi,
  votePollOption as votePollOptionApi
} from "@/features/chat/services/conversationService";
import {
  getMessagesPage,
  sendMessage,
  recallMessage as recallMessageApi,
  deleteMessage as deleteMessageApi,
  normalizeMessage,
  FORWARDED_CONTENT_MARKER
} from "@/features/chat/services/messageService";
import { findAccount } from "@/features/auth/services/authService";
import { sendFriendRequest, unfriendFriend } from "@/features/contacts/services/friendService";
import { getMe, getFriends } from "@/features/profile/services/userService";
import {
  getAvatarUrl,
  getStoredAuthUser,
  normalizeUserEntity,
  saveAuthUserToStorage
} from "@/utils/userNormalizer";
import {
  GROUP_AVATAR_URL,
  GROUP_INFO_MEMBER_AVATAR_URL,
  GROUP_PICKER_MEMBER_AVATAR_URL,
  MESSAGE_SENDER_AVATAR_URL
} from "@/constants/avatar";
import Sidebar from "@/features/chat/components/Sidebar";
import ConversationList from "@/features/chat/components/ConversationList";
import ChatWindow from "@/features/chat/components/ChatWindow";
import RightPanel from "@/features/chat/components/RightPanel";
import GroupModal from "@/features/chat/components/GroupModal";
import GroupInfoModal from "@/features/chat/components/GroupInfoModal";
import AddFriendModal from "@/features/chat/components/AddFriendModal";
import FriendProfileModal from "@/features/contacts/components/FriendProfileModal";
import CallOverlay from "@/features/chat/components/CallOverlay";
import { useGroupCall } from "@/features/chat/hooks/useGroupCall";
import CallParticipantModal from "@/features/chat/components/CallParticipantModal";
import ActionDialog from "@/features/chat/components/ActionDialog";
import JoinByCodeModal from "@/features/chat/components/JoinByCodeModal";
import GroupJoinCodeModal from "@/features/chat/components/GroupJoinCodeModal";
import ForwardMessageModal from "@/features/chat/components/ForwardMessageModal";

const getEntityId = (entity) => {
  if (!entity || typeof entity !== "object") return null;
  return entity.id || entity.message_id || entity.conversation_id || entity._id;
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

const normalizeComparableText = (value) =>
  String(value || "").trim().toLowerCase();

const escapeSelectorValue = (value) => {
  const safeValue = getSafeId(value);

  if (!safeValue) return "";

  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(safeValue);
  }

  return safeValue.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
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
const MESSAGE_PAGE_SIZE = 30;
const buildForwardedContent = (text = "") =>
  `${FORWARDED_CONTENT_MARKER}${String(text || "")}`;

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
  const location = useLocation();
  const [socketClient] = useState(socket);
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [conversations, setConversations] = useState(() => {
    const cached = readHomeConversationsCache();
    const initialConversations = cached?.conversations || [];
    const routedConversation = location.state?.conversation
      ? [location.state.conversation]
      : [];

    return [...routedConversation, ...initialConversations];
  });
  const [selectedConversationId, setSelectedConversationId] = useState(() => {
    const cached = readHomeConversationsCache();
    return location.state?.conversationId || cached?.selectedConversationId || null;
  });
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
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
  const [groupModalError, setGroupModalError] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoinByCodeModalOpen, setIsJoinByCodeModalOpen] = useState(false);
  const [joinByCodeInput, setJoinByCodeInput] = useState("");
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [groupInfoInitialAddMembersView, setGroupInfoInitialAddMembersView] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [isTransferringAdmin, setIsTransferringAdmin] = useState(false);
  const [isDissolvingGroup, setIsDissolvingGroup] = useState(false);
  const [isGroupJoinCodeModalOpen, setIsGroupJoinCodeModalOpen] = useState(false);
  const [generatedJoinCode, setGeneratedJoinCode] = useState("");
  const [isGeneratingJoinCode, setIsGeneratingJoinCode] = useState(false);
  const [showFriendProfileModal, setShowFriendProfileModal] = useState(false);
  const [dialogState, setDialogState] = useState(null);
  const [selectedFriendProfile, setSelectedFriendProfile] = useState(null);
  const [selectedFriendProfileAction, setSelectedFriendProfileAction] = useState("view");
  const [currentConversation, setCurrentConversation] = useState(null);
  const [unreadCountByConversationId, setUnreadCountByConversationId] = useState({});
  const [isCallParticipantModalOpen, setIsCallParticipantModalOpen] = useState(false);
  const [selectedCallParticipantIds, setSelectedCallParticipantIds] = useState([]);
  const [pendingCallMode, setPendingCallMode] = useState("video");
  const [callParticipantError, setCallParticipantError] = useState("");
  const [isStartingSelectedCall, setIsStartingSelectedCall] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardTargetConversationIds, setForwardTargetConversationIds] = useState([]);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardError, setForwardError] = useState("");
  const [isForwardingMessage, setIsForwardingMessage] = useState(false);
  const [pinActionLoadingByConversationId, setPinActionLoadingByConversationId] = useState({});
  const [, setPinToast] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [votingPollId, setVotingPollId] = useState("");
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const shouldScrollToBottomRef = useRef(false);
  const systemMessageSequenceRef = useRef(0);
  const pendingPrependScrollRef = useRef(null);
  const isLoadingOlderMessagesRef = useRef(false);
  const failedOlderMessagesCursorRef = useRef(null);
  const replyHighlightTimeoutRef = useRef(null);
  const pinToastTimeoutRef = useRef(null);
  const joinedConversationIdsRef = useRef(new Set());
  const messagesRef = useRef([]);
  const [messagePageCursor, setMessagePageCursor] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isInitialMessagesLoading, setIsInitialMessagesLoading] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);

  const formatTime = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

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

  const getConversationSortTime = (conversation) => {
    const rawValue =
      conversation?.updatedAt ||
      conversation?.lastMessageTime ||
      conversation?.last_message_time ||
      conversation?.lastMessage?.createdAt ||
      conversation?.lastMessage?.created_at ||
      conversation?.last_time ||
      conversation?.lastTime ||
      conversation?.last_message_at ||
      conversation?.createdAt ||
      conversation?.created_at ||
      conversation?.create_at ||
      0;

    const parsed = new Date(rawValue).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isConversationPinned = (conversation) =>
    Boolean(conversation?.isPinned ?? conversation?.is_pinned ?? false);

  const getConversationPinnedSortTime = (conversation) => {
    const rawValue =
      conversation?.pinnedAt ||
      conversation?.pinned_at ||
      conversation?.pin_time ||
      0;

    const parsed = new Date(rawValue).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sortConversationsByPinAndActivity = (conversationList = []) => {
    return [...conversationList].sort((firstConversation, secondConversation) => {
      const firstPinned = isConversationPinned(firstConversation);
      const secondPinned = isConversationPinned(secondConversation);

      if (firstPinned && !secondPinned) return -1;
      if (!firstPinned && secondPinned) return 1;

      if (firstPinned && secondPinned) {
        const pinnedDelta =
          getConversationPinnedSortTime(secondConversation) -
          getConversationPinnedSortTime(firstConversation);

        if (pinnedDelta !== 0) return pinnedDelta;
      }

      return (
        getConversationSortTime(secondConversation) -
        getConversationSortTime(firstConversation)
      );
    });
  };

  const applyConversationPinState = (
    conversationList = [],
    conversationId,
    isPinned,
    pinnedAt
  ) => {
    const normalizedConversationId = getSafeId(conversationId);

    return (Array.isArray(conversationList) ? conversationList : []).map((conversation) => {
      if (getSafeId(conversation?.id) !== normalizedConversationId) {
        return conversation;
      }

      const normalizedPinnedAt = isPinned
        ? pinnedAt || new Date().toISOString()
        : null;

      return {
        ...conversation,
        isPinned: Boolean(isPinned),
        is_pinned: Boolean(isPinned),
        pinnedAt: normalizedPinnedAt,
        pinned_at: normalizedPinnedAt
      };
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

  const hydrateGroupConversationMembers = async (conversationId) => {
    if (!conversationId) return;

    try {
      const members = await getConversationMembers(conversationId);

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId || !conversation.isGroup) {
            return conversation;
          }

          const groupAdmin =
            members.find((member) => String(member.role || "").toLowerCase() === "admin") || null;

          return {
            ...conversation,
            members,
            groupAdmin
          };
        })
      );
    } catch (error) {
      console.error("Failed to load group members:", error);
    }
  };

  const applyTransferredAdminState = (conversation, oldAdminId, newAdminId) => {
    if (!conversation) return conversation;

    const safeOldAdminId = String(oldAdminId || "");
    const safeNewAdminId = String(newAdminId || "");

    if (!safeNewAdminId) {
      return conversation;
    }

    const nextMembers = Array.isArray(conversation.members)
      ? conversation.members.map((member) => {
          const memberId = String(getUserId(member) || "");
          if (!memberId) return member;

          if (memberId === safeNewAdminId) {
            return {
              ...member,
              role: "admin"
            };
          }

          if (!safeOldAdminId || memberId === safeOldAdminId) {
            return {
              ...member,
              role: "member"
            };
          }

          return member;
        })
      : conversation.members;

    const nextGroupAdmin =
      nextMembers?.find(
        (member) => String(getUserId(member) || "") === safeNewAdminId
      ) || conversation.groupAdmin;

    return {
      ...conversation,
      members: nextMembers,
      groupAdmin: nextGroupAdmin
    };
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

  const mergeOnlineStateIntoConversation = (incomingConversation, currentConversationItem) => {
    if (!incomingConversation) return incomingConversation;

    if (incomingConversation.isGroup) {
      return incomingConversation;
    }

    const currentMembers = Array.isArray(currentConversationItem?.members)
      ? currentConversationItem.members
      : [];

    const mergedMembers = Array.isArray(incomingConversation.members)
      ? incomingConversation.members.map((member) => {
          const memberId = getUserId(member);
          const existingMember = currentMembers.find(
            (currentMember) => getUserId(currentMember) === memberId
          );

          if (!existingMember) return member;

          return {
            ...member,
            isOnline:
              existingMember.isOnline ?? member.isOnline ?? existingMember.online ?? member.online,
            is_online:
              existingMember.is_online ?? member.is_online ?? existingMember.isOnline ?? member.isOnline,
            online: existingMember.online ?? member.online ?? existingMember.isOnline ?? member.isOnline
          };
        })
      : incomingConversation.members;

    return {
      ...incomingConversation,
      members: mergedMembers
    };
  };

  const mergeConversationListPresence = (nextConversations, previousConversations) => {
    return nextConversations.map((incomingConversation) => {
      const currentConversationItem = previousConversations.find(
        (conversation) => conversation.id === incomingConversation.id
      );

      return mergeOnlineStateIntoConversation(incomingConversation, currentConversationItem);
    });
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

      return sortConversationsByPinAndActivity(updated);
    });
  };

  const resolveConversationTarget = async () => {
    let targetConversationId = selectedConversationId;

    if (!isVirtualConversationId(targetConversationId)) {
      return targetConversationId;
    }

    const selectedVirtualConversation = conversations.find(
      (conversation) => conversation.id === selectedConversationId
    );
    const friendId = selectedVirtualConversation?.friendId;

    if (!friendId) {
      console.error("Missing friend id for virtual conversation");
      return null;
    }

    const createdConversation = await createPrivateConversation([friendId]);

    setConversations((prev) => {
      const filtered = prev.filter((conversation) => conversation.id !== selectedConversationId);
      return [createdConversation, ...filtered];
    });

    setSelectedConversationId(createdConversation.id);
    return createdConversation.id;
  };

  const resolveConversationTargetByConversation = async (conversation) => {
    const targetConversationId = getSafeId(conversation?.id);
    if (!targetConversationId) {
      return null;
    }

    if (!isVirtualConversationId(targetConversationId)) {
      return targetConversationId;
    }

    const otherMember = Array.isArray(conversation?.members)
      ? conversation.members.find(
          (member) => getSafeId(getUserId(member)) !== getSafeId(user?.id)
        )
      : null;

    const friendId =
      getSafeId(conversation?.friendId) ||
      getSafeId(getUserId(otherMember));

    if (!friendId) {
      console.error("Missing friend id for virtual forward conversation");
      return null;
    }

    const createdConversation = await createPrivateConversation([friendId]);

    setConversations((prev) => {
      const filtered = prev.filter((item) => item.id !== targetConversationId);
      return sortConversationsByPinAndActivity([createdConversation, ...filtered]);
    });

    return createdConversation.id;
  };

  const appendMessageWithoutDuplicate = (message) => {
    const normalizedCreatedAt =
      message?.createdAt || message?.created_at || message?.create_at;

    const toTimestamp = (messageItem) => {
      const value =
        messageItem?.createdAt || messageItem?.created_at || messageItem?.create_at;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    setMessages((prev) => {
      const messageWithReplyPreview = attachReplyPreview(message, prev);
      const exists = prev.some((existingMessage) => {
        if (existingMessage.id && messageWithReplyPreview.id) {
          return existingMessage.id === messageWithReplyPreview.id;
        }

        const sameConversation =
          (existingMessage.conversationId || existingMessage.conversation_id) ===
          (messageWithReplyPreview.conversationId || messageWithReplyPreview.conversation_id);
        const sameSender =
          (existingMessage.sender_id || getUserId(existingMessage.sender)) ===
          (messageWithReplyPreview.sender_id || getUserId(messageWithReplyPreview.sender));
        const sameText = (existingMessage.text || "") === (messageWithReplyPreview.text || "");
        const existingCreatedAt =
          existingMessage.createdAt ||
          existingMessage.created_at ||
          existingMessage.create_at;
        const sameCreatedAt = existingCreatedAt === normalizedCreatedAt;

        return sameConversation && sameSender && sameText && sameCreatedAt;
      });

      if (exists) return prev;
      return attachReplyPreviews([...prev, messageWithReplyPreview]).sort(
        (firstMessage, secondMessage) =>
          toTimestamp(firstMessage) - toTimestamp(secondMessage)
      );
    });
  };

  const handleReplyMessage = (message) => {
    const replyPreview = createReplyPreview(message);
    if (!replyPreview) return;

    setReplyTarget(replyPreview);
  };

  const removeMessagesByIds = (messageIds) => {
    const idSet = new Set(
      (Array.isArray(messageIds) ? messageIds : [messageIds])
        .map((value) => getSafeId(value))
        .filter(Boolean)
    );

    if (idSet.size === 0) return;

    setMessages((prev) =>
      prev.filter((message) => !idSet.has(getSafeId(getEntityId(message))))
    );
  };

  const markMessagesAsRecalled = (messageIds) => {
    const idSet = new Set(
      (Array.isArray(messageIds) ? messageIds : [messageIds])
        .map((value) => getSafeId(value))
        .filter(Boolean)
    );

    if (idSet.size === 0) return;

    setMessages((prev) =>
      prev.map((message) => {
        const messageId = getSafeId(getEntityId(message));
        if (!idSet.has(messageId)) {
          return message;
        }

        return normalizeMessage({
          ...message,
          text: "[Tin nhắn đã được thu hồi]",
          content: "[Tin nhắn đã được thu hồi]",
          is_recalled: true,
          file_url: "",
          fileUrl: "",
          imageUrl: ""
        });
      })
    );

    setConversations((prev) =>
      prev.map((conversation) => {
        const lastMessage = conversation?.lastMessage;
        const lastMessageId = getSafeId(getEntityId(lastMessage || {}));

        if (!idSet.has(lastMessageId)) {
          return conversation;
        }

        return {
          ...conversation,
          lastMessage: normalizeMessage({
            ...(lastMessage || {}),
            id: lastMessageId,
            text: "[Tin nhắn đã được thu hồi]",
            content: "[Tin nhắn đã được thu hồi]",
            is_recalled: true,
            file_url: "",
            fileUrl: "",
            imageUrl: ""
          })
        };
      })
    );
  };

  const getApiErrorMessage = (error, fallbackMessage) => {
    const responseData = error?.response?.data;

    if (typeof responseData === "string" && responseData.trim()) {
      return responseData;
    }

    if (responseData && typeof responseData === "object") {
      const candidate = responseData.error || responseData.message;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }

    if (typeof error?.message === "string" && error.message.trim()) {
      return error.message;
    }

    return fallbackMessage;
  };

  const showPinToast = (type, message) => {
    setPinToast({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message
    });

    if (pinToastTimeoutRef.current) {
      window.clearTimeout(pinToastTimeoutRef.current);
    }

    pinToastTimeoutRef.current = window.setTimeout(() => {
      setPinToast(null);
      pinToastTimeoutRef.current = null;
    }, 2600);
  };

  const handleTogglePinConversation = async (conversation) => {
    const conversationId = getSafeId(conversation?.id);
    if (!conversationId || conversation?.isVirtual) return;

    if (pinActionLoadingByConversationId[conversationId]) {
      return;
    }

    const wasPinned = isConversationPinned(conversation);
    const previousPinnedAt = conversation?.pinnedAt || conversation?.pinned_at || null;
    const nextPinned = !wasPinned;
    const optimisticPinnedAt = nextPinned ? new Date().toISOString() : null;

    setPinActionLoadingByConversationId((prev) => ({
      ...prev,
      [conversationId]: true
    }));

    setConversations((prev) =>
      applyConversationPinState(prev, conversationId, nextPinned, optimisticPinnedAt)
    );

    try {
      await togglePinConversationApi({
        conversationId,
        isPinned: nextPinned
      });

      showPinToast("success", nextPinned ? "Da ghim cuoc tro chuyen" : "Da bo ghim cuoc tro chuyen");
    } catch (error) {
      setConversations((prev) =>
        applyConversationPinState(prev, conversationId, wasPinned, previousPinnedAt)
      );

      showPinToast("error", getApiErrorMessage(error, "Khong the cap nhat trang thai ghim luc nay"));
    } finally {
      setPinActionLoadingByConversationId((prev) => {
        const nextState = { ...prev };
        delete nextState[conversationId];
        return nextState;
      });
    }
  };

  const getGroupParticipantDisplayName = (targetUserId, conversationId) => {
    const normalizedTargetId = getSafeId(targetUserId);
    if (!normalizedTargetId) return "Một thành viên";

    if (normalizedTargetId === getSafeId(user?.id)) {
      return "Bạn";
    }

    const targetConversation = conversations.find(
      (conversation) => String(conversation.id) === String(conversationId)
    );

    const matchedConversationMember = (targetConversation?.members || []).find(
      (member) => getSafeId(getUserId(member)) === normalizedTargetId
    );

    if (matchedConversationMember) {
      return getUserDisplayName(matchedConversationMember);
    }

    const matchedFriend = (allUsers || []).find(
      (friend) => getSafeId(getUserId(friend)) === normalizedTargetId
    );

    if (matchedFriend) {
      return getUserDisplayName(matchedFriend);
    }

    return getUserDisplayName(targetUserId);
  };

  const appendGroupSystemMessage = ({ conversationId, text, eventType, targetUserId }) => {
    const normalizedConversationId = getSafeId(conversationId);
    const messageText = String(text || "").trim();

    if (!normalizedConversationId || !messageText) {
      return;
    }

    systemMessageSequenceRef.current += 1;
    const createdAt = new Date().toISOString();
    const systemMessage = normalizeMessage({
      id: `system-${eventType || "event"}-${normalizedConversationId}-${getSafeId(targetUserId) || "na"}-${systemMessageSequenceRef.current}`,
      conversationId: normalizedConversationId,
      text: messageText,
      type: "system",
      messageType: "system",
      createdAt,
      sender_id: null,
      sender: null,
      isSystemMessage: true
    });

    updateConversationWithNewMessage(systemMessage);

    const isActiveConversation =
      String(selectedConversationId || "") === normalizedConversationId;

    if (isActiveConversation) {
      shouldScrollToBottomRef.current = isNearBottom();
      appendMessageWithoutDuplicate(systemMessage);
    }
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    return (
      container.scrollHeight - container.scrollTop - container.clientHeight < 140
    );
  };

  const loadInitialMessages = async (conversationId) => {
    if (!conversationId || isVirtualConversationId(conversationId)) {
      setMessages([]);
      setMessagePageCursor(null);
      setHasMoreMessages(false);
      isLoadingOlderMessagesRef.current = false;
      return;
    }

    setIsInitialMessagesLoading(true);

    try {
      const [page, pollMessages] = await Promise.all([
        getMessagesPage(conversationId, { limit: MESSAGE_PAGE_SIZE }),
        loadConversationPollMessages(conversationId)
      ]);
      shouldScrollToBottomRef.current = true;
      setMessages(mergeTimelineItems(page.messages, pollMessages));
      setMessagePageCursor(page.nextCursor || null);
      setHasMoreMessages(Boolean(page.nextCursor));
      failedOlderMessagesCursorRef.current = null;
    } catch (error) {
      console.error("Failed to load messages:", error);
      setMessages([]);
      setMessagePageCursor(null);
      setHasMoreMessages(false);
      failedOlderMessagesCursorRef.current = null;
    } finally {
      setIsInitialMessagesLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (
      !selectedConversationId ||
      isVirtualConversationId(selectedConversationId) ||
      !hasMoreMessages ||
      isLoadingOlderMessagesRef.current ||
      !messagePageCursor ||
      failedOlderMessagesCursorRef.current === messagePageCursor
    ) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) return;

    pendingPrependScrollRef.current = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop
    };

    isLoadingOlderMessagesRef.current = true;
    setIsLoadingOlderMessages(true);
    shouldScrollToBottomRef.current = false;

    try {
      const previousCursor = messagePageCursor;
      const page = await getMessagesPage(selectedConversationId, {
        cursor: messagePageCursor,
        limit: MESSAGE_PAGE_SIZE
      });

      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const olderMessages = page.messages.filter((message) => !existingIds.has(message.id));
        return attachReplyPreviews([...olderMessages, ...prev]).sort(
          (firstMessage, secondMessage) =>
            new Date(firstMessage.createdAt || firstMessage.created_at || firstMessage.create_at || 0) -
            new Date(secondMessage.createdAt || secondMessage.created_at || secondMessage.create_at || 0)
        );
      });

      setMessagePageCursor(page.nextCursor || null);

      const hasOlderBatch = Array.isArray(page.messages) && page.messages.length > 0;
      const cursorMoved = page.nextCursor && page.nextCursor !== previousCursor;
      setHasMoreMessages(Boolean(page.nextCursor) && hasOlderBatch && cursorMoved);
      failedOlderMessagesCursorRef.current = null;
    } catch (error) {
      console.error("Failed to load older messages:", error);
      failedOlderMessagesCursorRef.current = messagePageCursor;
      setHasMoreMessages(false);
      pendingPrependScrollRef.current = null;
    } finally {
      isLoadingOlderMessagesRef.current = false;
      setIsLoadingOlderMessages(false);
    }
  };

  const handleMessageScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 40) {
      loadOlderMessages();
    }
  };

  const handleSelectConversation = async (conversationId) => {
    if (!conversationId) return;

    if (!isVirtualConversationId(conversationId)) {
      setSelectedConversationId(conversationId);
      setUnreadCountByConversationId((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      return;
    }

    const selectedVirtualConversation = conversations.find(
      (conversation) => conversation.id === conversationId
    );
    const friendId = selectedVirtualConversation?.friendId;

    if (!friendId) {
      console.error("Missing friend id for virtual conversation");
      return;
    }

    try {
      const createdConversation = await createPrivateConversation([friendId]);

      setConversations((prev) => {
        const filtered = prev.filter(
          (conversation) => conversation.id !== conversationId
        );
        return [createdConversation, ...filtered];
      });

      setSelectedConversationId(createdConversation.id);
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        delete next[createdConversation.id];
        return next;
      });
    } catch (error) {
      console.error("Failed to create private conversation:", error);
    }
  };

  const refreshConversationList = async ({ preferredConversationId = null } = {}) => {
    const [conversationData, friendData] = await Promise.all([
      getConversations(),
      getFriends()
    ]);

    setAllUsers(Array.isArray(friendData) ? friendData : []);

    const mergedConversations = mergeConversationsWithFriends(
      conversationData,
      friendData
    );

    const mergedWithLiveStatus = mergeConversationListPresence(
      mergedConversations,
      conversations
    );

    setConversations((prev) =>
      isConversationListEquivalent(prev, mergedWithLiveStatus)
        ? prev
        : mergedWithLiveStatus
    );

    const normalizedPreferredConversationId = getSafeId(preferredConversationId);

    setSelectedConversationId((prev) => {
      if (
        normalizedPreferredConversationId &&
        mergedWithLiveStatus.some(
          (conversation) => getSafeId(conversation.id) === normalizedPreferredConversationId
        )
      ) {
        return normalizedPreferredConversationId;
      }

      if (prev && mergedWithLiveStatus.some((conversation) => conversation.id === prev)) {
        return prev;
      }

      return mergedWithLiveStatus[0]?.id || null;
    });

    return mergedWithLiveStatus;
  };

  const openGroupModal = async () => {
    try {
      const friends = await getFriends();
      setAllUsers(friends);
      setGroupModalError("");
      setIsGroupModalOpen(true);
    } catch (error) {
      console.error("Failed to load friends:", error);
      setGroupModalError("Failed to load friends list.");
      setAllUsers([]);
      setIsGroupModalOpen(true);
    }
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setSelectedGroupMembers([]);
    setGroupName("");
    setGroupModalError("");
  };

  const openJoinByCodeModal = () => {
    setJoinByCodeInput("");
    setIsJoinByCodeModalOpen(true);
  };

  const closeJoinByCodeModal = (force = false) => {
    if (isJoiningByCode && !force) return;
    setIsJoinByCodeModalOpen(false);
    setJoinByCodeInput("");
  };

  const openAddMembersModal = async () => {
    if (!currentConversation?.isGroup) return;

    if (currentConversation?.id) {
      hydrateGroupConversationMembers(currentConversation.id);
    }

    setGroupInfoInitialAddMembersView(true);
    setShowGroupInfoModal(true);
  };

  const closeGroupJoinCodeModal = () => {
    if (isGeneratingJoinCode) return;
    setIsGroupJoinCodeModalOpen(false);
    setGeneratedJoinCode("");
  };

  const closeGroupInfoModal = () => {
    setGroupInfoInitialAddMembersView(false);
    setShowGroupInfoModal(false);
  };

  const closeActionDialog = () => {
    setDialogState(null);
  };

  const handleJoinByCodeInputChange = (rawValue) => {
    const normalizedValue = String(rawValue || "")
      .replace(/\s+/g, "")
      .toUpperCase();
    setJoinByCodeInput(normalizedValue);
  };

  const showAlertDialog = (message, options = {}) => {
    setDialogState({
      type: "alert",
      title: options.title || "Thông báo",
      message,
      tone: options.tone || "neutral",
      confirmLabel: options.confirmLabel || "Đã hiểu"
    });
  };

  const showConfirmDialog = ({ title, message, confirmLabel, cancelLabel, tone }) => {
    return new Promise((resolve) => {
      setDialogState({
        type: "confirm",
        title,
        message,
        tone: tone || "danger",
        confirmLabel: confirmLabel || "Xác nhận",
        cancelLabel: cancelLabel || "Hủy",
        onConfirm: () => {
          closeActionDialog();
          resolve(true);
        },
        onCancel: () => {
          closeActionDialog();
          resolve(false);
        }
      });
    });
  };

  const handleJoinGroupByCode = async () => {
    const normalizedCode = String(joinByCodeInput || "").trim().toUpperCase();

    if (!normalizedCode || isJoiningByCode) return;

    try {
      setIsJoiningByCode(true);
      const response = await joinGroupByCode(normalizedCode);
      const joinedConversationId = response?.conversationId || response?.conversation_id || null;

      closeJoinByCodeModal(true);
      await refreshConversationList({ preferredConversationId: joinedConversationId });

      if (joinedConversationId) {
        await hydrateGroupConversationMembers(joinedConversationId);
      }

      showAlertDialog("Tham gia nhóm thành công.", {
        title: "Thành công",
        tone: "success",
        confirmLabel: "Đã hiểu"
      });
    } catch (error) {
      showAlertDialog(getApiErrorMessage(error, "Không thể tham gia nhóm lúc này."), {
        title: "Không thể tham gia nhóm",
        tone: "danger"
      });
    } finally {
      setIsJoiningByCode(false);
    }
  };

  const handleGenerateGroupJoinCode = async () => {
    const conversationId = currentConversation?.id;

    if (!conversationId || isGeneratingJoinCode) return;

    try {
      setIsGeneratingJoinCode(true);
      setGeneratedJoinCode("");
      setIsGroupJoinCodeModalOpen(true);

      const response = await generateJoinCode(conversationId);
      setGeneratedJoinCode(String(response?.join_code || "").toUpperCase());
    } catch (error) {
      setIsGroupJoinCodeModalOpen(false);
      showAlertDialog(getApiErrorMessage(error, "Không thể tạo mã tham gia lúc này."), {
        title: "Không thể tạo mã",
        tone: "danger"
      });
    } finally {
      setIsGeneratingJoinCode(false);
    }
  };

  const handleCopyGroupJoinCode = async () => {
    if (!generatedJoinCode) return;

    try {
      await navigator.clipboard.writeText(generatedJoinCode);
      showAlertDialog("Đã sao chép mã tham gia nhóm.", {
        title: "Đã sao chép",
        tone: "success",
        confirmLabel: "Đóng"
      });
    } catch (error) {
      console.error("Failed to copy join code:", error);
      showAlertDialog("Không thể sao chép mã lúc này.", {
        title: "Sao chép thất bại",
        tone: "danger"
      });
    }
  };

  const toggleGroupMember = (userId) => {
    setGroupModalError("");
    setSelectedGroupMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleUpdateGroupInfo = async (name, avatarFile) => {
    if (!currentConversation?.id) return;
    setIsUpdatingGroup(true);
    try {
      const updated = await updateGroupInfo(currentConversation.id, { name, avatarFile });
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== currentConversation.id) return conv;
          return {
            ...conv,
            groupName: updated?.name ?? name ?? conv.groupName,
            groupAvatar: updated?.avatar_url ?? updated?.avatar ?? conv.groupAvatar
          };
        })
      );
    } catch (error) {
      console.error("Failed to update group info:", error);
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleAddMembersToGroup = async (userIds) => {
    if (!currentConversation?.id || !Array.isArray(userIds) || userIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      for (const uid of userIds) {
        await addMemberToGroup(currentConversation.id, uid);
      }
      await hydrateGroupConversationMembers(currentConversation.id);
      showAlertDialog("Đã thêm thành viên vào nhóm.", {
        title: "Thành công",
        tone: "success",
        confirmLabel: "Đã hiểu"
      });
    } catch (error) {
      console.error("Failed to add members:", error);
      showAlertDialog(getApiErrorMessage(error, "Không thể thêm thành viên lúc này."), {
        title: "Không thể thêm thành viên",
        tone: "danger"
      });
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoveMemberFromGroup = async (targetUserId) => {
    if (!currentConversation?.id || !targetUserId) return;
    try {
      await removeMemberFromGroup(currentConversation.id, targetUserId);
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== currentConversation.id) return conv;
          return {
            ...conv,
            members: (conv.members || []).filter(
              (m) => String(m.id || m.user_id) !== String(targetUserId)
            )
          };
        })
      );
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  const handleTransferGroupAdmin = async (targetUserId) => {
    const conversationId = currentConversation?.id;
    const currentAdminId = String(user?.id || "");
    const normalizedTargetUserId = String(targetUserId || "");

    if (!conversationId || !currentAdminId || !normalizedTargetUserId) return;

    const targetMember = (currentConversation?.members || []).find(
      (member) => String(getUserId(member) || "") === normalizedTargetUserId
    );
    const targetDisplayName = getUserDisplayName(targetMember);

    const isConfirmed = await showConfirmDialog({
      title: "Trao quyền admin",
      message: `Bạn có chắc muốn trao quyền admin cho ${targetDisplayName}?`,
      confirmLabel: "Trao quyền",
      cancelLabel: "Hủy",
      tone: "warning"
    });

    if (!isConfirmed) return;

    setIsTransferringAdmin(true);

    try {
      setConversations((prev) =>
        prev.map((conversation) =>
          String(conversation.id) === String(conversationId)
            ? applyTransferredAdminState(
                conversation,
                currentAdminId,
                normalizedTargetUserId
              )
            : conversation
        )
      );
      await transferAdminRole(conversationId, normalizedTargetUserId);
      await hydrateGroupConversationMembers(conversationId);
    } catch (error) {
      await hydrateGroupConversationMembers(conversationId);
      showAlertDialog(getApiErrorMessage(error, "Could not transfer admin role right now."), {
        title: "Transfer failed",
        tone: "danger"
      });
    } finally {
      setIsTransferringAdmin(false);
    }
  };
  const handleLeaveGroup = async () => {
    const conversationId = currentConversation?.id;
    const currentUserId = user?.id;

    if (!conversationId || !currentUserId) return;

    const adminId = getUserId(currentConversation?.groupAdmin);
    const hasConversationAdmin = Boolean(adminId);
    const isCurrentUserAdminByConversation =
      hasConversationAdmin && String(adminId) === String(currentUserId);
    const currentMember = (currentConversation?.members || []).find(
      (member) => String(getUserId(member)) === String(currentUserId)
    );
    const isCurrentUserAdminByRole =
      String(currentMember?.role || "").toLowerCase() === "admin";

    if (
      isCurrentUserAdminByConversation ||
      (!hasConversationAdmin && isCurrentUserAdminByRole)
    ) {
      showAlertDialog("Bạn đang là admin. Hãy chuyển quyền admin trước khi rời nhóm.", {
        title: "Không thể rời nhóm",
        tone: "warning"
      });
      return;
    }

    const isConfirmed = await showConfirmDialog({
      title: "Rời nhóm",
      message: "Bạn có chắc muốn rời nhóm này?",
      confirmLabel: "Rời nhóm",
      cancelLabel: "Hủy",
      tone: "warning"
    });
    if (!isConfirmed) return;

    setIsLeavingGroup(true);

    try {
      await leaveGroupConversation(conversationId, currentUserId);
      setShowGroupInfoModal(false);
      setConversations((prev) =>
        prev.filter((conv) => String(conv.id) !== String(conversationId))
      );
      setSelectedConversationId((prev) =>
        String(prev) === String(conversationId) ? null : prev
      );
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    } catch (error) {
      showAlertDialog(getApiErrorMessage(error, "Không thể rời nhóm lúc này."), {
        title: "Không thể rời nhóm",
        tone: "danger"
      });
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const handleDissolveGroup = async () => {
    const conversationId = currentConversation?.id;
    const currentUserId = user?.id;

    if (!conversationId || !currentUserId) return;

    const adminId = getUserId(currentConversation?.groupAdmin);
    const hasConversationAdmin = Boolean(adminId);
    const isCurrentUserAdminByConversation =
      hasConversationAdmin && String(adminId) === String(currentUserId);
    const currentMember = (currentConversation?.members || []).find(
      (member) => String(getUserId(member)) === String(currentUserId)
    );
    const isCurrentUserAdminByRole =
      String(currentMember?.role || "").toLowerCase() === "admin";

    const isCurrentUserAdmin =
      isCurrentUserAdminByConversation ||
      (!hasConversationAdmin && isCurrentUserAdminByRole);

    if (!isCurrentUserAdmin) {
      showAlertDialog("Chỉ admin mới có quyền giải tán nhóm.", {
        title: "Không có quyền",
        tone: "warning"
      });
      return;
    }

    const isConfirmed = await showConfirmDialog({
      title: "Giải tán nhóm",
      message: "Bạn có chắc muốn giải tán nhóm này? Hành động này không thể hoàn tác.",
      confirmLabel: "Giải tán",
      cancelLabel: "Hủy",
      tone: "danger"
    });

    if (!isConfirmed) return;

    setIsDissolvingGroup(true);

    try {
      await deleteGroupConversation(conversationId);
      setShowGroupInfoModal(false);
      setConversations((prev) =>
        prev.filter((conv) => String(conv.id) !== String(conversationId))
      );
      setSelectedConversationId((prev) =>
        String(prev) === String(conversationId) ? null : prev
      );
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    } catch (error) {
      showAlertDialog(getApiErrorMessage(error, "Không thể giải tán nhóm lúc này."), {
        title: "Không thể giải tán nhóm",
        tone: "danger"
      });
    } finally {
      setIsDissolvingGroup(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setGroupModalError("Please enter a group name.");
      return;
    }

    if (selectedGroupMembers.length < 2) {
      setGroupModalError("Please select at least 2 friends to create a group.");
      return;
    }

    try {
      setIsCreatingGroup(true);
      setGroupModalError("");

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
      setGroupModalError(
        getApiErrorMessage(error, "Failed to create group conversation.")
      );
    } finally {
      setIsCreatingGroup(false);
    }
  };

  useEffect(() => {
    connectSocketWithToken();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    socketClient.emit("user_online", user.id);
  }, [socketClient, user?.id]);

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

    socketClient.on("new_conversation", handleNewConversation);

    return () => {
      socketClient.off("new_conversation", handleNewConversation);
    };
  }, [socketClient]);

  useEffect(() => {
    writeHomeConversationsCache({ conversations, selectedConversationId });
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        await refreshConversationList();
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (!showGroupInfoModal || !currentConversation?.isGroup) return;

    const refreshGroupInfoContext = async () => {
      try {
        const [friends] = await Promise.all([
          Array.isArray(allUsers) && allUsers.length > 0
            ? Promise.resolve(allUsers)
            : getFriends(),
          currentConversation?.id
            ? hydrateGroupConversationMembers(currentConversation.id)
            : Promise.resolve()
        ]);
        setAllUsers(Array.isArray(friends) ? friends : []);
      } catch (error) {
        console.error("Failed to refresh friends for add-members:", error);
      }
    };

    refreshGroupInfoContext();
  }, [showGroupInfoModal, currentConversation?.id, currentConversation?.isGroup, allUsers]);

  useEffect(() => {
    const nextConversationIds = new Set(
      (Array.isArray(conversations) ? conversations : [])
        .map((conversation) => getSafeId(conversation?.id))
        .filter((conversationId) => conversationId && !isVirtualConversationId(conversationId))
    );

    nextConversationIds.forEach((conversationId) => {
      if (joinedConversationIdsRef.current.has(conversationId)) {
        return;
      }

      socketClient.emit("join_conversation", conversationId);
      joinedConversationIdsRef.current.add(conversationId);
    });

    joinedConversationIdsRef.current.forEach((conversationId) => {
      if (nextConversationIds.has(conversationId)) {
        return;
      }

      socketClient.emit("leave_conversation", conversationId);
      joinedConversationIdsRef.current.delete(conversationId);
    });
  }, [conversations, socketClient]);

  useEffect(() => {
    const rejoinConversationRooms = () => {
      joinedConversationIdsRef.current.forEach((conversationId) => {
        socketClient.emit("join_conversation", conversationId);
      });
    };

    socketClient.on("connect", rejoinConversationRooms);

    return () => {
      socketClient.off("connect", rejoinConversationRooms);
    };
  }, [socketClient]);

  useEffect(() => {
    return () => {
      const joinedConversationIds = Array.from(joinedConversationIdsRef.current);

      joinedConversationIds.forEach((conversationId) => {
        socketClient.emit("leave_conversation", conversationId);
      });
      joinedConversationIdsRef.current.clear();
    };
  }, [socketClient]);

  useEffect(() => {
    const selected = conversations.find(
      (conversation) => conversation.id === selectedConversationId
    );
    setCurrentConversation(selected || null);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const selected = conversations.find(
      (conversation) => conversation.id === selectedConversationId
    );

    if (!selected?.isGroup || !selected?.id || (selected.members?.length ?? 0) > 0) {
      return;
    }

    hydrateGroupConversationMembers(selected.id);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    setMessages([]);
    setMessagePageCursor(null);
    setHasMoreMessages(true);
    failedOlderMessagesCursorRef.current = null;
    setIsLoadingOlderMessages(false);
    isLoadingOlderMessagesRef.current = false;
    loadInitialMessages(selectedConversationId);
  }, [selectedConversationId]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (pendingPrependScrollRef.current) {
      const { scrollHeight, scrollTop } = pendingPrependScrollRef.current;
      const nextScrollHeight = container.scrollHeight;
      container.scrollTop = scrollTop + (nextScrollHeight - scrollHeight);
      pendingPrependScrollRef.current = null;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
      shouldScrollToBottomRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const handleReceiveMessage = (message) => {
      const normalizedMessage = normalizeMessage({
        ...message,
        id: getEntityId(message)
      });

      const isActiveConversationScrollTarget = isNearBottom();

      updateConversationWithNewMessage(normalizedMessage);

      const normalizedConversationId = String(
        normalizedMessage.conversationId || ""
      );
      const activeConversationId = String(
        currentConversation?.id || selectedConversationId || ""
      );
      const activeFriendId = String(currentConversation?.friendId || "");
      const messageSenderId = String(
        normalizedMessage.sender_id || getUserId(normalizedMessage.sender) || ""
      );

      const isActiveConversationMatch =
        activeConversationId && !isVirtualConversationId(activeConversationId)
          ? normalizedConversationId
            ? normalizedConversationId === activeConversationId
            : activeConversationId === String(selectedConversationId || "")
          : normalizedConversationId && activeConversationId
            ? normalizedConversationId === activeConversationId
          : false;

      const isActiveVirtualDirectMatch =
        isVirtualConversationId(selectedConversationId) &&
        !currentConversation?.isGroup &&
        activeFriendId &&
        messageSenderId &&
        activeFriendId === messageSenderId;

      if (isActiveConversationMatch || isActiveVirtualDirectMatch) {
        shouldScrollToBottomRef.current = isActiveConversationScrollTarget;
        appendMessageWithoutDuplicate(normalizedMessage);
        return;
      }

      const normalizedUserId = getSafeId(user?.id);
      if (
        normalizedConversationId &&
        messageSenderId &&
        normalizedUserId &&
        messageSenderId !== normalizedUserId
      ) {
        setUnreadCountByConversationId((prev) => ({
          ...prev,
          [normalizedConversationId]: (prev[normalizedConversationId] || 0) + 1
        }));
      }
    };

    const handleReceiveMessageBatch = (messagesBatch) => {
      if (!Array.isArray(messagesBatch) || messagesBatch.length === 0) return;

      messagesBatch.forEach((message) => {
        handleReceiveMessage(message);
      });
    };

    const handleDeleteMessage = (payload) => {
      const deletedMessageId =
        payload?.messageId || payload?.message_id || payload?.id;

      if (!deletedMessageId) return;

      removeMessagesByIds([deletedMessageId]);
    };

    const handleMessageRecalled = (payload) => {
      const recalledMessageId =
        payload?.messageId || payload?.message_id || payload?.id;

      if (!recalledMessageId) return;

      markMessagesAsRecalled([recalledMessageId]);
    };

    const handleNewPollCreated = async (payload) => {
      const pollConversationId = String(payload?.conversationId || payload?.conversation_id || "");
      const pollId = payload?.pollId || payload?.poll_id;
      const question = String(payload?.question || "").trim();

      if (!pollConversationId || !pollId || !question) {
        return;
      }

      let pollMessage = buildPollMessage({
        pollId,
        conversationId: pollConversationId,
        question,
        options: Array.isArray(payload?.options) ? payload.options : [],
        creator: payload?.creator || payload?.sender || null,
        createdAt: payload?.createdAt || payload?.created_at || new Date().toISOString()
      });

      if (!Array.isArray(payload?.options) || payload.options.length === 0) {
        const pollMessages = await loadConversationPollMessages(pollConversationId);
        const matchedPollMessage = pollMessages.find(
          (message) => getSafeId(message?.poll?.pollId) === getSafeId(pollId)
        );

        if (matchedPollMessage) {
          pollMessage = matchedPollMessage;
        }
      }

      updateConversationWithNewMessage(pollMessage);

      if (pollConversationId === String(currentConversation?.id || selectedConversationId || "")) {
        shouldScrollToBottomRef.current = isNearBottom();
        appendMessageWithoutDuplicate(pollMessage);
      }
    };

    const handlePollVotedUpdated = async (payload) => {
      const pollId = getSafeId(payload?.pollId || payload?.poll_id);
      const activeConversationId = getSafeId(
        currentConversation?.id || selectedConversationId
      );
      const hasMatchingPollInView = messagesRef.current.some(
        (message) => getSafeId(message?.poll?.pollId) === pollId
      );

      if (!pollId || !activeConversationId || !hasMatchingPollInView) {
        return;
      }

      const updatedPollMessage = await syncSinglePollMessage(activeConversationId, pollId);
      if (updatedPollMessage) {
        replacePollMessageInState(updatedPollMessage);
      }
    };

    socketClient.on("receive_message", handleReceiveMessage);
    socketClient.on("new_message", handleReceiveMessage);
    socketClient.on("new_messages_batch", handleReceiveMessageBatch);
    socketClient.on("delete message", handleDeleteMessage);
    socketClient.on("message_recalled", handleMessageRecalled);
    socketClient.on("new_poll_created", handleNewPollCreated);
    socketClient.on("poll_voted_updated", handlePollVotedUpdated);

    return () => {
      socketClient.off("receive_message", handleReceiveMessage);
      socketClient.off("new_message", handleReceiveMessage);
      socketClient.off("new_messages_batch", handleReceiveMessageBatch);
      socketClient.off("delete message", handleDeleteMessage);
      socketClient.off("message_recalled", handleMessageRecalled);
      socketClient.off("new_poll_created", handleNewPollCreated);
      socketClient.off("poll_voted_updated", handlePollVotedUpdated);
    };
  }, [currentConversation, selectedConversationId, socketClient, user?.id]);

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

    socketClient.on("user_status", handleUserStatus);

    return () => {
      socketClient.off("user_status", handleUserStatus);
    };
  }, [socketClient]);

  useEffect(() => {
    const handleConversationPinned = (payload) => {
      const conversationId = getSafeId(payload?.conversationId || payload?.conversation_id);
      if (!conversationId) return;

      const isPinned = Boolean(payload?.isPinned ?? payload?.is_pinned);
      const pinnedAt = payload?.pinnedAt || payload?.pinned_at || null;

      setConversations((prev) =>
        applyConversationPinState(prev, conversationId, isPinned, pinnedAt)
      );
    };

    socketClient.on("conversation_pinned", handleConversationPinned);

    return () => {
      socketClient.off("conversation_pinned", handleConversationPinned);
    };
  }, [socketClient]);

  // Group event listeners
  useEffect(() => {
    if (!socketClient) return;

    const handleGroupUpdated = (updatedGroup) => {
      if (!updatedGroup?.conversation_id && !updatedGroup?.id) return;
      const convId = updatedGroup.conversation_id || updatedGroup.id;
      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== String(convId)) return conv;
          return {
            ...conv,
            groupName: updatedGroup.name ?? conv.groupName,
            groupAvatar: updatedGroup.avatar_url ?? updatedGroup.avatar ?? conv.groupAvatar
          };
        })
      );
    };

    const handleNewMemberJoined = ({ conversation_id, userId: joinedUserId }) => {
      if (!conversation_id) return;
      hydrateGroupConversationMembers(conversation_id);

      const memberName = getGroupParticipantDisplayName(
        joinedUserId,
        conversation_id
      );

      appendGroupSystemMessage({
        conversationId: conversation_id,
        targetUserId: joinedUserId,
        eventType: "member-joined",
        text: `${memberName} da duoc them vao nhom`
      });
    };

    const handleMemberLeft = ({
      conversation_id,
      userId: leftUserId,
      isKicked
    }) => {
      if (!conversation_id) return;

      const memberName = getGroupParticipantDisplayName(
        leftUserId,
        conversation_id
      );

      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== String(conversation_id)) return conv;
          return {
            ...conv,
            members: (conv.members || []).filter(
              (m) => String(m.id || m.user_id) !== String(leftUserId)
            )
          };
        })
      );

      appendGroupSystemMessage({
        conversationId: conversation_id,
        targetUserId: leftUserId,
        eventType: isKicked ? "member-kicked" : "member-left",
        text: isKicked
          ? `${memberName} da bi moi khoi nhom`
          : `${memberName} da roi nhom`
      });
    };

    const handleYouAreKicked = ({ conversation_id }) => {
      setShowGroupInfoModal(false);
      setConversations((prev) => prev.filter((conv) => String(conv.id) !== String(conversation_id)));
      if (String(selectedConversationId) === String(conversation_id)) {
        setSelectedConversationId(null);
      }
    };

    const handleAddedToGroup = (payload) => {
      const convId = payload?.conversation_id || payload?.id;
      if (!convId) return;
      hydrateGroupConversationMembers(convId);
    };

    const handleGroupDissolved = ({ conversation_id }) => {
      if (!conversation_id) return;

      setShowGroupInfoModal(false);
      setConversations((prev) =>
        prev.filter((conv) => String(conv.id) !== String(conversation_id))
      );
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversation_id];
        return next;
      });

      setSelectedConversationId((prev) =>
        String(prev) === String(conversation_id) ? null : prev
      );
    };

    const handleAdminTransferred = (payload) => {
      const conversationId = payload?.conversationId || payload?.conversation_id;
      const oldAdminId = payload?.oldAdminId || payload?.old_admin_id;
      const newAdminId = payload?.newAdminId || payload?.new_admin_id;

      if (!conversationId || !newAdminId) return;

      setConversations((prev) =>
        prev.map((conv) =>
          String(conv.id) === String(conversationId)
            ? applyTransferredAdminState(conv, oldAdminId, newAdminId)
            : conv
        )
      );

      hydrateGroupConversationMembers(conversationId);
    };

    socketClient.on("group_updated", handleGroupUpdated);
    socketClient.on("new_member_joined", handleNewMemberJoined);
    socketClient.on("member_left", handleMemberLeft);
    socketClient.on("you_are_kicked", handleYouAreKicked);
    socketClient.on("added_to_group", handleAddedToGroup);
    socketClient.on("group_dissolved", handleGroupDissolved);
    socketClient.on("admin_transferred", handleAdminTransferred);

    return () => {
      socketClient.off("group_updated", handleGroupUpdated);
      socketClient.off("new_member_joined", handleNewMemberJoined);
      socketClient.off("member_left", handleMemberLeft);
      socketClient.off("you_are_kicked", handleYouAreKicked);
      socketClient.off("added_to_group", handleAddedToGroup);
      socketClient.off("group_dissolved", handleGroupDissolved);
      socketClient.off("admin_transferred", handleAdminTransferred);
    };
  }, [
    allUsers,
    conversations,
    selectedConversationId,
    socketClient,
    user?.id
  ]);

  useEffect(() => {
    setGroupInfoInitialAddMembersView(false);
    setShowGroupInfoModal(false);
  }, [selectedConversationId]);

  useEffect(() => {
    setReplyTarget(null);
  }, [selectedConversationId]);

  useEffect(() => {
    clearReplyHighlight();

    return () => {
      clearReplyHighlight();
    };
  }, [selectedConversationId]);

  useEffect(() => {
    return () => {
      if (pinToastTimeoutRef.current) {
        window.clearTimeout(pinToastTimeoutRef.current);
        pinToastTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = async (payload = {}) => {
    const messageText = String(payload?.text ?? newMessage ?? "").trim();
    const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
    const onUploadProgress = payload?.onUploadProgress;
    const activeReplyTarget = replyTarget;

    if (!messageText && attachments.length === 0) return;

    const targetConversationId = await resolveConversationTarget();
    if (!targetConversationId) return;

    shouldScrollToBottomRef.current = true;

    try {
      const files = attachments
        .map((attachment) => attachment?.file)
        .filter(Boolean);

      const hasFiles = files.length > 0;
      const hasVoiceAttachment = attachments.some(
        (attachment) => attachment?.kind === "voice"
      );
      const hasNonVoiceAttachment = attachments.some(
        (attachment) => attachment?.kind !== "voice"
      );

      if (hasVoiceAttachment && hasNonVoiceAttachment) {
        showAlertDialog("Chua ho tro gui cung luc voice voi file/anh. Vui long gui rieng.", {
          title: "Không hỗ trợ",
          tone: "warning"
        });
        return;
      }

      const messageType = hasFiles
        ? hasVoiceAttachment
          ? "audio"
          : attachments.every((attachment) => attachment?.kind === "image")
          ? "image"
          : "file"
        : "text";

      const sentPayload = await sendMessage({
        conversationId: targetConversationId,
        text: messageText,
        files: hasFiles ? files : undefined,
        messageType,
        onUploadProgress,
        parent_id: activeReplyTarget?.id || undefined
      });

      const sentMessages = Array.isArray(sentPayload) ? sentPayload : [sentPayload];
      const replyPreview = activeReplyTarget ? { ...activeReplyTarget } : null;

      sentMessages.filter(Boolean).forEach((message) => {
        appendMessageWithoutDuplicate(
          replyPreview ? { ...message, replyPreview } : message
        );
      });

      const latestMessage = sentMessages[sentMessages.length - 1];
      if (latestMessage) {
        updateConversationWithNewMessage(latestMessage);
      }

      setNewMessage("");
      setReplyTarget(null);
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  };

  const handleCreatePoll = async ({ question, options }) => {
    const conversationId = currentConversation?.id || selectedConversationId;
    const normalizedQuestion = String(question || "").trim();
    const normalizedOptions = Array.isArray(options)
      ? options.map((option) => String(option || "").trim()).filter(Boolean)
      : [];

    if (!conversationId || !currentConversation?.isGroup) {
      return false;
    }

    if (!normalizedQuestion || normalizedOptions.length < 2) {
      return false;
    }

    try {
      setIsCreatingPoll(true);

      const response = await createPollApi({
        conversationId,
        question: normalizedQuestion,
        options: normalizedOptions
      });

      const pollId = response?.pollId || response?.poll_id;
      if (!pollId) {
        throw new Error("Missing poll id");
      }

      let pollMessage = buildPollMessage({
        pollId,
        conversationId,
        question: normalizedQuestion,
        options: normalizedOptions
      });

      const pollMessages = await loadConversationPollMessages(conversationId);
      const matchedPollMessage = pollMessages.find(
        (message) => getSafeId(message?.poll?.pollId) === getSafeId(pollId)
      );

      if (matchedPollMessage) {
        pollMessage = matchedPollMessage;
      }

      shouldScrollToBottomRef.current = true;
      appendMessageWithoutDuplicate(pollMessage);
      updateConversationWithNewMessage(pollMessage);
      return true;
    } catch (error) {
      console.error("Failed to create poll:", error);
      showAlertDialog(getApiErrorMessage(error, "Không thể tạo poll lúc này."), {
        title: "Không thể tạo poll",
        tone: "danger"
      });
      return false;
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleVotePoll = async (pollId, optionId) => {
    const conversationId = currentConversation?.id || selectedConversationId;

    if (!conversationId || !pollId || !optionId || votingPollId) {
      return;
    }

    try {
      setVotingPollId(String(pollId));
      await votePollOptionApi({ pollId, optionId });

      const updatedPollMessage = await syncSinglePollMessage(conversationId, pollId);
      if (updatedPollMessage) {
        replacePollMessageInState(updatedPollMessage);
      }
    } catch (error) {
      console.error("Failed to vote poll:", error);
      showAlertDialog(getApiErrorMessage(error, "Không thể bình chọn lúc này."), {
        title: "Không thể bình chọn",
        tone: "danger"
      });
    } finally {
      setVotingPollId("");
    }
  };

  const handleRecallMessage = async (message) => {
    const messageId = getEntityId(message);
    if (!messageId) return;

    const isConfirmed = await showConfirmDialog({
      title: "Thu hồi tin nhắn",
      message: "Thu hồi tin nhắn này?",
      confirmLabel: "Thu hồi",
      cancelLabel: "Hủy",
      tone: "warning"
    });
    if (!isConfirmed) return;

    try {
      await recallMessageApi(messageId);
      markMessagesAsRecalled([messageId]);
    } catch (error) {
      console.error("Failed to recall message:", error);
      showAlertDialog(getApiErrorMessage(error, "Không thể thu hồi tin nhắn lúc này."), {
        title: "Không thể thu hồi",
        tone: "danger"
      });
    }
  };

  const handleRecallMessageGroup = async (message) => {
    const groupedItems = Array.isArray(message?.groupedItems)
      ? message.groupedItems
      : [];
    const targets = groupedItems.length > 0 ? groupedItems : [message];
    const targetIds = targets
      .map((item) => getEntityId(item))
      .filter(Boolean);

    if (targetIds.length === 0) return;

    const isConfirmed = await showConfirmDialog({
      title: "Thu hồi nhiều tin nhắn",
      message: `Thu hồi ${targetIds.length} tin nhắn này?`,
      confirmLabel: "Thu hồi",
      cancelLabel: "Hủy",
      tone: "warning"
    });
    if (!isConfirmed) return;

    try {
      const results = await Promise.allSettled(
        targetIds.map((id) => recallMessageApi(id))
      );

      const succeededIds = targetIds.filter(
        (_, index) => results[index]?.status === "fulfilled"
      );

      if (succeededIds.length > 0) {
        markMessagesAsRecalled(succeededIds);
      }

      if (succeededIds.length !== targetIds.length) {
        showAlertDialog("Một số tin nhắn chưa thu hồi được.", {
          title: "Thông báo",
          tone: "warning"
        });
      }
    } catch (error) {
      console.error("Failed to recall grouped messages:", error);
      showAlertDialog(getApiErrorMessage(error, "Không thể thu hồi các tin nhắn này."), {
        title: "Không thể thu hồi",
        tone: "danger"
      });
    }
  };

  const handleDeleteMessage = async (message) => {
    const messageId = getEntityId(message);
    if (!messageId) return;

    const isConfirmed = await showConfirmDialog({
      title: "Xóa tin nhắn",
      message: "Xóa tin nhắn này khỏi phía bạn?",
      confirmLabel: "Xóa",
      cancelLabel: "Hủy",
      tone: "danger"
    });
    if (!isConfirmed) return;

    try {
      await deleteMessageApi(messageId);
      removeMessagesByIds([messageId]);
    } catch (error) {
      console.error("Failed to delete message:", error);
      showAlertDialog(getApiErrorMessage(error, "Không thể xóa tin nhắn này lúc này."), {
        title: "Không thể xóa",
        tone: "danger"
      });
    }
  };

  const handleDeleteMessageGroup = async (message) => {
    const groupedItems = Array.isArray(message?.groupedItems)
      ? message.groupedItems
      : [];
    const targets = groupedItems.length > 0 ? groupedItems : [message];
    const targetIds = targets
      .map((item) => getEntityId(item))
      .filter(Boolean);

    if (targetIds.length === 0) return;

    const isConfirmed = await showConfirmDialog({
      title: "Xóa nhiều tin nhắn",
      message: `Xóa ${targetIds.length} tin nhắn này khỏi phía bạn?`,
      confirmLabel: "Xóa",
      cancelLabel: "Hủy",
      tone: "danger"
    });
    if (!isConfirmed) return;

    try {
      const results = await Promise.allSettled(
        targetIds.map((id) => deleteMessageApi(id))
      );

      const succeededIds = targetIds.filter(
        (_, index) => results[index]?.status === "fulfilled"
      );

      if (succeededIds.length > 0) {
        removeMessagesByIds(succeededIds);
      }

      if (succeededIds.length !== targetIds.length) {
        showAlertDialog("Một số tin nhắn chưa xóa được.", {
          title: "Thông báo",
          tone: "warning"
        });
      }
    } catch (error) {
      console.error("Failed to delete grouped messages:", error);
      showAlertDialog(getApiErrorMessage(error, "Không thể xóa các tin nhắn này lúc này."), {
        title: "Không thể xóa",
        tone: "danger"
      });
    }
  };

  const selectedOtherMember =
    currentConversation?.members?.find(
      (member) => getUserId(member) && getUserId(member) !== user?.id
    ) || currentConversation?.members?.[0];

  const selectedConversationDisplayName = currentConversation
    ? currentConversation.isGroup
      ? currentConversation.groupName || "Unnamed Group"
      : getUserDisplayName(selectedOtherMember)
    : "No conversation selected";

  const selectedGroupMembersList = currentConversation?.isGroup
    ? currentConversation.members || []
    : [];

  const selectedGroupMemberCount = selectedGroupMembersList.length;

  const availableFriendsToAdd = currentConversation?.isGroup
    ? (allUsers || []).filter((friend) => {
        const friendId = String(getUserId(friend) || "");
        return (
          friendId &&
          !selectedGroupMembersList.some(
            (m) => String(getUserId(m) || "") === friendId
          )
        );
      })
    : [];

  const filteredConversations = sortConversationsByPinAndActivity(conversations)
    .filter((conversation) =>
      getConversationDisplayName(conversation)
        .toLowerCase()
        .includes(searchTerm.toLowerCase().trim())
    );

  const forwardEligibleConversations = sortConversationsByPinAndActivity(conversations)
    .filter((conversation) => getSafeId(conversation?.id))
    .filter(
      (conversation, index, self) =>
        index === self.findIndex((item) => getSafeId(item?.id) === getSafeId(conversation?.id))
    );

  const sidebarAvatar = getAvatarUrl(user);
  const headerAvatar = currentConversation
    ? getConversationAvatar(currentConversation)
    : getAvatarUrl(user);

  const getMessageSenderAvatar = (message) => {
    const directSender = message?.sender;
    if (directSender && typeof directSender === "object") {
      return getAvatarUrl(directSender, MESSAGE_SENDER_AVATAR_URL);
    }

    const senderId = getSafeId(message?.sender_id || getUserId(directSender));
    if (!senderId) {
      return MESSAGE_SENDER_AVATAR_URL;
    }

    const members = Array.isArray(currentConversation?.members)
      ? currentConversation.members
      : [];

    const matchedMember = members.find(
      (member) => getSafeId(getUserId(member)) === senderId
    );

    if (matchedMember) {
      return getAvatarUrl(matchedMember, MESSAGE_SENDER_AVATAR_URL);
    }

    if (getSafeId(user?.id) === senderId) {
      return getAvatarUrl(user, MESSAGE_SENDER_AVATAR_URL);
    }

    return MESSAGE_SENDER_AVATAR_URL;
  };

  const getMessageSenderName = (message) => {
    const directSender = message?.sender;
    if (directSender && typeof directSender === "object") {
      return getUserDisplayName(directSender);
    }

    const senderId = getSafeId(message?.sender_id || getUserId(directSender));
    if (!senderId) {
      return "Unknown";
    }

    if (getSafeId(user?.id) === senderId) {
      return user?.name || "You";
    }

    const members = Array.isArray(currentConversation?.members)
      ? currentConversation.members
      : [];

    const matchedMember = members.find(
      (member) => getSafeId(getUserId(member)) === senderId
    );

    return matchedMember ? getUserDisplayName(matchedMember) : "Unknown";
  };

  const getMessageType = (message) =>
    message?.messageType ||
    message?.message_type ||
    message?.type ||
    (message?.fileUrl || message?.file_url ? "file" : "text");

  const resolvePollCreatorFromEntity = (pollEntity) => {
    const creatorId = getSafeId(pollEntity?.creator_id || pollEntity?.creatorId);
    const creatorName = normalizeComparableText(
      pollEntity?.creator_name || pollEntity?.creatorName
    );
    const creatorAvatar = String(
      pollEntity?.creator_avatar || pollEntity?.creatorAvatar || ""
    ).trim();
    const conversationId = getSafeId(
      pollEntity?.conversation_id || pollEntity?.conversationId || selectedConversationId
    );
    const conversationContext =
      conversations.find(
        (conversation) => getSafeId(conversation?.id) === conversationId
      ) || currentConversation;
    const candidateMembers = [
      user,
      ...(Array.isArray(conversationContext?.members)
        ? conversationContext.members
        : [])
    ]
      .filter(Boolean)
      .map((member) => normalizeUserEntity(member));

    if (creatorId) {
      const matchedById = candidateMembers.find(
        (member) => getSafeId(getUserId(member)) === creatorId
      );

      if (matchedById) {
        return matchedById;
      }
    }

    const matchedByNameAndAvatar = candidateMembers.find((member) => {
      const memberName = normalizeComparableText(
        member?.username || member?.name
      );
      const memberAvatar = getAvatarUrl(member, "").trim();

      return (
        creatorName &&
        creatorAvatar &&
        memberName === creatorName &&
        memberAvatar === creatorAvatar
      );
    });

    if (matchedByNameAndAvatar) {
      return matchedByNameAndAvatar;
    }

    const matchedByName = candidateMembers.find((member) => {
      const memberName = normalizeComparableText(
        member?.username || member?.name
      );
      return creatorName && memberName === creatorName;
    });

    if (matchedByName) {
      return matchedByName;
    }

    const matchedByAvatar = candidateMembers.find((member) => {
      const memberAvatar = getAvatarUrl(member, "").trim();
      return creatorAvatar && memberAvatar === creatorAvatar;
    });

    if (matchedByAvatar) {
      return matchedByAvatar;
    }

    return {
      id: null,
      user_id: null,
      username: pollEntity?.creator_name || pollEntity?.creatorName || "",
      name: pollEntity?.creator_name || pollEntity?.creatorName || "",
      avatar: pollEntity?.creator_avatar || pollEntity?.creatorAvatar || ""
    };
  };

  const buildPollMessage = ({
    pollId,
    conversationId,
    question,
    options,
    creator = user,
    createdAt = new Date().toISOString()
  }) =>
    normalizeMessage({
      id: `poll-${pollId}`,
      conversationId,
      text: String(question || "").trim(),
      content: String(question || "").trim(),
      type: "poll",
      messageType: "poll",
      createdAt,
      sender: creator,
      sender_id: getUserId(creator),
      poll: {
        pollId,
        question: String(question || "").trim(),
        options: Array.isArray(options)
          ? options.map((option) =>
              typeof option === "string"
                ? option
                : {
                    ...option,
                    option_id: option?.option_id || option?.id || null,
                    option_text: option?.option_text || option?.text || "",
                    vote_count: Number(option?.vote_count || 0),
                    is_voted_by_me: Boolean(option?.is_voted_by_me)
                  }
            )
          : []
      }
    });

  const buildPollMessageFromEntity = (pollEntity) =>
    buildPollMessage({
      pollId: pollEntity?.poll_id || pollEntity?.pollId,
      conversationId: pollEntity?.conversation_id || pollEntity?.conversationId || selectedConversationId,
      question: pollEntity?.question,
      options: Array.isArray(pollEntity?.options) ? pollEntity.options : [],
      creator: resolvePollCreatorFromEntity(pollEntity),
      createdAt: pollEntity?.created_at || pollEntity?.createdAt || new Date().toISOString()
    });

  const mergeTimelineItems = (...itemGroups) => {
    const merged = new Map();

    itemGroups.flat().filter(Boolean).forEach((item) => {
      merged.set(getSafeId(getEntityId(item)), item);
    });

    return attachReplyPreviews(
      [...merged.values()].sort(
        (firstItem, secondItem) =>
          new Date(firstItem?.createdAt || firstItem?.created_at || firstItem?.create_at || 0) -
          new Date(secondItem?.createdAt || secondItem?.created_at || secondItem?.create_at || 0)
      )
    );
  };

  const loadConversationPollMessages = async (conversationId) => {
    if (!conversationId || isVirtualConversationId(conversationId)) {
      return [];
    }

    try {
      const polls = await getPollsApi(conversationId);
      return polls.map(buildPollMessageFromEntity);
    } catch (error) {
      console.error("Failed to load polls:", error);
      return [];
    }
  };

  const replacePollMessageInState = (pollMessage) => {
    const targetPollId = getSafeId(pollMessage?.poll?.pollId);
    if (!targetPollId) return;

    setMessages((prev) =>
      mergeTimelineItems(
        prev.map((message) =>
          getSafeId(message?.poll?.pollId) === targetPollId
            ? normalizeMessage({
                ...pollMessage,
                sender: pollMessage?.sender || message?.sender || null,
                sender_id:
                  pollMessage?.sender_id ||
                  getUserId(pollMessage?.sender) ||
                  message?.sender_id ||
                  getUserId(message?.sender) ||
                  null
              })
            : message
        )
      )
    );
  };

  const syncSinglePollMessage = async (conversationId, pollId) => {
    const pollMessages = await loadConversationPollMessages(conversationId);
    return pollMessages.find(
      (message) => getSafeId(message?.poll?.pollId) === getSafeId(pollId)
    ) || null;
  };

  const getReplyPreviewContent = (message) => {
    if (!message) return "Tin nhắn";

    const messageType = getMessageType(message);
    const isRecalled = Boolean(message?.isRecalled ?? message?.is_recalled);

    if (isRecalled) {
      return "[Tin nhắn đã được thu hồi]";
    }

    const text = String(message?.text || message?.content || message?.message || "").trim();

    if (messageType === "image") {
      return text || "Hình ảnh";
    }

    if (messageType === "file") {
      return text || "Tệp đính kèm";
    }

    if (messageType === "audio" || messageType === "voice") {
      return text || "Tin nhắn thoại";
    }

    return text || "Tin nhắn";
  };

  const getReplyPreviewAttachment = (message) => {
    if (!message) return null;

    const messageType = getMessageType(message);
    const attachmentUrl =
      message?.imageUrl || message?.fileUrl || message?.file_url || "";

    if (messageType === "image") {
      return {
        url: attachmentUrl,
        kind: "image",
        name: "Hình ảnh"
      };
    }

    if (messageType === "file") {
      return {
        url: attachmentUrl,
        kind: "file",
        name:
          String(message?.text || message?.content || message?.file_name || message?.originalname || "")
            .trim() || "Tệp đính kèm"
      };
    }

    if (messageType === "audio" || messageType === "voice") {
      return {
        url: attachmentUrl,
        kind: "audio",
        name: "Tin nhắn thoại"
      };
    }

    return null;
  };

  const createReplyPreview = (message) => {
    const messageId = getEntityId(message);
    if (!messageId) return null;

    return {
      id: messageId,
      senderName: getMessageSenderName(message),
      messageType: getMessageType(message),
      content: getReplyPreviewContent(message),
      attachment: getReplyPreviewAttachment(message)
    };
  };

  const getReplyTargetMessageId = (message) =>
    message?.parent_id || message?.parentId || message?.reply_to || message?.replyTo || null;

  const attachReplyPreview = (message, messageList = []) => {
    if (!message || typeof message !== "object") return message;

    const existingReplyPreview = message.replyPreview || message.reply_preview;
    if (existingReplyPreview) {
      return {
        ...message,
        replyPreview: existingReplyPreview
      };
    }

    const replyTargetId = getReplyTargetMessageId(message);
    if (!replyTargetId) {
      return message;
    }

    const parentMessage = (Array.isArray(messageList) ? messageList : []).find(
      (item) => getSafeId(getEntityId(item)) === getSafeId(replyTargetId)
    );

    if (!parentMessage) {
      return message;
    }

    const replyPreview = createReplyPreview(parentMessage);
    if (!replyPreview) {
      return message;
    }

    return {
      ...message,
      replyPreview
    };
  };

  const attachReplyPreviews = (messageList = []) => {
    const normalizedList = Array.isArray(messageList) ? messageList : [];

    return normalizedList.map((message) => attachReplyPreview(message, normalizedList));
  };

  const clearReplyHighlight = () => {
    if (replyHighlightTimeoutRef.current) {
      window.clearTimeout(replyHighlightTimeoutRef.current);
      replyHighlightTimeoutRef.current = null;
    }

    setHighlightedMessageId(null);
  };

  const focusReplyTargetMessage = (targetMessageId) => {
    const safeTargetId = getSafeId(targetMessageId);
    if (!safeTargetId) return false;

    const container = messagesContainerRef.current;
    if (!container) return false;

    const escapedId = escapeSelectorValue(safeTargetId);
    if (!escapedId) return false;

    const targetElement = container.querySelector(`[data-message-ids~="${escapedId}"]`);
    if (!targetElement) return false;

    if (typeof targetElement.scrollIntoView === "function") {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (typeof targetElement.focus === "function") {
      targetElement.focus({ preventScroll: true });
    }

    return true;
  };

  const handleReplyPreviewDoubleClick = (replyPreview) => {
    const targetMessageId = getSafeId(replyPreview?.id);
    if (!targetMessageId) return;

    const matchedMessage = messages.find(
      (message) => getSafeId(getEntityId(message)) === targetMessageId
    );

    if (!matchedMessage) return;

    focusReplyTargetMessage(targetMessageId);
    clearReplyHighlight();

    window.requestAnimationFrame(() => {
      setHighlightedMessageId(targetMessageId);

      replyHighlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId((currentId) =>
          getSafeId(currentId) === targetMessageId ? null : currentId
        );
        replyHighlightTimeoutRef.current = null;
      }, 2400);
    });
  };

  const getGroupInfoMemberAvatar = (member) =>
    getAvatarUrl(member, GROUP_INFO_MEMBER_AVATAR_URL);

  const getGroupPickerMemberAvatar = (member) =>
    getAvatarUrl(member, GROUP_PICKER_MEMBER_AVATAR_URL);

  const toggleCallParticipant = (memberId) => {
    setCallParticipantError("");
    setSelectedCallParticipantIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const closeCallParticipantModal = () => {
    if (isStartingSelectedCall) return;
    setIsCallParticipantModalOpen(false);
    setSelectedCallParticipantIds([]);
    setPendingCallMode("video");
    setCallParticipantError("");
  };

  const handleRequestStartCall = (mode = "video") => {
    if (!currentConversation?.id) return;

    if (!currentConversation?.isGroup) {
      startCall({ mode });
      return;
    }

    const availableParticipants = Array.isArray(currentConversation.members)
      ? currentConversation.members.filter(
          (member) => getSafeId(getUserId(member)) && getSafeId(getUserId(member)) !== getSafeId(user?.id)
        )
      : [];

    if (availableParticipants.length === 0) {
      clearCallError();
      return;
    }

    setPendingCallMode(mode);
    setSelectedCallParticipantIds(
      availableParticipants.map((member) => getSafeId(getUserId(member)))
    );
    setCallParticipantError("");
    setIsCallParticipantModalOpen(true);
  };

  const handleConfirmStartSelectedCall = async () => {
    if (selectedCallParticipantIds.length === 0) {
      setCallParticipantError("Hãy chọn ít nhất 1 thành viên.");
      return;
    }

    try {
      setIsStartingSelectedCall(true);
      const didStart = await startCall({
        mode: pendingCallMode,
        selectedParticipantIds: selectedCallParticipantIds
      });

      if (didStart) {
        setIsCallParticipantModalOpen(false);
        setSelectedCallParticipantIds([]);
        setCallParticipantError("");
      }
    } finally {
      setIsStartingSelectedCall(false);
    }
  };

  const toggleForwardTargetConversation = (conversationId) => {
    setForwardError("");
    setForwardTargetConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const closeForwardModal = () => {
    if (isForwardingMessage) return;
    setIsForwardModalOpen(false);
    setForwardTargetConversationIds([]);
    setForwardingMessage(null);
    setForwardError("");
  };

  const handleOpenForwardMessage = (message) => {
    if (!message) return;
    setForwardingMessage(message);
    setForwardTargetConversationIds([]);
    setForwardError("");
    setIsForwardModalOpen(true);
  };

  const getForwardAttachmentUrl = (message) =>
    message?.imageUrl || message?.fileUrl || message?.file_url || "";

  const normalizeForwardAttachmentUrl = (rawUrl) => {
    if (!rawUrl) return "";

    try {
      const parsedUrl = new URL(rawUrl);
      parsedUrl.protocol = "https:";
      return parsedUrl.toString();
    } catch {
      return String(rawUrl).replace(/^http:\/\//i, "https://");
    }
  };

  const getForwardAttachmentName = (message, attachmentUrl, index) => {
    const explicitName = String(message?.text || "").trim();
    if (explicitName) {
      return explicitName;
    }

    try {
      const pathname = new URL(attachmentUrl).pathname;
      const rawName = pathname.split("/").pop();
      if (rawName) {
        return decodeURIComponent(rawName);
      }
    } catch {
      // Ignore and fallback.
    }

    const type =
      message?.type ||
      message?.messageType ||
      message?.message_type ||
      "file";

    return `${type}-${index + 1}`;
  };

  const createForwardFileFromMessage = async (message, index) => {
    const attachmentUrl = normalizeForwardAttachmentUrl(getForwardAttachmentUrl(message));
    if (!attachmentUrl) {
      return null;
    }

    const response = await fetch(attachmentUrl, {
      mode: "cors",
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch forwarded attachment: ${response.status}`);
    }

    const blob = await response.blob();
    const fileName = getForwardAttachmentName(message, attachmentUrl, index);

    return new File([blob], fileName, {
      type: blob.type || "application/octet-stream",
      lastModified: Date.now()
    });
  };

  const handleForwardMessage = async () => {
    if (!forwardingMessage) return;

    if (forwardTargetConversationIds.length === 0) {
      setForwardError("Hãy chọn ít nhất 1 cuộc trò chuyện.");
      return;
    }

    const groupedItems = Array.isArray(forwardingMessage.groupedItems)
      ? forwardingMessage.groupedItems.filter(Boolean)
      : [];
    const sourceMessages = groupedItems.length > 0 ? groupedItems : [forwardingMessage];
    const sourceMessageType =
      forwardingMessage?.type ||
      forwardingMessage?.messageType ||
      forwardingMessage?.message_type ||
      (forwardingMessage?.fileUrl || forwardingMessage?.file_url ? "file" : "text");
    try {
      setIsForwardingMessage(true);
      setForwardError("");

      const forwardedFiles =
        sourceMessageType === "image" || sourceMessageType === "file"
          ? (
              await Promise.all(
                sourceMessages.map((item, index) => createForwardFileFromMessage(item, index))
              )
            ).filter(Boolean)
          : [];

      if (
        (sourceMessageType === "image" || sourceMessageType === "file") &&
        forwardedFiles.length === 0
      ) {
        throw new Error("No forwardable attachments found");
      }

      for (const conversationId of forwardTargetConversationIds) {
        const targetConversation = conversations.find(
          (conversation) => getSafeId(conversation?.id) === getSafeId(conversationId)
        );

        if (!targetConversation) continue;

        const resolvedConversationId =
          await resolveConversationTargetByConversation(targetConversation);

        if (!resolvedConversationId) continue;

        if (sourceMessageType === "image" || sourceMessageType === "file") {
          await sendMessage({
            conversationId: resolvedConversationId,
            text: buildForwardedContent(""),
            messageType: sourceMessageType,
            files: forwardedFiles
          });
          continue;
        }

        await sendMessage({
          conversationId: resolvedConversationId,
          text: buildForwardedContent(forwardingMessage?.text || ""),
          messageType: "text"
        });
      }

      setIsForwardModalOpen(false);
      setForwardTargetConversationIds([]);
      setForwardingMessage(null);
      setForwardError("");
    } catch (error) {
      console.error("Failed to forward message:", error);
      setForwardError("Không thể chuyển tiếp tin nhắn lúc này.");
    } finally {
      setIsForwardingMessage(false);
    }
  };

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

  const selectedStatusInfo = getDirectChatStatusInfo(currentConversation);
  const {
    activeCall,
    callPhase,
    localStream,
    remoteParticipants,
    errorMessage: callErrorMessage,
    isLocalAudioEnabled,
    isLocalVideoEnabled,
    canStartCall,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    clearCallError
  } = useGroupCall({
    socket: socketClient,
    currentConversation,
    currentUser: user,
    getUserId
  });

  const handleOpenFriendProfileFromConversation = (conversation) => {
    if (!conversation || conversation.isGroup) return;

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    if (!otherMember) return;

    const normalizedMember = normalizeUserEntity(otherMember);
    const isOnline = parseOnlineValue(
      otherMember?.is_online ?? otherMember?.isOnline ?? otherMember?.online ?? false
    );

    setSelectedFriendProfile({
      ...normalizedMember,
      raw: otherMember,
      isOnline
    });
    setSelectedFriendProfileAction("view");
    setShowFriendProfileModal(true);
  };

  const handleUnfriendFriend = async (contact) => {
    const friendId = getSafeId(contact?.id || contact?.user_id);

    if (!friendId) {
      throw new Error("Missing friend id");
    }

    await unfriendFriend(friendId);

    setConversations((prev) => {
      const next = prev.filter((conversation) => {
        if (conversation?.isGroup) return true;

        const conversationFriendId = getSafeId(conversation?.friendId);
        if (conversationFriendId && conversationFriendId === friendId) {
          return false;
        }

        const memberMatches = Array.isArray(conversation?.members)
          ? conversation.members.some((member) => getSafeId(getUserId(member)) === friendId)
          : false;

        return !memberMatches;
      });

      return next;
    });

    if (String(selectedConversationId || "") && !isVirtualConversationId(selectedConversationId)) {
      const selected = conversations.find((conversation) => conversation.id === selectedConversationId);
      const selectedFriendMatches = selected && !selected.isGroup && Array.isArray(selected.members)
        ? selected.members.some((member) => getSafeId(getUserId(member)) === friendId)
        : false;

      if (selectedFriendMatches) {
        setSelectedConversationId(null);
        setMessages([]);
        setMessagePageCursor(null);
        setHasMoreMessages(true);
        failedOlderMessagesCursorRef.current = null;
        setReplyTarget(null);
        setHighlightedMessageId(null);
      }
    }
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
        onOpenAddFriend={openAddFriendModal}
        onOpenCreateGroup={openGroupModal}
        onOpenJoinByCode={openJoinByCodeModal}
        conversations={conversations}
        filteredConversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        getConversationAvatar={getConversationAvatar}
        getConversationDisplayName={getConversationDisplayName}
        getConversationStatusText={(conversation) =>
          getDirectChatStatusInfo(conversation)?.text || "Offline"
        }
        getUnreadCount={(conversation) => unreadCountByConversationId[conversation?.id] || 0}
        formatConversationTime={formatConversationTime}
        getConversationPreview={getConversationPreview}
        onAvatarClick={handleOpenFriendProfileFromConversation}
        onTogglePinConversation={handleTogglePinConversation}
        pinActionLoadingByConversationId={pinActionLoadingByConversationId}
      />

      <ChatWindow
        selectedConversation={currentConversation}
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
        getMessageSenderName={getMessageSenderName}
        formatTime={formatTime}
        messagesEndRef={messagesEndRef}
        messagesContainerRef={messagesContainerRef}
        onMessageScroll={handleMessageScroll}
        isLoadingOlderMessages={isLoadingOlderMessages}
        hasMoreMessages={hasMoreMessages}
        isInitialMessagesLoading={isInitialMessagesLoading}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        replyTarget={replyTarget}
        onReplyMessage={handleReplyMessage}
        onClearReplyTarget={() => setReplyTarget(null)}
        highlightedMessageId={highlightedMessageId}
        onReplyPreviewDoubleClick={handleReplyPreviewDoubleClick}
        onJumpToMessage={handleReplyPreviewDoubleClick}
        handleSendMessage={handleSendMessage}
        handleRecallMessage={handleRecallMessage}
        handleRecallMessageGroup={handleRecallMessageGroup}
        handleDeleteMessage={handleDeleteMessage}
        handleDeleteMessageGroup={handleDeleteMessageGroup}
        onForwardMessage={handleOpenForwardMessage}
        onStartAudioCall={() => handleRequestStartCall("audio")}
        onStartVideoCall={() => handleRequestStartCall("video")}
        onOpenAddMembers={openAddMembersModal}
        onOpenGenerateJoinCode={handleGenerateGroupJoinCode}
        onCreatePoll={handleCreatePoll}
        onVotePoll={handleVotePoll}
        votingPollId={votingPollId}
        isCreatingPoll={isCreatingPoll}
        isCallActionDisabled={!canStartCall}
      />

      <RightPanel openGroupModal={openGroupModal} />

      <GroupInfoModal
        show={showGroupInfoModal}
        selectedConversation={currentConversation}
        selectedGroupMemberCount={selectedGroupMemberCount}
        selectedGroupMembersList={selectedGroupMembersList}
        close={closeGroupInfoModal}
        getUserId={getUserId}
        getGroupInfoMemberAvatar={getGroupInfoMemberAvatar}
        currentUserId={user?.id}
        availableFriendsToAdd={availableFriendsToAdd}
        onUpdateGroupInfo={handleUpdateGroupInfo}
        onAddMembers={handleAddMembersToGroup}
        onRemoveMember={handleRemoveMemberFromGroup}
        onTransferAdmin={handleTransferGroupAdmin}
        onLeaveGroup={handleLeaveGroup}
        onDissolveGroup={handleDissolveGroup}
        isUpdatingGroup={isUpdatingGroup}
        isAddingMembers={isAddingMembers}
        isLeavingGroup={isLeavingGroup}
        isTransferringAdmin={isTransferringAdmin}
        isDissolvingGroup={isDissolvingGroup}
        initialAddMembersView={groupInfoInitialAddMembersView}
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
        errorMessage={groupModalError}
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

      <JoinByCodeModal
        isOpen={isJoinByCodeModalOpen}
        code={joinByCodeInput}
        onCodeChange={handleJoinByCodeInputChange}
        onClose={closeJoinByCodeModal}
        onSubmit={handleJoinGroupByCode}
        isSubmitting={isJoiningByCode}
      />

      <GroupJoinCodeModal
        isOpen={isGroupJoinCodeModalOpen}
        joinCode={generatedJoinCode}
        isLoading={isGeneratingJoinCode}
        onClose={closeGroupJoinCodeModal}
        onCopy={handleCopyGroupJoinCode}
      />

      <FriendProfileModal
        isOpen={showFriendProfileModal}
        contact={selectedFriendProfile}
        onClose={() => {
          setShowFriendProfileModal(false);
          setSelectedFriendProfile(null);
          setSelectedFriendProfileAction("view");
        }}
        onUnfriend={handleUnfriendFriend}
        initialAction={selectedFriendProfileAction}
      />

      <CallParticipantModal
        isOpen={isCallParticipantModalOpen}
        title={pendingCallMode === "audio" ? "Chọn thành viên cho cuộc gọi thoại" : "Chọn thành viên cho cuộc gọi video"}
        members={
          Array.isArray(currentConversation?.members)
            ? currentConversation.members
                .filter(
                  (member) =>
                    getSafeId(getUserId(member)) &&
                    getSafeId(getUserId(member)) !== getSafeId(user?.id)
                )
                .map((member) => ({
                  ...member,
                  id: getSafeId(getUserId(member))
                }))
            : []
        }
        selectedMemberIds={selectedCallParticipantIds}
        toggleMember={toggleCallParticipant}
        getMemberAvatar={getGroupPickerMemberAvatar}
        onClose={closeCallParticipantModal}
        onConfirm={handleConfirmStartSelectedCall}
        isSubmitting={isStartingSelectedCall}
        errorMessage={callParticipantError}
      />

      <ForwardMessageModal
        isOpen={isForwardModalOpen}
        conversations={forwardEligibleConversations}
        selectedConversationIds={forwardTargetConversationIds}
        onToggleConversation={toggleForwardTargetConversation}
        onClose={closeForwardModal}
        onConfirm={handleForwardMessage}
        getConversationAvatar={getConversationAvatar}
        getConversationDisplayName={getConversationDisplayName}
        isSubmitting={isForwardingMessage}
        errorMessage={forwardError}
      />

      <ActionDialog
        isOpen={Boolean(dialogState)}
        title={dialogState?.title}
        message={dialogState?.message}
        tone={dialogState?.tone || "neutral"}
        confirmLabel={dialogState?.confirmLabel || "Đã hiểu"}
        cancelLabel={dialogState?.cancelLabel || "Hủy"}
        showCancel={dialogState?.type === "confirm"}
        onConfirm={dialogState?.onConfirm || closeActionDialog}
        onCancel={dialogState?.onCancel || closeActionDialog}
      />

      <CallOverlay
        activeCall={activeCall}
        callPhase={callPhase}
        localStream={localStream}
        remoteParticipants={remoteParticipants}
        errorMessage={callErrorMessage}
        isLocalAudioEnabled={isLocalAudioEnabled}
        isLocalVideoEnabled={isLocalVideoEnabled}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
        onEnd={() => endCall({ notifyPeers: true })}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={toggleCamera}
        onDismissError={clearCallError}
      />
    </div>
  );
}

export default HomePage;

