import { FaTimes } from "react-icons/fa";
import "./AddFriendModal.css";

function AddFriendModal({
  isOpen,
  keyword,
  onKeywordChange,
  results,
  error,
  isSearching,
  sendingId,
  onClose,
  onSearch,
  onAddFriend
}) {
  if (!isOpen) return null;

  const handleKeywordChange = (event) => {
    onKeywordChange(event.target.value);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch();
    }
  };

  return (
    <div className="add-friend-modal-overlay" onClick={onClose}>
      <div
        className="add-friend-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Thêm bạn"
      >
        <div className="add-friend-modal-header">
          <h3>Thêm bạn</h3>
          <button type="button" className="add-friend-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="add-friend-input-row">
          <input
            className="add-friend-input"
            value={keyword}
            onChange={handleKeywordChange}
            onKeyDown={handleKeyDown}
            placeholder="Số điện thoại hoặc email"
          />
        </div>

        <p className="add-friend-suggest-label">Có thể bạn quen</p>

        <div className="add-friend-result-list">
          {isSearching ? (
            <p className="add-friend-hint">Đang tìm kiếm...</p>
          ) : error ? (
            <p className="add-friend-hint error">{error}</p>
          ) : results.length === 0 ? (
            <p className="add-friend-hint">Nhập thông tin rồi bấm Tìm kiếm</p>
          ) : (
            results.map((item) => {
              const userId = String(item?.id || item?.user_id || "");
              return (
                <div className="add-friend-result-item" key={userId}>
                  <img
                    src={item.avatar}
                    alt={item.name || "Người dùng"}
                    className="add-friend-avatar"
                  />
                  <div className="add-friend-result-content">
                    <h4>{item.name || "Người dùng"}</h4>
                    <p>{item.email || item.phone || "Từ số điện thoại"}</p>
                  </div>
                  <button
                    type="button"
                    className="add-friend-action"
                    onClick={() => onAddFriend(userId)}
                    disabled={!userId || sendingId === userId}
                  >
                    {sendingId === userId ? "Đang gửi" : "Kết bạn"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="add-friend-footer">
          <button type="button" className="add-friend-cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="add-friend-search" onClick={onSearch}>
            Tìm kiếm
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddFriendModal;
