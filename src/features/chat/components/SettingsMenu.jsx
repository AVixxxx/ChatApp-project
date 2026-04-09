import { FaUserCircle, FaSignOutAlt, FaDoorOpen } from "react-icons/fa";
import "./SettingsMenu.css";

function SettingsMenu({
  isOpen,
  onAccountInfo,
  onLogout,
  onExit
}) {
  if (!isOpen) return null;

  return (
    <div
      className="settings-menu-popup"
      role="menu"
      aria-label="Settings menu"
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="settings-menu-item" onClick={onAccountInfo}>
        <FaUserCircle className="settings-menu-icon" />
        <span>Thông tin tài khoản</span>
      </button>

      <div className="settings-menu-divider" />

      <button
        type="button"
        className="settings-menu-item settings-menu-item-logout"
        onClick={onLogout}
      >
        <FaSignOutAlt className="settings-menu-icon" />
        <span>Đăng xuất</span>
      </button>

      <button type="button" className="settings-menu-item" onClick={onExit}>
        <FaDoorOpen className="settings-menu-icon" />
        <span>Thoát</span>
      </button>
    </div>
  );
}

export default SettingsMenu;
