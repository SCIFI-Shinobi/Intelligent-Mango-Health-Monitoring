import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();
const DEVICE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const TEMPERATURE_OPTIONS = [
  { value: 'celsius', labelKey: 'celsius', icon: 'C', accentClass: 'cool' },
  { value: 'fahrenheit', labelKey: 'fahrenheit', icon: 'F', accentClass: 'warm' }
];
const TIME_FORMAT_OPTIONS = [
  { value: 'relative', labelKey: 'relative', exampleKey: 'relativeExample', iconClass: 'fa-solid fa-clock-rotate-left', accentClass: 'fresh' },
  { value: 'absolute', labelKey: 'absolute', exampleKey: 'absoluteExample', iconClass: 'fa-solid fa-calendar-check', accentClass: 'calm' }
];
const REFRESH_OPTIONS = [
  { value: 1, label: '1m', iconClass: 'fa-solid fa-stopwatch' },
  { value: 5, label: '5m', iconClass: 'fa-solid fa-clock' },
  { value: 15, label: '15m', iconClass: 'fa-solid fa-rotate' },
  { value: 30, label: '30m', iconClass: 'fa-solid fa-hourglass-half' },
  { value: 60, label: '1h', iconClass: 'fa-solid fa-business-time' },
  { value: 0, dynamicLabelKey: 'manual', iconClass: 'fa-solid fa-hand-pointer' }
];

function parseApiDate(value) {
  if (!value) return null;

  const normalized = typeof value === 'string' && !value.endsWith('Z') ? `${value}Z` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function SectionIntro({ iconClass, title }) {
  return (
    <div className="settings-section-intro">
      <div className="settings-section-icon">
        <i className={iconClass} aria-hidden="true"></i>
      </div>
      <div>
        <h3 className="settings-section-title">{title}</h3>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { lang, switchLang, t } = useLanguage();
  const { settings, updateSettings } = useSettings();
  const token = localStorage.getItem('token');
  const ts = (key) => t('settings', key);

  // Local state to hold changes until 'Save' is pressed
  const [localSettings, setLocalSettings] = useState(settings);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSettingChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSaveSettings = async () => {
    try {
      setError(null);
      await updateSettings(localSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message || ts('unknownError'));
    }
  };

  const selectedRefreshLabel = localSettings.autoRefreshInterval
    ? `${ts('every')} ${localSettings.autoRefreshInterval}m`
    : ts('manual');

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <p className="settings-page-eyebrow">{t('nav', 'settings')}</p>
          <h2 className="settings-page-title">{ts('general')}</h2>
        </div>
      </div>

      {/* Device Management section removed for regular users to simplify interface */}


      {/* General Settings */}
      <div className="settings-section settings-card">
        <SectionIntro iconClass="fa-solid fa-globe" title={ts('language')} />

        {/* Language Toggle Buttons */}
        <div className="settings-choice-grid two-up compact-frame">
          {[
            {value: 'en', label: ts('english'), flag: 'EN'},
            {value: 'am', label: ts('amharic'), flag: 'AM'}
          ].map(option => (
            <button
              key={option.value}
              onClick={() => switchLang(option.value)}
              className={`settings-option-card centered ${lang === option.value ? 'selected accent-blue' : ''}`}
            >
              <span className="settings-option-flag">{option.flag}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Display Preferences */}
      <div className="settings-section settings-card">
        <SectionIntro iconClass="fa-solid fa-paintbrush" title={ts('displayPreferences')} />

        {/* Temperature Unit */}
        <div className="settings-control-group with-divider">
          <label className="settings-field-label">{ts('temperatureUnit')}</label>
          <div className="settings-choice-grid two-up">
            {TEMPERATURE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSettingChange('temperatureUnit', opt.value)}
                className={`settings-option-card centered ${localSettings.temperatureUnit === opt.value ? `selected accent-${opt.accentClass}` : ''}`}
              >
                <div className="settings-option-icon-text">{opt.icon}</div>
                <div className="settings-option-caption">{ts(opt.labelKey)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time Format */}
        <div className="settings-control-group">
          <label className="settings-field-label">{ts('timeFormat')}</label>
          <div className="settings-choice-grid two-up">
            {TIME_FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSettingChange('timeFormat', opt.value)}
                className={`settings-option-card centered ${localSettings.timeFormat === opt.value ? `selected accent-${opt.accentClass}` : ''}`}
              >
                <div className="settings-option-icon-wrap">
                  <i className={opt.iconClass} aria-hidden="true"></i>
                </div>
                <div className="settings-option-caption strong">{ts(opt.labelKey)}</div>
                <div className="settings-option-meta">{ts(opt.exampleKey)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Synchronization Removed for user simplicity */}

      {/* Notifications */}
      <div className="settings-section settings-card">
        <SectionIntro iconClass="fa-solid fa-bell" title={ts('notificationsAlerts')} />

        {/* Enable Notifications Toggle */}
        <div className="settings-toggle-row">
          <div>
            <p className="settings-toggle-title">{ts('pushNotifications')}</p>
            <p className="settings-toggle-description">{ts('pushNotificationsDesc')}</p>
          </div>
          <button
            onClick={() => handleSettingChange('enableNotifications', !localSettings.enableNotifications)}
            className={`settings-toggle ${localSettings.enableNotifications ? 'enabled' : ''}`}
          >
            <span></span>
          </button>
        </div>

        {/* Confidence Threshold */}
        <div className="settings-control-group">
          <label className="settings-field-label">{ts('confidenceThreshold')}</label>
          <p className="settings-field-hint">{ts('confidenceHint')}</p>

          <div className="settings-slider-row">
            <div className="settings-slider-wrap">
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={localSettings.diseaseConfidenceThreshold}
                onChange={(e) => handleSettingChange('diseaseConfidenceThreshold', parseInt(e.target.value))}
                className="settings-slider-input"
              />
              <style>{`
                .settings-slider-input::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #2f81f7;
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.4);
                  border: 2px solid #fff;
                }
                .settings-slider-input::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: #2f81f7;
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.4);
                  border: 2px solid #fff;
                }
              `}</style>
            </div>
            <div className="settings-slider-value">
              {localSettings.diseaseConfidenceThreshold}%
            </div>
          </div>

          <div className="settings-threshold-legend">
            <div className="low">
              <i className="fa-solid fa-circle"></i> {ts('low')} ({50}%)
            </div>
            <div className="medium">
              <i className="fa-solid fa-circle"></i> {ts('medium')} ({75}%)
            </div>
            <div className="high">
              <i className="fa-solid fa-circle"></i> {ts('high')} ({95}%)
            </div>
          </div>
        </div>
      </div>

      <div className="settings-actions professional">
        <button
          className="settings-save-btn"
          onClick={handleSaveSettings}
        >
          <i className="fa-solid fa-floppy-disk"></i> {ts('saveChanges')}
        </button>
        {saved && (
          <div className="settings-save-success">
            <i className="fa-solid fa-check-circle"></i> {ts('allChangesSaved')}
          </div>
        )}
      </div>
    </div>
  );
}

