import { FaUsers, FaLayerGroup, FaUserPlus, FaEnvelopeOpenText } from "react-icons/fa";

function ContactsSidebar({ activeTab, onChangeTab, pendingRequestCount = 0 }) {
  const items = [
    { id: "friends", label: "Danh sách bạn bè", icon: <FaUsers /> },
    { id: "groups", label: "Nhóm và cộng đồng", icon: <FaLayerGroup /> },
    {
      id: "friendRequests",
      label: "Lời mời kết bạn",
      icon: <FaUserPlus />,
      count: pendingRequestCount
    },
    { id: "groupInvites", label: "Lời mời vào nhóm", icon: <FaEnvelopeOpenText /> }
  ];

  return (
    <aside className="contacts-menu">
      <h3 className="contacts-menu-title">
        <FaUsers />
        <span>Contacts</span>
      </h3>
      <div className="contacts-menu-list">
        {items.map((item) => (
          <button
            key={item.id}
            className={`contacts-menu-item ${activeTab === item.id ? "active" : ""}`}
            onClick={() => onChangeTab(item.id)}
          >
            <span className="contacts-menu-content">
              <span className="contacts-menu-icon">{item.icon}</span>
              <span className="contacts-menu-label">{item.label}</span>
            </span>
            {item.count > 0 && (
              <span className="contacts-menu-badge">{item.count}</span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}

export default ContactsSidebar;
