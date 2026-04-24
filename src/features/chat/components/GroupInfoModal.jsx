import { useRef, useState, useEffect } from "react";
import { FaTimes, FaEdit, FaUserPlus, FaTrash, FaCheck } from "react-icons/fa";

function GroupInfoModal({
  show,
  selectedConversation,
  selectedGroupMemberCount,
  selectedGroupMembersList,
  close,
  getUserId,
  getGroupInfoMemberAvatar,
  currentUserId,
  availableFriendsToAdd,
  onUpdateGroupInfo,
  onAddMembers,
  onRemoveMember,
  onLeaveGroup,
  isUpdatingGroup,
  isAddingMembers,
  isLeavingGroup
}) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [showAddMembersPane, setShowAddMembersPane] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!show) {
      setEditMode(false);
      setEditName("");
      setEditAvatarFile(null);
      setEditAvatarPreview(null);
      setShowAddMembersPane(false);
      setSelectedToAdd([]);
    }
  }, [show]);

  if (!show || !selectedConversation?.isGroup) return null;

  const adminId = getUserId(selectedConversation?.groupAdmin);
  const currentMember = selectedGroupMembersList.find(
    (member) => String(member.id || member.user_id) === String(currentUserId)
  );
  const isCurrentUserAdminByRole =
    String(currentMember?.role || "").toLowerCase() === "admin";
  const isCurrentUserAdminByConversation =
    adminId && String(adminId) === String(currentUserId);
  const isCurrentUserAdmin = Boolean(
    isCurrentUserAdminByRole || isCurrentUserAdminByConversation
  );
  const canLeaveGroup = Boolean(currentUserId) && !isCurrentUserAdmin;

  const handleEnterEditMode = () => {
    setEditName(selectedConversation.groupName || "");
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditName("");
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setEditAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveGroupInfo = () => {
    const trimmedName = editName.trim();
    if (!trimmedName && !editAvatarFile) {
      setEditMode(false);
      return;
    }
    onUpdateGroupInfo?.(trimmedName || selectedConversation.groupName, editAvatarFile);
    setEditMode(false);
  };

  const toggleFriendToAdd = (friendId) => {
    setSelectedToAdd((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleConfirmAddMembers = () => {
    if (selectedToAdd.length === 0) return;
    onAddMembers?.(selectedToAdd);
    setSelectedToAdd([]);
    setShowAddMembersPane(false);
  };

  const groupAvatarSrc =
    editAvatarPreview ||
    selectedConversation.groupAvatar ||
    selectedConversation.avatar ||
    null;

  return (
    <div className="group-info-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="group-info-modal">
        {/* Header */}
        <div className="group-info-header">
          <h3>{showAddMembersPane ? "Add Members" : "Group Information"}</h3>
          <button className="group-info-close" onClick={close} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {showAddMembersPane ? (
          /* ── Add Members Pane ── */
          <div className="group-info-body">
            {availableFriendsToAdd && availableFriendsToAdd.length > 0 ? (
              <div className="group-info-member-list">
                {availableFriendsToAdd.map((friend) => {
                  const fId = friend.id || friend.user_id;
                  const checked = selectedToAdd.includes(fId);
                  return (
                    <div
                      key={fId}
                      className={`group-info-member-row group-info-member-row--selectable${checked ? " group-info-member-row--selected" : ""}`}
                      onClick={() => toggleFriendToAdd(fId)}
                    >
                      <input
                        type="checkbox"
                        className="group-info-member-checkbox"
                        checked={checked}
                        readOnly
                      />
                      <img
                        src={getGroupInfoMemberAvatar(friend)}
                        alt={friend.name}
                        className="group-info-member-avatar"
                      />
                      <div className="group-info-member-text">
                        <span className="group-info-member-name">{friend.name || friend.full_name}</span>
                        <span className="group-info-member-email">{friend.email}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="group-info-empty-msg">Không có bạn bè nào để thêm.</p>
            )}
            <div className="group-info-action-row">
              <button
                className="group-info-btn-secondary"
                onClick={() => { setShowAddMembersPane(false); setSelectedToAdd([]); }}
              >
                Hủy
              </button>
              <button
                className="group-info-btn-primary"
                onClick={handleConfirmAddMembers}
                disabled={selectedToAdd.length === 0 || isAddingMembers}
              >
                {isAddingMembers ? "Đang thêm..." : `Thêm (${selectedToAdd.length})`}
              </button>
            </div>
          </div>
        ) : (
          /* ── Main Info Pane ── */
          <div className="group-info-body">
            {/* Avatar + Edit button */}
            <div className="group-info-avatar-section">
              {groupAvatarSrc ? (
                <img src={groupAvatarSrc} alt="group avatar" className="group-info-avatar-img" />
              ) : (
                <div className="group-info-avatar-placeholder">
                  {(selectedConversation.groupName || "G").charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Group name */}
            <div className="group-info-section">
              <div className="group-info-label-row">
                <p className="group-info-label">Tên nhóm</p>
                {isCurrentUserAdmin && !editMode && (
                  <button className="group-info-icon-btn" onClick={handleEnterEditMode} title="Chỉnh sửa">
                    <FaEdit />
                  </button>
                )}
              </div>

              {editMode ? (
                <div className="group-info-edit-row">
                  <input
                    className="group-info-edit-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Tên nhóm..."
                    maxLength={100}
                    autoFocus
                  />
                  <div className="group-info-edit-avatar-row">
                    <span className="group-info-label">Ảnh nhóm (tuỳ chọn)</span>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleAvatarFileChange}
                    />
                    {editAvatarPreview && (
                      <img src={editAvatarPreview} alt="preview" className="group-info-avatar-preview" />
                    )}
                    <button
                      className="group-info-btn-secondary group-info-btn-sm"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {editAvatarFile ? "Đổi ảnh" : "Chọn ảnh"}
                    </button>
                  </div>
                  <div className="group-info-action-row">
                    <button className="group-info-btn-secondary" onClick={handleCancelEdit}>
                      Hủy
                    </button>
                    <button
                      className="group-info-btn-primary"
                      onClick={handleSaveGroupInfo}
                      disabled={isUpdatingGroup}
                    >
                      {isUpdatingGroup ? "Đang lưu..." : <><FaCheck /> Lưu</>}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="group-info-value">
                  {selectedConversation.groupName || "Unnamed Group"}
                </p>
              )}
            </div>

            {/* Created at */}
            <div className="group-info-section">
              <p className="group-info-label">Ngày tạo</p>
              <p className="group-info-value">
                {selectedConversation.createdAt
                  ? new Date(selectedConversation.createdAt).toLocaleString("vi-VN")
                  : "Unknown"}
              </p>
            </div>

            {/* Member count + add button */}
            <div className="group-info-section">
              <div className="group-info-label-row">
                <p className="group-info-label">Thành viên ({selectedGroupMemberCount})</p>
                {isCurrentUserAdmin && (
                  <button
                    className="group-info-icon-btn"
                    onClick={() => setShowAddMembersPane(true)}
                    title="Thêm thành viên"
                  >
                    <FaUserPlus />
                  </button>
                )}
              </div>
            </div>

            {/* Member list */}
            <div className="group-info-member-list">
              {selectedGroupMembersList.map((member) => {
                const memberId = member.id || member.user_id;
                const memberAdminId = getUserId(selectedConversation?.groupAdmin);
                const isMemberAdmin = memberAdminId && String(memberAdminId) === String(memberId);
                const isMe = String(memberId) === String(currentUserId);
                const canRemove = isCurrentUserAdmin && !isMemberAdmin && !isMe;

                return (
                  <div key={memberId} className="group-info-member-row">
                    <img
                      src={getGroupInfoMemberAvatar(member)}
                      alt={member.name}
                      className="group-info-member-avatar"
                    />
                    <div className="group-info-member-text">
                      <div className="group-info-member-top">
                        <span className="group-info-member-name">
                          {member.name || member.full_name}
                          {isMe && " (bạn)"}
                        </span>
                        {isMemberAdmin && <span className="group-info-admin-badge">Admin</span>}
                      </div>
                      <span className="group-info-member-email">{member.email}</span>
                    </div>
                    {canRemove && (
                      <button
                        className="group-info-remove-btn"
                        onClick={() => onRemoveMember?.(memberId)}
                        title="Xóa khỏi nhóm"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {canLeaveGroup && (
              <div className="group-info-action-row group-info-action-row--danger">
                <button
                  className="group-info-btn-danger"
                  onClick={() => onLeaveGroup?.()}
                  disabled={isLeavingGroup || !canLeaveGroup}
                >
                  {isLeavingGroup ? "Đang rời nhóm..." : "Rời nhóm"}
                </button>
              </div>
            )}

            {isCurrentUserAdmin && (
              <p className="group-info-danger-note">
                Bạn đang là admin. Vui lòng chuyển quyền admin trước khi rời nhóm.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupInfoModal;
