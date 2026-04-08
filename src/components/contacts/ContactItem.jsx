import { getAvatarUrl } from "../../utils/userNormalizer";
import ContactActions from "./ContactActions";

function ContactItem({ contact, onMessage, onViewProfile, onRemove }) {
  return (
    <div className="contact-item">
      <div className="contact-main">
        <img src={getAvatarUrl(contact)} alt={contact.name} className="contact-avatar" />
        <div>
          <p className="contact-name">{contact.name || "Unknown User"}</p>
          <span className={`contact-status ${contact.isOnline ? "online" : "offline"}`}>
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
