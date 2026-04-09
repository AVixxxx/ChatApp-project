import ContactItem from "./ContactItem";

const getGroupKey = (name) => {
  if (!name || typeof name !== "string") return "#";
  const firstChar = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(firstChar) ? firstChar : "#";
};

function ContactList({ contacts, listRef, onMessage, onViewProfile, onRemove }) {
  if (!contacts.length) {
    return <p className="contacts-empty">Không có bạn bè nào.</p>;
  }

  const grouped = contacts.reduce((acc, contact) => {
    const key = getGroupKey(contact.name);
    if (!acc[key]) acc[key] = [];
    acc[key].push(contact);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  return (
    <div
      ref={listRef}
      className="contacts-list"
      tabIndex={-1}
      aria-label="Friend list"
    >
      {sortedKeys.map((key) => (
        <div key={key} className="contact-group">
          <h4 className="contact-group-title">{key}</h4>
          <div className="contact-group-items">
            {grouped[key].map((contact) => (
              <ContactItem
                key={contact.id || contact.relationId}
                contact={contact}
                onMessage={onMessage}
                onViewProfile={onViewProfile}
                onRemove={onRemove}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ContactList;
