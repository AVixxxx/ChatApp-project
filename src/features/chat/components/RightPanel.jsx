import { useMemo, useState } from "react";
import {
  FaImage,
  FaLink,
  FaFileAlt,
  FaUserFriends,
  FaCamera,
  FaMicrophone,
  FaTrashAlt,
  FaUserPlus,
  FaChevronDown,
  FaChevronUp,
  FaTimes,
  FaFilePdf,
  FaFileWord
} from "react-icons/fa";
import { MdCheckBox, MdCheckBoxOutlineBlank } from "react-icons/md";

const getFileExtension = (fileName) => {
  const safeName = String(fileName || "").trim().toLowerCase();
  if (!safeName || !safeName.includes(".")) return "";
  return safeName.split(".").pop() || "";
};

const getFilePresentation = (fileName) => {
  const extension = getFileExtension(fileName);

  if (extension === "pdf") {
    return {
      Icon: FaFilePdf,
      iconClassName: "message-file-icon message-file-icon--pdf"
    };
  }

  if (extension === "docx" || extension === "doc") {
    return {
      Icon: FaFileWord,
      iconClassName: "message-file-icon message-file-icon--word"
    };
  }

  return {
    Icon: FaFileAlt,
    iconClassName: "message-file-icon"
  };
};

function RightPanel({
  openGroupModal,
  sharedMedia,
  isSharedMediaLoading = false,
  selectedConversationId
}) {
  const [isPhotosOpen, setIsPhotosOpen] = useState(true);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [isFilesOpen, setIsFilesOpen] = useState(true);

  const photoItems = Array.isArray(sharedMedia?.images) ? sharedMedia.images : [];
  const fileItems = Array.isArray(sharedMedia?.files) ? sharedMedia.files : [];

  const fileEntries = useMemo(
    () => fileItems.slice(0, 6),
    [fileItems]
  );

  const renderSectionArrow = (isOpen) =>
    isOpen ? <FaChevronUp className="panel-item-arrow" /> : <FaChevronDown className="panel-item-arrow" />;

  return (
    <div className="right-panel">
      <div className="panel-box">
        <div className="panel-header">
          <h4>Chat Files</h4>
          <FaTimes className="panel-top-icon" />
        </div>

        <button
          type="button"
          className="panel-item panel-item-button"
          onClick={() => setIsPhotosOpen((prev) => !prev)}
        >
          <div className="panel-item-left">
            <FaImage className="panel-item-icon dark-icon" />
            <span>{photoItems.length} Photos</span>
          </div>
          {renderSectionArrow(isPhotosOpen)}
        </button>

        {isPhotosOpen && (
          <div className="panel-media-content">
            {!selectedConversationId ? (
              <p className="panel-empty-state">Select a conversation</p>
            ) : isSharedMediaLoading ? (
              <p className="panel-empty-state">Loading photos...</p>
            ) : photoItems.length === 0 ? (
              <p className="panel-empty-state">No shared photos</p>
            ) : (
              <div className="panel-photo-grid">
                {photoItems.slice(0, 9).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="panel-photo-thumb"
                    title={item.filename || "Open image"}
                  >
                    <img src={item.url} alt={item.filename || "Shared photo"} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="panel-divider"></div>

        <button
          type="button"
          className="panel-item panel-item-button"
          onClick={() => setIsLinksOpen((prev) => !prev)}
        >
          <div className="panel-item-left">
            <FaLink className="panel-item-icon dark-icon" />
            <span>Links</span>
          </div>
          {renderSectionArrow(isLinksOpen)}
        </button>

        {isLinksOpen && (
          <div className="panel-media-content">
            <p className="panel-empty-state">Shared links are not available yet</p>
          </div>
        )}

        <div className="panel-divider"></div>

        <button
          type="button"
          className="panel-item panel-item-button"
          onClick={() => setIsFilesOpen((prev) => !prev)}
        >
          <div className="panel-item-left">
            <FaFileAlt className="panel-item-icon dark-icon" />
            <span>{fileItems.length} attachments</span>
          </div>
          {renderSectionArrow(isFilesOpen)}
        </button>

        {isFilesOpen && (
          <div className="panel-media-content">
            {!selectedConversationId ? (
              <p className="panel-empty-state">Select a conversation</p>
            ) : isSharedMediaLoading ? (
              <p className="panel-empty-state">Loading attachments...</p>
            ) : fileItems.length === 0 ? (
              <p className="panel-empty-state">No shared attachments</p>
            ) : (
              <div className="panel-file-list">
                {fileEntries.map((item) => {
                  const fileName = item.filename || "Attachment";
                  const { Icon, iconClassName } = getFilePresentation(fileName);

                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="panel-file-item"
                      title={fileName}
                    >
                      <span className={iconClassName} aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="panel-file-name">{fileName}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel-box">
        <h4>Reminders</h4>

        <label className="panel-check-item">
          <div className="panel-item-left">
            <MdCheckBox className="checkbox-icon checked-box" />
            <span>Design metting 10:30</span>
          </div>
        </label>

        <div className="panel-divider"></div>

        <label className="panel-check-item">
          <div className="panel-item-left">
            <MdCheckBoxOutlineBlank className="checkbox-icon" />
            <span>Create new group for study</span>
          </div>
        </label>

        <div className="panel-divider"></div>

        <label className="panel-check-item">
          <div className="panel-item-left">
            <MdCheckBoxOutlineBlank className="checkbox-icon" />
            <span>Email Erick about Scorriant for e...</span>
          </div>
        </label>
      </div>

      <div className="panel-box">
        <h4>Tool Box</h4>

        <label className="panel-check-item">
          <div className="panel-item-left blue-tool">
            <FaUserFriends className="panel-item-icon" />
            <span>Contact</span>
          </div>
        </label>

        <label className="panel-check-item">
          <div className="panel-item-left blue-tool">
            <FaCamera className="panel-item-icon" />
            <span>Camera</span>
          </div>
        </label>

        <label className="panel-check-item">
          <div className="panel-item-left blue-tool">
            <FaMicrophone className="panel-item-icon" />
            <span>Microphone</span>
          </div>
        </label>

        <label className="panel-check-item">
          <div className="panel-item-left blue-tool">
            <FaTrashAlt className="panel-item-icon" />
            <span>Delete Chat</span>
          </div>
        </label>

        <label className="panel-check-item" onClick={openGroupModal}>
          <div className="panel-item-left blue-tool">
            <FaUserPlus className="panel-item-icon" />
            <span>Add Group</span>
          </div>
        </label>
      </div>
    </div>
  );
}

export default RightPanel;
