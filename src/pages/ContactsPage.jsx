import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/chat/Sidebar";
import ContactsSidebar from "../components/contacts/ContactsSidebar";
import ContactsHeader from "../components/contacts/ContactsHeader";
import ContactList from "../components/contacts/ContactList";
import FriendRequestList from "../components/contacts/FriendRequestList";
import { createPrivateConversation } from "../services/conversationService";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendList,
  getFriendRequests,
  removeFriend
} from "../services/friendService";
import { getMe } from "../services/userService";
import {
  getAvatarUrl,
  getStoredAuthUser,
  normalizeUserEntity,
  saveAuthUserToStorage
} from "../utils/userNormalizer";
import { prefetchHomeConversationsCache } from "../utils/homeConversationCache";
import "./HomePage.css";
import "./ContactsPage.css";

const CONTACTS_CACHE_KEY = "contactsPageCacheV1";
const CONTACTS_CACHE_TTL_MS = 5 * 60 * 1000;

const readContactsCache = () => {
  try {
    const raw = sessionStorage.getItem(CONTACTS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const timestamp = Number(parsed.timestamp || 0);
    if (!timestamp || Date.now() - timestamp > CONTACTS_CACHE_TTL_MS) {
      return null;
    }

    return {
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      activeTab: typeof parsed.activeTab === "string" ? parsed.activeTab : "friends"
    };
  } catch {
    return null;
  }
};

const writeContactsCache = ({ contacts, requests, activeTab }) => {
  try {
    sessionStorage.setItem(
      CONTACTS_CACHE_KEY,
      JSON.stringify({
        contacts,
        requests,
        activeTab,
        timestamp: Date.now()
      })
    );
  } catch {
    // Ignore cache write failures.
  }
};

function ContactsPage() {
  const cachedContactsState = readContactsCache();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [contacts, setContacts] = useState(() => cachedContactsState?.contacts || []);
  const [requests, setRequests] = useState(() => cachedContactsState?.requests || []);
  const [activeTab, setActiveTab] = useState(
    () => cachedContactsState?.activeTab || "friends"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [sortType, setSortType] = useState("asc");
  const [filterType, setFilterType] = useState("all");
  const [isContactsLoading, setIsContactsLoading] = useState(
    () => !(cachedContactsState?.contacts?.length > 0)
  );
  const friendsListRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadFriends = async (userId) => {
      if (!userId) {
        if (mounted) setIsContactsLoading(false);
        return;
      }

      try {
        const friendData = await getFriendList(userId);
        if (mounted) {
          setContacts(friendData);
        }
      } catch (error) {
        console.error("Failed to load friend list:", error);
      } finally {
        if (mounted) {
          setIsContactsLoading(false);
        }
      }
    };

    const loadRequests = async (userId) => {
      if (!userId) return;

      try {
        const requestData = await getFriendRequests(userId);
        if (mounted) {
          setRequests(requestData);
        }
      } catch (error) {
        console.error("Failed to load friend requests:", error);
      }
    };

    const bootstrap = async () => {
      try {
        const cachedUser = getStoredAuthUser();

        if (cachedUser?.id) {
          setUser(cachedUser);
          loadFriends(cachedUser.id);
          loadRequests(cachedUser.id);
        }

        const me = await getMe();
        const normalized = normalizeUserEntity(me);

        if (!mounted) return;

        setUser(normalized);
        saveAuthUserToStorage(normalized);

        if (!cachedUser?.id || cachedUser.id !== normalized?.id) {
          setIsContactsLoading(true);
          loadFriends(normalized?.id);
          loadRequests(normalized?.id);
        }
      } catch (error) {
        console.error("Failed to load contacts page data:", error);
        if (mounted) {
          setIsContactsLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    prefetchHomeConversationsCache(user?.id);
  }, [user?.id]);

  useEffect(() => {
    writeContactsCache({ contacts, requests, activeTab });
  }, [contacts, requests, activeTab]);

  useEffect(() => {
    if (activeTab !== "friends") return;

    const timer = window.setTimeout(() => {
      friendsListRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeTab, contacts.length]);

  const filteredContacts = useMemo(() => {
    const keyword = searchTerm.toLowerCase().trim();

    let list = [...contacts];

    if (keyword) {
      list = list.filter((contact) =>
        (contact.name || "").toLowerCase().includes(keyword)
      );
    }

    if (filterType === "online") {
      list = list.filter((contact) => contact.isOnline);
    }

    list.sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return sortType === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });

    return list;
  }, [contacts, searchTerm, sortType, filterType]);

  const filteredRequests = useMemo(() => {
    const pendingRequests = requests.filter(
      (request) => (request.status || "").toLowerCase() === "pending"
    );

    const keyword = searchTerm.toLowerCase().trim();
    if (!keyword) return pendingRequests;

    return pendingRequests.filter((request) =>
      (request.name || "").toLowerCase().includes(keyword)
    );
  }, [requests, searchTerm]);

  const pendingIncomingRequestCount = useMemo(
    () => requests.filter((request) => request.type === "incoming").length,
    [requests]
  );

  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);

      const acceptedRequest = requests.find(
        (request) => (request.relationId || request.id) === requestId
      );
      if (acceptedRequest) {
        setContacts((prev) => [
          ...prev,
          {
            id: acceptedRequest.id,
            name: acceptedRequest.name,
            avatar: acceptedRequest.avatar,
            isOnline: acceptedRequest.isOnline ?? false,
            relationId: acceptedRequest.relationId || requestId,
            raw: acceptedRequest.raw
          }
        ]);
      }

      setRequests((prev) =>
        prev.filter((request) => (request.relationId || request.id) !== requestId)
      );
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await declineFriendRequest(requestId);
      setRequests((prev) =>
        prev.filter((request) => (request.relationId || request.id) !== requestId)
      );
    } catch (error) {
      console.error("Failed to decline request:", error);
    }
  };

  const handleRemoveFriend = async (contact) => {
    try {
      const relationId = contact.relationId || contact.id;
      await removeFriend(relationId);
      setContacts((prev) => prev.filter((item) => item.id !== contact.id));
    } catch (error) {
      console.error("Failed to remove friend:", error);
    }
  };

  const handleMessageFriend = async (contact) => {
    try {
      if (contact?.id) {
        await createPrivateConversation([contact.id]);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      navigate("/home");
    }
  };

  const handleViewProfile = () => {
    navigate("/profile");
  };

  const renderMainContent = () => {
    if (activeTab === "friends") {
      if (isContactsLoading) {
        return <p className="contacts-placeholder">Dang tai danh sach ban be...</p>;
      }

      return (
        <ContactList
          contacts={filteredContacts}
          listRef={friendsListRef}
          onMessage={handleMessageFriend}
          onViewProfile={handleViewProfile}
          onRemove={handleRemoveFriend}
        />
      );
    }

    if (activeTab === "friendRequests") {
      return (
        <FriendRequestList
          requests={filteredRequests}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
        />
      );
    }

    if (activeTab === "groups") {
      return <p className="contacts-placeholder">Nhóm và cộng đồng sẽ được cập nhật sau.</p>;
    }

    return <p className="contacts-placeholder">Lời mời vào nhóm sẽ được cập nhật sau.</p>;
  };

  return (
    <div className="contacts-layout">
      <Sidebar
        avatarUrl={getAvatarUrl(user)}
        userName={user?.name}
        activeMenu="contacts"
        onOpenMessages={() => navigate("/home")}
        onOpenContacts={() => navigate("/contacts")}
        onOpenProfile={() => navigate("/profile")}
      />

      <ContactsSidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingRequestCount={pendingIncomingRequestCount}
      />

      <div className="contacts-main">
        <ContactsHeader
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          sortType={sortType}
          onSortTypeChange={setSortType}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />

        {renderMainContent()}
      </div>
    </div>
  );
}

export default ContactsPage;
