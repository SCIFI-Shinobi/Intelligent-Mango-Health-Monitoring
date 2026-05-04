import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();

export default function ProfilePage() {
  const { user, updateUser, logout } = useContext(AuthContext);
  const { t } = useLanguage();
  const token = localStorage.getItem('token');
  const fileInputRef = useRef(null);

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const [newAvatarData, setNewAvatarData] = useState(null);

  // Password form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getInitials = (name) => {
    return (name || user?.username || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('profile', 'invalidImageType'));
      return;
    }
    if (file.size > 1024 * 1024) { // 1MB limit
      setError(t('profile', 'imageTooLarge'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
      setNewAvatarData(reader.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        display_name: displayName || null,
        email: email || null,
      };

      if (newAvatarData) {
        payload.avatar_url = newAvatarData;
      }

      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || t('profile', 'saveFailed'));
      }

      const updatedUser = await res.json();
      updateUser(updatedUser);
      setSuccess(t('profile', 'profileSaved'));
      setNewAvatarData(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError(t('profile', 'passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setError(t('profile', 'passwordTooShort'));
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/profile/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || t('profile', 'passwordChangeFailed'));
      }

      setSuccess(t('profile', 'passwordChanged'));
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="section-header">
        <span className="section-title">{t('profile', 'title')}</span>
      </div>

      <div className="profile-content-card">
        <div className="profile-avatar-section">
          <div className="profile-avatar-large" onClick={handleAvatarClick}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" />
            ) : (
              <span className="avatar-initials-large">{getInitials(displayName)}</span>
            )}
            <div className="avatar-edit-overlay">
              <i className="fa-solid fa-camera"></i>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <span className="avatar-hint">{t('profile', 'clickToUpload')}</span>
        </div>

        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}

        <div className="profile-form">
          <div className="profile-form-group">
            <label>{t('profile', 'displayName')}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('profile', 'enterDisplayName')}
            />
          </div>

          <div className="profile-form-group">
            <label>{t('auth', 'username')}</label>
            <input type="text" value={user?.username || ''} disabled className="disabled" />
            <span className="field-hint">{t('profile', 'usernameCannotChange')}</span>
          </div>

          <div className="profile-form-group">
            <label>{t('auth', 'email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth', 'enterEmail')}
            />
          </div>

          <button
            className="primary-btn save-profile-btn"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? t('auth', 'pleaseWait') : t('profile', 'saveProfile')}
          </button>
        </div>

        <div className="profile-password-section">
          <button
            className="secondary-btn toggle-password-btn"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            <i className="fa-solid fa-key"></i>
            {t('profile', 'changePassword')}
          </button>

          {showPasswordForm && (
            <div className="password-form">
              <div className="profile-form-group">
                <label>{t('profile', 'currentPassword')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="profile-form-group">
                <label>{t('profile', 'newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="profile-form-group">
                <label>{t('profile', 'confirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                className="primary-btn"
                onClick={handleChangePassword}
                disabled={saving}
              >
                {t('profile', 'updatePassword')}
              </button>
            </div>
          )}
        </div>
        
        <div className="profile-page-footer">
          <button className="danger-btn logout-btn" onClick={logout}>
            <i className="fa-solid fa-right-from-bracket"></i>
            {t('nav', 'logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
