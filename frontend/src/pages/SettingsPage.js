import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';

export default function SettingsPage() {
  const { lang, switchLang, t } = useLanguage();
  const { settings, updateSettings } = useSettings();
  const token = localStorage.getItem('token');

  // Local state to hold changes until 'Save' is pressed
  const [localSettings, setLocalSettings] = useState(settings);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSettingChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSaveSettings = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="settings-page">
      {/* General Settings */}
      <div className="settings-section">
        <h3 className="settings-title"><i className="fa-solid fa-globe"></i> {t('settings', 'general') || 'General Settings'}</h3>
        <div className="setting-group">
          <label>{t('settings', 'language') || 'Language'}</label>
          <select 
            value={lang} 
            onChange={(e) => switchLang(e.target.value)} 
            className="form-input" 
            style={{width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '10px 12px', borderRadius: '6px'}}
          >
            <option value="en">ENGLISH</option>
            <option value="am">አማርኛ (AMHARIC)</option>
          </select>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="settings-section">
        <h3 className="settings-title"><i className="fa-solid fa-paintbrush"></i> {t('settings', 'displayPreferences') || 'Display Preferences'}</h3>
        
        <div className="setting-group">
          <label>{t('settings', 'temperatureUnit') || 'Temperature Unit'}</label>
          <div style={{display: 'flex', gap: '10px', marginTop: '8px'}}>
            <label className="checkbox-label">
              <input type="radio" checked={localSettings.temperatureUnit === 'celsius'} onChange={() => handleSettingChange('temperatureUnit', 'celsius')} className="checkbox" style={{borderRadius: '50%'}} />
              <span>Celsius (°C)</span>
            </label>
            <label className="checkbox-label" style={{marginLeft: '20px'}}>
              <input type="radio" checked={localSettings.temperatureUnit === 'fahrenheit'} onChange={() => handleSettingChange('temperatureUnit', 'fahrenheit')} className="checkbox" style={{borderRadius: '50%'}} />
              <span>Fahrenheit (°F)</span>
            </label>
          </div>
        </div>

        <div className="setting-group" style={{marginTop: '20px'}}>
          <label>{t('settings', 'timeFormat') || 'Time Format'}</label>
          <p className="setting-hint">{t('settings', 'timeFormatHint') || 'How timestamps are displayed on charts and logs.'}</p>
          <div style={{display: 'flex', gap: '10px', marginTop: '8px'}}>
            <label className="checkbox-label">
              <input type="radio" checked={localSettings.timeFormat === 'relative'} onChange={() => handleSettingChange('timeFormat', 'relative')} className="checkbox" style={{borderRadius: '50%'}} />
              <span>Relative (e.g. 5 mins ago)</span>
            </label>
            <label className="checkbox-label" style={{marginLeft: '20px'}}>
              <input type="radio" checked={localSettings.timeFormat === 'absolute'} onChange={() => handleSettingChange('timeFormat', 'absolute')} className="checkbox" style={{borderRadius: '50%'}} />
              <span>Absolute (e.g. 4:30 PM)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Data Synchronization */}
      <div className="settings-section">
        <h3 className="settings-title"><i className="fa-solid fa-rotate"></i> {t('settings', 'dataSync') || 'Data Synchronization'}</h3>
        <div className="setting-group">
          <label>{t('settings', 'autoRefresh') || 'Dashboard Auto-Refresh Interval'}</label>
          <p className="setting-hint">{t('settings', 'autoRefreshHint') || 'How often the dashboard should automatically pull new sensor data.'}</p>
          <select 
            value={localSettings.autoRefreshInterval} 
            onChange={(e) => handleSettingChange('autoRefreshInterval', parseInt(e.target.value))} 
            className="form-input" 
            style={{width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '10px 12px', borderRadius: '6px'}}
          >
            <option value={1}>Every 1 minute</option>
            <option value={5}>Every 5 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 1 hour</option>
            <option value={0}>Manual refresh only</option>
          </select>
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-section">
        <h3 className="settings-title"><i className="fa-solid fa-bell"></i> {t('settings', 'notifications')}</h3>
        <div className="setting-group">
          <label className="checkbox-label">
            <input type="checkbox" checked={localSettings.enableNotifications} onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)} className="checkbox" />
            <span>{t('settings', 'enablePush')}</span>
          </label>
        </div>

        <div className="setting-group">
          <label>{t('settings', 'confidenceThreshold')}</label>
          <p className="setting-hint">{t('settings', 'confidenceHint')}</p>
          <div className="slider-container">
            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={localSettings.diseaseConfidenceThreshold}
              onChange={(e) => handleSettingChange('diseaseConfidenceThreshold', parseInt(e.target.value))}
              className="slider"
            />
            <div className="threshold-input-wrapper">
              <input
                type="number"
                min="50"
                max="95"
                value={localSettings.diseaseConfidenceThreshold}
                onChange={(e) => {
                  const val = Math.min(95, Math.max(50, parseInt(e.target.value) || 50));
                  handleSettingChange('diseaseConfidenceThreshold', val);
                }}
                className="threshold-input"
              />
              <span className="threshold-percent">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-actions" style={{position: 'sticky', bottom: 0, paddingBottom: 20, paddingTop: 10, background: 'linear-gradient(transparent, #161b22 30%)'}}>
        <button className="primary-btn" onClick={handleSaveSettings} style={{width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '14px', fontSize: '16px'}}>
          <i className="fa-solid fa-floppy-disk"></i> {t('settings', 'save')}
        </button>
        {saved && <span className="save-confirmation" style={{textAlign: 'center', display: 'block', marginTop: '10px'}}>✓ {t('settings', 'saved')}</span>}
      </div>
    </div>
  );
}
