import { useEffect, useMemo, useState } from "react";

const MIN_OPTIONS = 2;

const createEmptyOptions = () => ["", ""];

function PollComposer({ isOpen, onClose, onSubmit, isSubmitting = false }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(createEmptyOptions);

  useEffect(() => {
    if (!isOpen) {
      setQuestion("");
      setOptions(createEmptyOptions());
    }
  }, [isOpen]);

  const trimmedOptions = useMemo(
    () => options.map((option) => String(option || "").trim()),
    [options]
  );

  const isSubmitDisabled =
    isSubmitting ||
    !String(question || "").trim() ||
    trimmedOptions.length < MIN_OPTIONS ||
    trimmedOptions.some((option) => !option);

  const handleOptionChange = (index, value) => {
    setOptions((prev) => prev.map((option, idx) => (idx === index ? value : option)));
  };

  const handleAddOption = () => {
    setOptions((prev) => [...prev, ""]);
  };

  const handleRemoveOption = (index) => {
    setOptions((prev) => {
      if (prev.length <= MIN_OPTIONS) {
        return prev;
      }

      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitDisabled) return;

    await onSubmit?.({
      question: String(question || "").trim(),
      options: trimmedOptions
    });
  };

  if (!isOpen) return null;

  return (
    <div className="group-modal-overlay">
      <div className="group-modal" role="dialog" aria-modal="true" aria-label="Tạo poll">
        <div className="group-modal-header">
          <h3>Tạo poll</h3>
          <button
            type="button"
            className="group-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <form className="group-modal-body" onSubmit={handleSubmit}>
          <input
            type="text"
            className="group-name-input"
            placeholder="Nhập câu hỏi"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={isSubmitting}
          />

          <div className="poll-option-input-list">
            {options.map((option, index) => (
              <div key={`poll-option-${index}`} className="poll-option-input-row">
                <input
                  type="text"
                  className="group-name-input"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(event) => handleOptionChange(index, event.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="remove-poll-option-btn"
                  onClick={() => handleRemoveOption(index)}
                  disabled={isSubmitting || options.length <= MIN_OPTIONS}
                  aria-label={`Xóa option ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-poll-option-btn"
            onClick={handleAddOption}
            disabled={isSubmitting}
          >
            Thêm option
          </button>

          <div className="group-modal-footer">
            <button
              type="button"
              className="group-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button type="submit" className="group-create-btn" disabled={isSubmitDisabled}>
              {isSubmitting ? "Đang tạo..." : "Tạo poll"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PollComposer;
