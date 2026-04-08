import { FaSearch, FaSortAlphaDown, FaFilter } from "react-icons/fa";

function ContactsHeader({ searchTerm, onSearchTermChange, sortType, onSortTypeChange, filterType, onFilterTypeChange }) {
  return (
    <div className="contacts-header">
      <div className="contacts-search-wrap">
        <FaSearch className="contacts-search-icon" />
        <input
          type="text"
          className="contacts-search"
          placeholder="Tìm bạn"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>

      <div className="contacts-header-controls">
        <label className="contacts-select-wrap">
          <FaSortAlphaDown className="contacts-select-icon" />
          <select value={sortType} onChange={(e) => onSortTypeChange(e.target.value)}>
            <option value="asc">A-Z</option>
            <option value="desc">Z-A</option>
          </select>
        </label>

        <label className="contacts-select-wrap">
          <FaFilter className="contacts-select-icon" />
          <select value={filterType} onChange={(e) => onFilterTypeChange(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="online">Online</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export default ContactsHeader;
