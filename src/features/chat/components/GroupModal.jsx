import { FaTimes } from "react-icons/fa";

function GroupModal({
  isOpen,
  closeGroupModal,
  groupName,
  setGroupName,
  allUsers,
  selectedGroupMembers,
  toggleGroupMember,
  getGroupMemberAvatar,
  handleCreateGroup,
  isCreatingGroup,
  errorMessage
}) {
  if (!isOpen) return null;

  const selectedCount = Array.isArray(selectedGroupMembers)
    ? selectedGroupMembers.length
    : 0;

  return (
    <div className="group-modal-overlay">
      <div className="group-modal">
        <div className="group-modal-header">
          <h3>Create Group</h3>
          <button className="group-modal-close" onClick={closeGroupModal}>
            <FaTimes />
          </button>
        </div>

        <div className="group-modal-body">
          <input
            type="text"
            placeholder="Enter group name"
            className="group-name-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />

          <p className="group-helper-text">
            Select at least 2 friends. You will be added automatically.
          </p>

          {errorMessage ? <p className="group-error-text">{errorMessage}</p> : null}

          <p className="group-selection-count">
            Selected friends: {selectedCount}
          </p>

          <div className="group-member-list">
            {allUsers.length === 0 ? (
              <p className="empty-text">No friends available.</p>
            ) : (
              allUsers.map((member) => (
                <label key={member.id} className="group-member-item">
                  <input
                    type="checkbox"
                    checked={selectedGroupMembers.includes(member.id)}
                    onChange={() => toggleGroupMember(member.id)}
                  />
                  <img
                    src={getGroupMemberAvatar(member)}
                    alt={member.name}
                    className="group-member-avatar"
                  />
                  <div className="group-member-info">
                    <span className="group-member-name">{member.name}</span>
                    <span className="group-member-email">{member.email}</span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="group-modal-footer">
          <button className="group-cancel-btn" onClick={closeGroupModal}>
            Cancel
          </button>
          <button
            className="group-create-btn"
            onClick={handleCreateGroup}
            disabled={isCreatingGroup || selectedCount < 2 || !groupName.trim()}
          >
            {isCreatingGroup ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupModal;
