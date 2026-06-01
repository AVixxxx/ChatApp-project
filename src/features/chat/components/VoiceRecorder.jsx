import { useEffect, useMemo, useState } from "react";
import { FaMicrophone, FaRedo, FaSquare, FaTrash } from "react-icons/fa";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

const formatDuration = (durationSec) => {
  const totalSeconds = Math.max(0, Number(durationSec) || 0);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

function VoiceRecorder({ onCreateVoiceAttachment, disabled = false }) {
  const [readyAttachmentId, setReadyAttachmentId] = useState("");
  const {
    isSupported,
    isRecording,
    durationSec,
    error,
    recordedFile,
    recordedBlobUrl,
    startRecording,
    stopRecording,
    reset
  } = useVoiceRecorder();

  const waveformBars = useMemo(() => [28, 44, 18, 36, 54, 24, 42], []);

  const handleStart = async () => {
    if (disabled || isRecording) return;
    await startRecording();
  };

  useEffect(() => {
    if (!recordedFile || !recordedBlobUrl) {
      return;
    }

    const attachmentId = `voice-${recordedFile.name}-${recordedFile.lastModified}`;

    onCreateVoiceAttachment?.({
      id: attachmentId,
      kind: "voice",
      file: recordedFile,
      durationSec,
      name: recordedFile.name,
      previewUrl: recordedBlobUrl
    });

    setReadyAttachmentId(attachmentId);
  }, [durationSec, onCreateVoiceAttachment, recordedBlobUrl, recordedFile]);

  const handleDeleteReady = () => {
    if (disabled) return;

    if (readyAttachmentId) {
      onCreateVoiceAttachment?.({ id: readyAttachmentId, remove: true });
    }

    setReadyAttachmentId("");
    reset();
  };

  const handleReRecord = async () => {
    if (disabled) return;

    handleDeleteReady();
    await startRecording();
  };

  useEffect(() => {
    if (!recordedFile && !recordedBlobUrl) {
      setReadyAttachmentId("");
    }
  }, [recordedBlobUrl, recordedFile]);

  if (!isSupported) {
    return (
      <button
        type="button"
        className="chat-file-btn"
        disabled
        title="Trinh duyet khong ho tro ghi am"
        aria-label="Voice recording unsupported"
      >
        <FaMicrophone className="input-action-icon" />
      </button>
    );
  }

  if (isRecording) {
    return (
      <div className="voice-recorder-active" role="status" aria-live="polite">
        <div className="voice-recorder-status-copy">
          <span className="voice-recorder-dot" aria-hidden="true" />
          <span className="voice-recorder-label">Đang ghi âm</span>
          <span className="voice-recorder-time">{formatDuration(durationSec)}</span>
        </div>

        <div className="voice-recorder-visualizer" aria-hidden="true">
          {waveformBars.map((height, index) => (
            <span
              key={`${height}-${index}`}
              className="voice-recorder-bar"
              style={{ height: `${height}%`, animationDelay: `${index * 0.12}s` }}
            />
          ))}
        </div>

        <button
          type="button"
          className="voice-recorder-btn voice-recorder-btn-stop"
          onClick={stopRecording}
          aria-label="Stop voice recording"
        >
          <FaSquare />
        </button>
      </div>
    );
  }

  if (recordedFile && recordedBlobUrl) {
    return (
      <div className="voice-recorder-preview" role="status" aria-live="polite">
        <div className="voice-recorder-status-copy">
          <span className="voice-recorder-label">Bản ghi sẵn sàng</span>
          <span className="voice-recorder-time">{formatDuration(durationSec)}</span>
        </div>

        <div className="voice-recorder-preview-hint">
          Xem trước và chỉnh sửa trong khung gửi bên trên.
        </div>

        <div className="voice-recorder-preview-actions">
          <button
            type="button"
            className="voice-recorder-btn"
            onClick={handleDeleteReady}
            aria-label="Delete voice recording"
            disabled={disabled}
          >
            <FaTrash />
          </button>
          <button
            type="button"
            className="voice-recorder-btn voice-recorder-btn-retry"
            onClick={handleReRecord}
            aria-label="Re-record voice"
            disabled={disabled}
          >
            <FaRedo />
          </button>
        </div>

        {error && <div className="voice-recorder-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="voice-recorder-idle-wrap">
      <button
        type="button"
        className="chat-file-btn voice-recorder-trigger"
        onClick={handleStart}
        disabled={disabled}
        aria-label="Record voice message"
        title="Record voice message"
      >
        <FaMicrophone className="input-action-icon" />
      </button>

      {error && <div className="voice-recorder-error voice-recorder-error--idle">{error}</div>}
    </div>
  );
}

export default VoiceRecorder;
