import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaComments, FaPhoneAlt, FaAddressBook, FaCloudUploadAlt, FaBriefcase, FaCog } from "react-icons/fa";
import SettingsMenu from "../SettingsMenu";

function Sidebar({
  avatarUrl,
  userName,
  onOpenProfile,
  onOpenMessages,
  onOpenContacts,
  activeMenu = "messages"
}) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuAnchorRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return undefined;

    const handleOutsideClick = (event) => {
      if (!menuAnchorRef.current?.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showMenu]);

  const handleOpenProfile = () => {
    setShowMenu(false);
    if (onOpenProfile) {
      onOpenProfile();
      return;
    }
    navigate("/profile");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setShowMenu(false);
    navigate("/login");
  };

  const handleExit = () => {
    setShowMenu(false);
    console.log("exit");
  };

  return (
    <div className="sidebar">
      <div
        className="user-info"
        onClick={handleOpenProfile}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpenProfile();
          }
        }}
      >
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

        <div
          className="bottom-tool settings-menu-anchor"
          onClick={() => setShowMenu((prev) => !prev)}
          ref={menuAnchorRef}
        >
          <FaCog />
          <span>Setting</span>

          <SettingsMenu
            isOpen={showMenu}
            onAccountInfo={handleOpenProfile}
            onLogout={handleLogout}
            onExit={handleExit}
          />
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
