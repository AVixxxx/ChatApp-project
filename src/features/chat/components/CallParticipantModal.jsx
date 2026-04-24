import { FaTimes } from "react-icons/fa";

function CallParticipantModal({
  isOpen,
  title,
  members,
  selectedMemberIds,
  toggleMember,
  getMemberAvatar,
  onClose,
  onConfirm,
  isSubmitting,
  errorMessage
}) {
  if (!isOpen) return null;

  const selectedCount = Array.isArray(selectedMemberIds) ? selectedMemberIds.length : 0;

  return (
    <div className="group-modal-overlay">
      <div className="group-modal call-participant-modal">
        <div className="group-modal-header">
          <h3>{title || "Chọn thành viên tham gia"}</h3>
          <button type="button" className="group-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="group-modal-body">
          <p className="group-helper-text">
            Chọn những thành viên sẽ nhận lời mời vào cuộc gọi này.
          </p>

          {errorMessage ? <p className="group-error-text">{errorMessage}</p> : null}

          <p className="group-selection-count">Da chon: {selectedCount}</p>

          <div className="group-member-list">
            {members.length === 0 ? (
              <p className="empty-text">Không có thành viên nào để chọn.</p>
            ) : (
              members.map((member) => (
                <label key={member.id} className="group-member-item">
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                  />
                  <img
                    src={getMemberAvatar(member)}
                    alt={member.name}
                    className="group-member-avatar"
                  />
                  <div className="group-member-info">
                    <span className="group-member-name">{member.name}</span>
                    <span className="group-member-email">{member.email || member.phone || ""}</span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="group-modal-footer">
          <button type="button" className="group-cancel-btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="group-create-btn"
            onClick={onConfirm}
            disabled={isSubmitting || selectedCount < 1}
          >
            {isSubmitting ? "Đang bắt đầu..." : "Bắt đầu cuộc gọi"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CallParticipantModal;
