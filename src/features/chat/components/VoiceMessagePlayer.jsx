import { FaDownload } from "react-icons/fa";

const toDurationLabel = (durationSec) => {
  const total = Math.max(0, Number(durationSec) || 0);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const readDurationFromMessage = (message) => {
  if (!message || typeof message !== "object") return 0;

  const directDuration =
    message.durationSec ||
    message.duration_sec ||
    message.duration ||
    message.audioDuration ||
    message.audio_duration;

  if (Number.isFinite(Number(directDuration))) {
    return Number(directDuration);
  }

  return 0;
};

function VoiceMessagePlayer({ message, fileUrl, onDownload }) {
  const durationSec = readDurationFromMessage(message);

  return (
    <div className="message-voice" role="group" aria-label="Voice message">
      <audio controls preload="metadata" src={fileUrl} className="message-voice-audio" />
      <div className="message-voice-footer">
        <span className="message-voice-duration">{toDurationLabel(durationSec)}</span>
        <button
          type="button"
          className="message-voice-download"
          onClick={() => onDownload?.(message)}
          aria-label="Download voice message"
        >
          <FaDownload />
          Download
        </button>
      </div>
    </div>
  );
}

export default VoiceMessagePlayer;
