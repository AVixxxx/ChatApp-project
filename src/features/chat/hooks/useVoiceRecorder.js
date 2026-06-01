import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MIME_CANDIDATES = [
  "audio/mp4",
  "audio/mpeg"
];

const getSupportedMimeType = () => {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
};

const createAudioFileFromBlob = (blob) => {
  if (!(blob instanceof Blob)) {
    return null;
  }

  const normalizedMimeType = blob.type.includes("mp4")
    ? "audio/m4a"
    : blob.type.includes("mpeg")
      ? "audio/mpeg"
      : "";

  if (!normalizedMimeType) {
    return null;
  }

  const extension = normalizedMimeType === "audio/m4a" ? "m4a" : "mp3";

  const fileName = `voice-${Date.now()}.${extension}`;

  return new File([blob], fileName, {
    type: normalizedMimeType,
    lastModified: Date.now()
  });
};

export const useVoiceRecorder = () => {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const recordedBlobUrlRef = useRef("");

  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState("");
  const [recordedFile, setRecordedFile] = useState(null);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState("");

  const isSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      Boolean(navigator?.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined",
    []
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const clearRecordedPreview = useCallback(() => {
    if (recordedBlobUrlRef.current) {
      URL.revokeObjectURL(recordedBlobUrlRef.current);
      recordedBlobUrlRef.current = "";
    }
    setRecordedBlobUrl("");
    setRecordedFile(null);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    stopTracks();
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    setIsRecording(false);
    setDurationSec(0);
    setError("");
    clearRecordedPreview();
  }, [clearRecordedPreview, clearTimer, stopTracks]);

  const discardRecording = useCallback(() => {
    setError("");
    clearRecordedPreview();
    setDurationSec(0);
  }, [clearRecordedPreview]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Trinh duyet khong ho tro ghi am.");
      return false;
    }

    if (isRecording) {
      return false;
    }

    try {
      setError("");
      clearRecordedPreview();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setError("Trinh duyet khong ho tro dinh dang audio tuong thich may chu (m4a/mp3).");
        stopTracks();
        return false;
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event?.data?.size) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blobType = recorder.mimeType || mimeType;
        const blob = new Blob(chunksRef.current, { type: blobType });
        const nextFile = createAudioFileFromBlob(blob);

        if (!nextFile) {
          setError("Dinh dang ghi am hien tai khong duoc backend ho tro.");
          stopTracks();
          return;
        }

        const nextUrl = URL.createObjectURL(blob);

        if (recordedBlobUrlRef.current) {
          URL.revokeObjectURL(recordedBlobUrlRef.current);
        }
        recordedBlobUrlRef.current = nextUrl;

        setRecordedFile(nextFile);
        setRecordedBlobUrl(nextUrl);
        stopTracks();
      };

      recorder.onerror = () => {
        setError("Khong the ghi am. Vui long thu lai.");
      };

      recorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setDurationSec(0);
      setIsRecording(true);

      clearTimer();
      timerRef.current = window.setInterval(() => {
        setDurationSec(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }, 250);

      return true;
    } catch (recorderError) {
      setError("Khong cap duoc quyen microphone.");
      stopTracks();
      return false;
    }
  }, [clearRecordedPreview, clearTimer, isRecording, isSupported, stopTracks]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return;
    }

    clearTimer();
    setIsRecording(false);
    recorderRef.current.stop();
  }, [clearTimer]);

  useEffect(
    () => () => {
      clearTimer();
      stopTracks();

      if (recordedBlobUrlRef.current) {
        URL.revokeObjectURL(recordedBlobUrlRef.current);
        recordedBlobUrlRef.current = "";
      }
    },
    [clearTimer, stopTracks]
  );

  return {
    isSupported,
    isRecording,
    durationSec,
    error,
    recordedFile,
    recordedBlobUrl,
    startRecording,
    stopRecording,
    discardRecording,
    reset
  };
};
