import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import MangoLeafLogo from './MangoLeafLogo';
import ProfileDropdown from './ProfileDropdown';
import ScanUploadModal from './ScanUploadModal';
import { formatTimeAgo } from '../utils/formatTime';
import { useLanguage } from '../context/LanguageContext';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();
const NOTIFICATION_POLL_INTERVAL_MS = 120000;

const NOTIF_ICONS = {
  disease_alert: 'fa-virus',
  sensor_warning: 'fa-temperature-high',
  recommendation: 'fa-lightbulb',
  system: 'fa-circle-info',
  forecast_alert: 'fa-cloud-sun',
};

const NOTIF_COLORS = {
  disease_alert: '#f85149',
  sensor_warning: '#d29922',
  recommendation: '#2f81f7',
  system: '#8b949e',
  forecast_alert: '#a371f7',
};

export default function Navbar({ activeTab }) {
  const { lang, switchLang, t } = useLanguage();
  const [showQuickScan, setShowQuickScan] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterMode, setFilterMode] = useState('unread');
  const [bellAnimating, setBellAnimating] = useState(false);
  const panelRef = useRef(null);
  const bellAnimationTimerRef = useRef(null);
  const unreadCountRef = useRef(0);
  const hasNotificationSnapshotRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const audioContextRef = useRef(null);
  const token = localStorage.getItem('token');

  const playNotificationChime = useCallback(async () => {
    if (!audioUnlockedRef.current) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (error) {
        return;
      }
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 880, start: 0.0, duration: 0.09, gain: 0.03 },
      { freq: 1174.66, start: 0.11, duration: 0.16, gain: 0.025 },
    ];

    notes.forEach((note) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.freq, now + note.start);

      gainNode.gain.setValueAtTime(0.0001, now + note.start);
      gainNode.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.03);
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();

    const pollIfVisible = () => {
      if (!document.hidden) {
        fetchNotifications();
      }
    };

    const interval = window.setInterval(pollIfVisible, NOTIFICATION_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotifications();
      }
    };

    const handleWindowFocus = () => {
      fetchNotifications();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handleLiveUpdate = () => {
      fetchNotifications();
    };

    window.addEventListener('mangoguard-live-update', handleLiveUpdate);
    return () => window.removeEventListener('mangoguard-live-update', handleLiveUpdate);
  }, [fetchNotifications]);

  useEffect(() => {
    const unlockAudio = async () => {
      audioUnlockedRef.current = true;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      if (audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (error) {
          console.error('Notification audio resume failed:', error);
        }
      }
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!hasNotificationSnapshotRef.current) {
      unreadCountRef.current = unreadCount;
      hasNotificationSnapshotRef.current = true;
      return undefined;
    }

    if (unreadCount > unreadCountRef.current) {
      setBellAnimating(true);
      window.clearTimeout(bellAnimationTimerRef.current);
      bellAnimationTimerRef.current = window.setTimeout(() => {
        setBellAnimating(false);
      }, 1500);
      playNotificationChime();
    }

    unreadCountRef.current = unreadCount;
    return undefined;
  }, [unreadCount, playNotificationChime]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.clearTimeout(bellAnimationTimerRef.current);
    };
  }, []);

  const handleBellClick = () => {
    setShowPanel(!showPanel);
    if (!showPanel) fetchNotifications();
  };

  const markAsRead = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const navLinks = [
    { id: 'home', path: '/dashboard', labelKey: 'dashboard', icon: 'fa-house' },
    { id: 'analysis', path: '/analysis', labelKey: 'analysis', icon: 'fa-chart-line' },
    { id: 'logs', path: '/logs', labelKey: 'logs', icon: 'fa-clipboard-list' },
    { id: 'settings', path: '/settings', labelKey: 'settings', icon: 'fa-sliders' },
  ];

  const visibleNotifications = filterMode === 'unread'
    ? notifications.filter((notification) => !notification.read)
    : notifications;

  return (
    <div className="navbar">
      <div className="navbar-left">
        <MangoLeafLogo size={36} />
        <span className="app-title">MangoGuard</span>
      </div>

      <div className="navbar-center">
        {navLinks.map((link) => (
          <NavLink
            key={link.id}
            to={link.path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <i className={`fa-solid ${link.icon}`}></i>
            <span>{t('nav', link.labelKey)}</span>
          </NavLink>
        ))}
      </div>

      <div className="navbar-right" ref={panelRef}>
        {/* Language Toggle - Same as Login Page */}
        <div className="lang-toggle">
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => switchLang('en')}>EN</button>
          <button className={`lang-btn ${lang === 'am' ? 'active' : ''}`} onClick={() => switchLang('am')}>አማ</button>
        </div>

        {/* Notification Bell */}
        <div className="notif-bell-wrapper">
          <button
            className={`notif-bell-btn${bellAnimating ? ' bell-animate' : ''}`}
            onClick={handleBellClick}
            title={t('nav', 'notifications') || 'Notifications'}
          >
            <i className="fa-solid fa-bell"></i>
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {showPanel && (
            <div className="notif-panel">
              <div className="notif-panel-header">
                <span className="notif-panel-title">{t('nav', 'notifications') || 'Notifications'}</span>
                <div className="notif-filter-tabs">
                  <button
                    className={`notif-filter-tab${filterMode === 'unread' ? ' active' : ''}`}
                    onClick={() => setFilterMode('unread')}
                  >
                    {t('nav', 'unread') || 'Unread'}
                  </button>
                  <button
                    className={`notif-filter-tab${filterMode === 'all' ? ' active' : ''}`}
                    onClick={() => setFilterMode('all')}
                  >
                    {t('nav', 'all') || 'All'}
                  </button>
                </div>
                {unreadCount > 0 && (
                  <button className="notif-mark-all-btn" onClick={markAllRead}>
                    {t('nav', 'markAllRead') || 'Mark all read'}
                  </button>
                )}
              </div>

              <div className="notif-list">
                {visibleNotifications.length === 0 ? (
                  <div className="notif-empty">
                    <i className="fa-solid fa-bell-slash"></i>
                    <span>{t('nav', 'noNotifications') || 'No notifications'}</span>
                  </div>
                ) : (
                  visibleNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notif-item${notif.read ? '' : ' unread'}`}
                      onClick={() => !notif.read && markAsRead(notif.id)}
                    >
                      <div
                        className="notif-icon"
                        style={{ color: NOTIF_COLORS[notif.type] || '#8b949e' }}
                      >
                        <i className={`fa-solid ${NOTIF_ICONS[notif.type] || 'fa-circle-info'}`}></i>
                      </div>
                      <div className="notif-body">
                        <span className="notif-message">{notif.message}</span>
                        <span className="notif-time">{formatTimeAgo(notif.created_at)}</span>
                      </div>
                      {!notif.read && <div className="notif-unread-dot"></div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <ProfileDropdown />
      </div>
    </div>
  );
}
