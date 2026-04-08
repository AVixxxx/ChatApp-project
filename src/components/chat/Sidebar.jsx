import { FaComments, FaPhoneAlt, FaAddressBook, FaCloudUploadAlt, FaBriefcase, FaCog } from "react-icons/fa";

function Sidebar({
  avatarUrl,
  userName,
  onOpenProfile,
  onOpenMessages,
  onOpenContacts,
  activeMenu = "messages"
}) {
  return (
    <div className="sidebar">
      <div className="user-info">
        <img src={avatarUrl} alt="avatar" className="avatar" />
        <h3>Hi {userName || "Alex"}!</h3>
      </div>

      <div className="menu">
        <div
          className={`menu-item ${activeMenu === "messages" ? "active" : ""}`}
          onClick={onOpenMessages}
        >
          <FaComments className="menu-icon" />
          <span>Message</span>
        </div>

        <div className="menu-item">
          <FaPhoneAlt className="menu-icon" />
          <span>Calls</span>
        </div>

        <div
          className={`menu-item ${activeMenu === "contacts" ? "active" : ""}`}
          onClick={onOpenContacts}
        >
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

        <div className="bottom-tool" onClick={onOpenProfile}>
          <FaCog />
          <span>Setting</span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
