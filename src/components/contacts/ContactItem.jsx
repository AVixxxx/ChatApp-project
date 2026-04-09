import { getAvatarUrl } from "../../utils/userNormalizer";
import ContactActions from "./ContactActions";

function ContactItem({ contact, onMessage, onViewProfile, onRemove }) {
  return (
    <div className="contact-item">
      <div className="contact-main">
        <button
          type="button"
          className="contact-avatar-btn"
          onClick={() => onViewProfile(contact)}
          aria-label={`Xem thong tin ${contact.name || "ban be"}`}
        >
          <img src={getAvatarUrl(contact)} alt={contact.name} className="contact-avatar" />
        </button>
        <div>
          <p className="contact-name">{contact.name || "Unknown User"}</p>
          <span className={`contact-status ${contact.isOnline ? "online" : "offline"}`}>
            <span className="contact-status-dot" aria-hidden="true" />
            {contact.isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <ContactActions
        onMessage={() => onMessage(contact)}
        onViewProfile={() => onViewProfile(contact)}
        onRemove={() => onRemove(contact)}
      />
    </div>
  );
}

export default ContactItem;
