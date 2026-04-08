import { useEffect, useRef, useState } from "react";
import { FaEllipsisV } from "react-icons/fa";

function ContactActions({ onMessage, onViewProfile, onRemove }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="contact-actions" ref={rootRef}>
      <button className="contact-action-trigger" onClick={() => setOpen((prev) => !prev)}>
        <FaEllipsisV />
      </button>

      {open && (
        <div className="contact-action-menu">
          <button onClick={onMessage}>Nhắn tin</button>
          <button onClick={onViewProfile}>Xem hồ sơ</button>
          <button className="danger" onClick={onRemove}>Xóa bạn</button>
        </div>
      )}
    </div>
  );
}

export default ContactActions;
