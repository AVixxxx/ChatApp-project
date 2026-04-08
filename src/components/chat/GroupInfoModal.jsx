import { FaTimes } from "react-icons/fa";

function GroupInfoModal({
  show,
  selectedConversation,
  selectedGroupMemberCount,
  selectedGroupMembersList,
  close,
  getUserId,
  getGroupInfoMemberAvatar
}) {
  if (!show || !selectedConversation?.isGroup) return null;

  return (
    <div className="group-info-overlay">
      <div className="group-info-modal">
        <div className="group-info-header">
          <h3>Group Information</h3>
          <button className="group-info-close" onClick={close}>
            <FaTimes />
          </button>
        </div>

        <div className="group-info-body">
          <div className="group-info-section">
            <p className="group-info-label">Group name</p>
            <p className="group-info-value">
              {selectedConversation.groupName || "Unnamed Group"}
            </p>
          </div>

          <div className="group-info-section">
            <p className="group-info-label">Created at</p>
            <p className="group-info-value">
              {selectedConversation.createdAt
                ? new Date(selectedConversation.createdAt).toLocaleString()
                : "Unknown"}
            </p>
          </div>

          <div className="group-info-section">
            <p className="group-info-label">Members</p>
            <p className="group-info-value">{selectedGroupMemberCount} members</p>
          </div>

          <div className="group-info-member-list">
            {selectedGroupMembersList.map((member) => {
              const isAdmin =
                getUserId(selectedConversation?.groupAdmin) === getUserId(member);

              return (
                <div key={member.id} className="group-info-member-row">
                  <img
                    src={getGroupInfoMemberAvatar(member)}
                    alt={member.name}
                    className="group-info-member-avatar"
                  />
                  <div className="group-info-member-text">
                    <div className="group-info-member-top">
                      <span className="group-info-member-name">{member.name}</span>
                      {isAdmin && <span className="group-info-admin-badge">Admin</span>}
                    </div>
                    <span className="group-info-member-email">{member.email}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupInfoModal;
