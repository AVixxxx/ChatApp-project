import { useEffect, useRef } from "react";
import {
  FaExclamationTriangle,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
  FaUserFriends,
  FaVideo,
  FaVideoSlash
} from "react-icons/fa";

const VideoTile = ({
  label,
  stream,
  muted = false,
  status = "",
  isLocal = false,
  isVideoEnabled = true
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className={`call-tile ${isLocal ? "local" : ""}`}>
      {stream && isVideoEnabled ? (
        <video
          ref={videoRef}
          className="call-video"
          autoPlay
          playsInline
          muted={muted}
        />
      ) : (
        <div className="call-video call-video-placeholder">
          <span>{label?.slice?.(0, 1) || "U"}</span>
        </div>
      )}

      <div className="call-tile-meta">
        <strong>{label}</strong>
        <span>{status}</span>
      </div>
    </div>
  );
};

function CallOverlay({
  activeCall,
  callPhase,
  localStream,
  remoteParticipants,
  errorMessage,
  isLocalAudioEnabled,
  isLocalVideoEnabled,
  onAccept,
  onDecline,
  onEnd,
  onToggleMicrophone,
  onToggleCamera,
  onDismissError
}) {
  if (!activeCall && !errorMessage) return null;

  const showIncomingActions = callPhase === "incoming" && activeCall;
  const showCallUi = Boolean(activeCall);

  return (
    <div className="call-overlay">
      <div className="call-shell">
        {errorMessage ? (
          <div className="call-error-banner">
            <div className="call-error-copy">
              <FaExclamationTriangle />
              <span>{errorMessage}</span>
            </div>
            <button type="button" className="call-error-close" onClick={onDismissError}>
              Đóng
            </button>
          </div>
        ) : null}

        {showCallUi ? (
          <>
            <div className="call-topbar">
              <div>
                <h3>{activeCall.conversationName || "Cuộc gọi nhóm"}</h3>
                <p>
                  {callPhase === "incoming"
                    ? "Cuộc gọi đến"
                    : callPhase === "ringing"
                      ? "Đang mời thành viên tham gia"
                      : callPhase === "connecting"
                        ? "Đang thiết lập kết nối"
                        : "Đang trong cuộc gọi"}
                </p>
              </div>

              <div className="call-summary-pill">
                <FaUserFriends />
                <span>{remoteParticipants.length + 1} người</span>
              </div>
            </div>

            <div className="call-grid">
              <VideoTile
                label="Bạn"
                stream={localStream}
                muted
                status={isLocalAudioEnabled ? "Micro đang bật" : "Micro đang tắt"}
                isLocal
                isVideoEnabled={isLocalVideoEnabled}
              />

              {remoteParticipants.map((participant) => (
                <VideoTile
                  key={participant.userId}
                  label={participant.name || participant.userId}
                  stream={participant.stream}
                  status={participant.status || "invited"}
                  isVideoEnabled={participant.isVideoEnabled}
                />
              ))}
            </div>

            <div className="call-controls">
              {showIncomingActions ? (
                <>
                  <button type="button" className="call-control-btn accept" onClick={onAccept}>
                    <FaVideo />
                    <span>Tham gia</span>
                  </button>
                  <button type="button" className="call-control-btn hangup" onClick={onDecline}>
                    <FaPhoneSlash />
                    <span>Từ chối</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`call-control-btn ${isLocalAudioEnabled ? "" : "off"}`}
                    onClick={onToggleMicrophone}
                  >
                    {isLocalAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
                    <span>{isLocalAudioEnabled ? "Bật mic" : "Tắt mic"}</span>
                  </button>

                  <button
                    type="button"
                    className={`call-control-btn ${isLocalVideoEnabled ? "" : "off"}`}
                    onClick={onToggleCamera}
                  >
                    {isLocalVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
                    <span>{isLocalVideoEnabled ? "Bật cam" : "Tắt cam"}</span>
                  </button>

                  <button type="button" className="call-control-btn hangup" onClick={onEnd}>
                    <FaPhoneSlash />
                    <span>Rời cuộc gọi</span>
                  </button>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default CallOverlay;
