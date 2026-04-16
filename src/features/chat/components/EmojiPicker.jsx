import { useEffect, useRef } from "react";
import "emoji-picker-element";

function EmojiPicker({ onSelectEmoji, onClose }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleDocumentPointerDown = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    const pickerElement = pickerRef.current;

    const handleEmojiClick = (event) => {
      onSelectEmoji?.(event.detail?.unicode || "");
      onClose?.();
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    if (pickerElement) {
      pickerElement.addEventListener("emoji-click", handleEmojiClick);
    }

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);

      if (pickerElement) {
        pickerElement.removeEventListener("emoji-click", handleEmojiClick);
      }
    };
  }, [onClose]);

  return (
    <div className="emoji-picker-popover" ref={pickerRef}>
      <emoji-picker />
    </div>
  );
}

export default EmojiPicker;