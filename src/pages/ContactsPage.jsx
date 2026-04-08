import { useEffect, useMemo, useState } from "react";
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
import "./HomePage.css";
import "./ContactsPage.css";

function ContactsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("friends");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortType, setSortType] = useState("asc");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await getMe();
        const normalized = normalizeUserEntity(me);
        setUser(normalized);
        saveAuthUserToStorage(normalized);

        const [friendData, requestData] = await Promise.all([
          getFriendList(normalized?.id),
          getFriendRequests(normalized?.id)
        ]);

        setContacts(friendData);
        setRequests(requestData);
      } catch (error) {
        console.error("Failed to load contacts page data:", error);
      }
    };

    bootstrap();
  }, []);

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
            isOnline: false,
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
      return (
        <ContactList
          contacts={filteredContacts}
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
