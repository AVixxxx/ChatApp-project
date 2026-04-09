import { getAvatarUrl } from "@/utils/userNormalizer";

function FriendRequestList({ requests, onAccept, onDecline }) {
  if (!requests.length) {
    return <p className="contacts-empty">Không có lời mời kết bạn.</p>;
  }

  return (
    <div className="request-list">
      {requests.map((request) => {
        const requestRelationId = request.relationId || request.id;

        return (
          <div className="request-item" key={requestRelationId}>
            <div className="request-main">
              <img src={getAvatarUrl(request)} alt={request.name} className="contact-avatar" />
              <div>
                <p className="contact-name">{request.name || "Unknown User"}</p>
                <span className="request-type">
                  {request.type === "incoming" ? "Đã gửi lời mời cho bạn" : "Bạn đã gửi lời mời"}
                </span>
              </div>
            </div>

            <div className="request-actions">
              {request.type === "incoming" ? (
                <>
                  <button className="btn-accept" onClick={() => onAccept(requestRelationId)}>
                    Chấp nhận
                  </button>
                  <button className="btn-decline" onClick={() => onDecline(requestRelationId)}>
                    Từ chối
                  </button>
                </>
              ) : (
                <span className="request-status">Đã gửi</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default FriendRequestList;
