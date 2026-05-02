import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import ScanUploadModal from './ScanUploadModal';

export default function MobileNav({ activeTab, onTabChange }) {
  const { t } = useLanguage();
  const [showQuickScan, setShowQuickScan] = useState(false);

  const tabs = [
    { id: 'home', labelKey: 'home', icon: 'fa-house', position: 'left' },
    { id: 'analysis', labelKey: 'analysis', icon: 'fa-chart-line', position: 'left-center' },
    { id: 'logs', labelKey: 'logs', icon: 'fa-clipboard-list', position: 'right-center' },
    { id: 'settings', labelKey: 'settings', icon: 'fa-sliders', position: 'right' },
  ];

  return (
    <div className="mobile-nav">
      {tabs.slice(0, 2).map((tab) => (
        <button
          key={tab.id}
          className={`mobile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={t('nav', tab.labelKey)}
          data-position={tab.position}
        >
          <i className={`fa-solid ${tab.icon}`}></i>
          <span>{t('nav', tab.labelKey)}</span>
        </button>
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
        <button
          key={tab.id}
          className={`mobile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={t('nav', tab.labelKey)}
          data-position={tab.position}
        >
          <i className={`fa-solid ${tab.icon}`}></i>
          <span>{t('nav', tab.labelKey)}</span>
        </button>
      ))}

      {showQuickScan && <ScanUploadModal onClose={() => setShowQuickScan(false)} />}
    </div>
  );
}
