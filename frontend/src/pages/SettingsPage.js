import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsPage() {
  const { t } = useLanguage();

  const [settings, setSettings] = useState({
    minTemperature: 15,
    maxTemperature: 35,
    minHumidity: 30,
    maxHumidity: 90,
    enableNotifications: true
  });

  const [saved, setSaved] = useState(false);
  const [systemInfo] = useState({
    firmwareVersion: '1.2.3',
    lastSync: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
    deviceId: 'MANGO-ESP32-001'
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('mangaguard-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: typeof value === 'string' ? parseFloat(value) : value
    }));
    setSaved(false);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('mangaguard-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="settings-page">
      <div className="settings-section">
        <h3 className="settings-title">{t('settings', 'alertThresholds')}</h3>

        <div className="setting-group">
          <label>{t('settings', 'minTemp')}</label>
          <div className="slider-container">
            <input type="range" min="-10" max="50" value={settings.minTemperature} onChange={(e) => handleSettingChange('minTemperature', e.target.value)} className="slider" />
            <span className="value-display">{settings.minTemperature}°C</span>
          </div>
        </div>

        <div className="setting-group">
          <label>{t('settings', 'maxTemp')}</label>
          <div className="slider-container">
            <input type="range" min="-10" max="50" value={settings.maxTemperature} onChange={(e) => handleSettingChange('maxTemperature', e.target.value)} className="slider" />
            <span className="value-display">{settings.maxTemperature}°C</span>
          </div>
        </div>

        <div className="setting-group">
          <label>{t('settings', 'minHumidity')}</label>
          <div className="slider-container">
            <input type="range" min="0" max="100" value={settings.minHumidity} onChange={(e) => handleSettingChange('minHumidity', e.target.value)} className="slider" />
            <span className="value-display">{settings.minHumidity}%</span>
          </div>
        </div>

        <div className="setting-group">
          <label>{t('settings', 'maxHumidity')}</label>
          <div className="slider-container">
            <input type="range" min="0" max="100" value={settings.maxHumidity} onChange={(e) => handleSettingChange('maxHumidity', e.target.value)} className="slider" />
            <span className="value-display">{settings.maxHumidity}%</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">{t('settings', 'notifications')}</h3>
        <div className="setting-group">
          <label className="checkbox-label">
            <input type="checkbox" checked={settings.enableNotifications} onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)} className="checkbox" />
            <span>{t('settings', 'enablePush')}</span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">{t('settings', 'systemInfo')}</h3>
        <div className="info-group">
          <div className="info-item">
            <span className="info-label">{t('settings', 'deviceId')}</span>
            <span className="info-value">{systemInfo.deviceId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings', 'firmware')}</span>
            <span className="info-value">{systemInfo.firmwareVersion}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('settings', 'lastSync')}</span>
            <span className="info-value">{systemInfo.lastSync}</span>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button className="primary-btn" onClick={handleSaveSettings}>
          {t('settings', 'save')}
        </button>
        {saved && <span className="save-confirmation">✓ {t('settings', 'saved')}</span>}
      </div>
    </div>
  );
}
