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
  FaTimes
} from "react-icons/fa";
import { MdCheckBox, MdCheckBoxOutlineBlank } from "react-icons/md";

function RightPanel({ openGroupModal }) {
  return (
    <div className="right-panel">
      <div className="panel-box">
        <div className="panel-header">
          <h4>Chat Files</h4>
          <FaTimes className="panel-top-icon" />
        </div>

        <div className="panel-item">
          <div className="panel-item-left">
            <FaImage className="panel-item-icon dark-icon" />
            <span>128 Photos</span>
          </div>
          <FaChevronDown className="panel-item-arrow" />
        </div>

        <div className="panel-divider"></div>

        <div className="panel-item">
          <div className="panel-item-left">
            <FaLink className="panel-item-icon dark-icon" />
            <span>13 Links</span>
          </div>
          <FaChevronDown className="panel-item-arrow" />
        </div>

        <div className="panel-divider"></div>

        <div className="panel-item">
          <div className="panel-item-left">
            <FaFileAlt className="panel-item-icon dark-icon" />
            <span>72 attachments</span>
          </div>
          <FaChevronDown className="panel-item-arrow" />
        </div>
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
