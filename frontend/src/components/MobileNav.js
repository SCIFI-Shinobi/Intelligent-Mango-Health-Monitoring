import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function MobileNav({ activeTab, onTabChange }) {
  const { t } = useLanguage();

  const tabs = [
    { id: 'home', labelKey: 'home', icon: 'fa-house' },
    { id: 'analysis', labelKey: 'analysis', icon: 'fa-chart-line' },
    { id: 'logs', labelKey: 'logs', icon: 'fa-clipboard-list' },
    { id: 'settings', labelKey: 'settings', icon: 'fa-sliders' }
  ];

  return (
    <div className="mobile-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`mobile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={t('nav', tab.labelKey)}
        >
          <i className={`fa-solid ${tab.icon}`}></i>
          <span>{t('nav', tab.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
