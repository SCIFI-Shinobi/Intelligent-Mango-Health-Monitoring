import React, { useState, useRef, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function ProfileDropdown() {
  const { user, logout, userLoading } = useContext(AuthContext);
  const { t } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get display name or fallback to username
  const displayName = user?.display_name || user?.username || 'User';

  // Get initials for avatar
  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
  };

  if (userLoading) {
    return <div className="profile-loading"><i className="fa-solid fa-spinner fa-spin"></i></div>;
  }

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      <button
        className="profile-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
        title={displayName}
      >
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={displayName} className="profile-avatar" />
        ) : (
          <div className="profile-avatar-initials">
            {getInitials(displayName)}
          </div>
        )}
        <span className="profile-name">{displayName}</span>
        <i className={`fa-solid fa-chevron-${showDropdown ? 'up' : 'down'}`}></i>
      </button>

      {showDropdown && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-header">
            <span className="profile-dropdown-username">@{user?.username}</span>
            <span className="profile-dropdown-email">{user?.email || t('profile', 'noEmail')}</span>
          </div>

          <div className="profile-dropdown-divider"></div>

          <Link to="/user" className="profile-dropdown-item" onClick={() => setShowDropdown(false)}>
            <i className="fa-solid fa-user"></i>
            <span>{t('profile', 'viewProfile')}</span>
          </Link>

          <div className="profile-dropdown-divider"></div>

          <button className="profile-dropdown-item logout" onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>{t('nav', 'logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
