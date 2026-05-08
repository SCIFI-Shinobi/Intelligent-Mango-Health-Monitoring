import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import ScanUploadModal from './ScanUploadModal';

export default function MobileNav({ activeTab }) {
  const { t } = useLanguage();
  const [showQuickScan, setShowQuickScan] = useState(false);

  const tabs = [
    { id: 'home', path: '/dashboard', labelKey: 'home', icon: 'fa-house', position: 'left' },
    { id: 'analysis', path: '/analysis', labelKey: 'analysis', icon: 'fa-chart-line', position: 'left-center' },
    { id: 'logs', path: '/logs', labelKey: 'logs', icon: 'fa-clipboard-list', position: 'right-center' },
    { id: 'settings', path: '/settings', labelKey: 'settings', icon: 'fa-sliders', position: 'right' },
    { id: 'user', path: '/user', labelKey: 'profile', icon: 'fa-user', position: 'far-right' },
  ];

  return (
    <div className="mobile-nav">
      {tabs.slice(0, 2).map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
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

      {tabs.slice(2).map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
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
