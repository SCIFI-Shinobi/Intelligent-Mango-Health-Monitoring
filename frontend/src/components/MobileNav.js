import React, { useState, useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { AuthContext } from '../context/AuthContext';
import ScanUploadModal from './ScanUploadModal';

export default function MobileNav({ activeTab }) {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [showQuickScan, setShowQuickScan] = useState(false);

  const isAdminPath = location.pathname.startsWith('/admin');

  const tabs = user?.username === 'admin'
    ? (isAdminPath 
        ? [
            { id: 'users', path: '/admin?tab=users', labelKey: 'users', icon: 'fa-users', position: 'left' },
            { id: 'scans', path: '/admin?tab=scans', labelKey: 'logs', icon: 'fa-clipboard-list', position: 'left-center' },
            { id: 'training', path: '/admin?tab=training', labelKey: 'training', icon: 'fa-flask', position: 'right-center' },
            { id: 'settings', path: '/admin?tab=settings', labelKey: 'settings', icon: 'fa-gears', position: 'right' },
          ]
        : [
            { id: 'home', path: '/dashboard', labelKey: 'home', icon: 'fa-house', position: 'left' },
            { id: 'admin', path: '/admin', labelKey: 'admin', icon: 'fa-shield-halved', position: 'left-center' },
            { id: 'settings', path: '/settings', labelKey: 'settings', icon: 'fa-sliders', position: 'right-center' },
          ])
    : [
        { id: 'home', path: '/dashboard', labelKey: 'home', icon: 'fa-house', position: 'left' },
        { id: 'analysis', path: '/analysis', labelKey: 'analysis', icon: 'fa-chart-line', position: 'left-center' },
        { id: 'logs', path: '/logs', labelKey: 'logs', icon: 'fa-clipboard-list', position: 'right-center' },
        { id: 'settings', path: '/settings', labelKey: 'settings', icon: 'fa-sliders', position: 'right' },
      ];

  // Helper to split tabs around the center button
  const leftTabs = tabs.filter(tab => tab.position.startsWith('left'));
  const rightTabs = tabs.filter(tab => tab.position.startsWith('right'));

  return (
    <div className="mobile-nav">
      {leftTabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          className={({ isActive }) => {
            // Special handling for admin tab params
            const isTabActive = tab.path.includes('?tab=') 
              ? location.search.includes(tab.path.split('?')[1])
              : isActive;
            return `mobile-nav-btn ${isTabActive ? 'active' : ''}`;
          }}
          title={t('nav', tab.labelKey)}
          data-position={tab.position}
        >
          <i className={`fa-solid ${tab.icon}`}></i>
          <span>{t('nav', tab.labelKey)}</span>
        </NavLink>
      ))}

      <button
        className="mobile-nav-scan-btn"
        onClick={() => setShowQuickScan(true)}
        title={t('nav', 'scanForDisease') || 'Scan for Disease'}
        aria-label={t('nav', 'scanForDisease') || 'Scan for Disease'}
      >
        <i className="fa-solid fa-plus"></i>
      </button>

      {rightTabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          className={({ isActive }) => {
            const isTabActive = tab.path.includes('?tab=') 
              ? location.search.includes(tab.path.split('?')[1])
              : isActive;
            return `mobile-nav-btn ${isTabActive ? 'active' : ''}`;
          }}
          title={t('nav', tab.labelKey)}
          data-position={tab.position}
        >
          <i className={`fa-solid ${tab.icon}`}></i>
          <span>{t('nav', tab.labelKey)}</span>
        </NavLink>
      ))}

      {showQuickScan && <ScanUploadModal onClose={() => setShowQuickScan(false)} />}
    </div>
  );
}
