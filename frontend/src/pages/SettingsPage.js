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
  const [devices, setDevices] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);

  const headers = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/my`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch devices:', e);
    }
  }, [headers]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchDevices();
    }, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDevices();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDevices]);

  const handleRegisterDevice = async () => {
    setDeviceLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ device_name: 'Hardware Gateway' })
      });
      if (res.ok) {
        await fetchDevices();
      } else {
        const errorData = await res.json();
        setError(errorData.detail || ts('failedRegisterDevice'));
        console.error('Device registration failed:', errorData);
      }
    } catch (e) {
      setError(`${ts('networkError')}: ${e.message || ts('unknownError')} (API: ${API_BASE_URL})`);
      console.error('Failed to register device:', e);
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleRegenerateKey = async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${deviceId}/regenerate-key`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        await fetchDevices();
      }
    } catch (e) {
      console.error('Failed to regenerate key:', e);
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        await fetchDevices();
      }
    } catch (e) {
      console.error('Failed to delete device:', e);
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      setError(ts('copyApiKey'));
      console.error('Failed to copy API key:', e);
    }
  };

  const handleSettingChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSaveSettings = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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

      {/* Device Management - Redesigned */}
      <div className="settings-section gateway-section">
        <div className="gateway-header-row">
          <div>
            <p className="settings-page-eyebrow">Hardware</p>
            <h2 className="gateway-heading">
              <i className="fa-solid fa-microchip" aria-hidden="true"></i>{ts('hardwareGateways')}
            </h2>
            <p className="gateway-subheading">{ts('hardwareGatewaysDesc')}</p>
          </div>
          <button
            className="gateway-add-btn"
            onClick={handleRegisterDevice}
            disabled={deviceLoading}
          >
            {deviceLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
            {ts('addGateway')}
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid #f85149',
            borderRadius: '8px',
            color: '#f85149',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>Warning: {error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#f85149',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 4px'
              }}
            >
              Close
            </button>
          </div>
        )}

        {devices.length === 0 ? (
          <div className="gateway-empty-state">
            <div className="gateway-empty-icon">
              <i className="fa-solid fa-wifi"></i>
            </div>
            <h3>{ts('noGatewaysConnectedYet')}</h3>
            <p>{ts('addGatewayHelp')}</p>
            {error && (
              <div className="gateway-inline-error">
                Warning: {error}
              </div>
            )}
          </div>
        ) : (
          <div className="gateway-devices-grid" style={{
            display: 'grid',
            gridTemplateColumns: devices.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
            justifyItems: devices.length === 1 ? 'center' : 'stretch',
            maxWidth: devices.length === 1 ? '400px' : '100%',
            margin: devices.length === 1 ? '0 auto' : '0'
          }}>
            {devices.map(device => {
              const lastSeenDate = parseApiDate(device.last_seen);
              const isOnline = Boolean(lastSeenDate) && (Date.now() - lastSeenDate.getTime()) < DEVICE_ONLINE_WINDOW_MS;
              const deviceStatusClass = isOnline ? 'healthy' : (lastSeenDate ? 'offline' : 'delayed');
              const statusText = isOnline ? ts('online') : (lastSeenDate ? ts('offline') : ts('ready'));

              return (
              <div key={device.id} className="gateway-device-card">
                {/* Status Badge */}
                <div className={`gateway-status status-pill ${deviceStatusClass}`} title={lastSeenDate ? `${ts('lastSeen')} ${lastSeenDate.toLocaleString()}` : ''}>
                  {statusText}
                </div>

                {/* Device Header */}
                <div className="gateway-device-header">
                  <div className="gateway-device-title-row">
                    <i className="fa-solid fa-server" aria-hidden="true"></i>
                    <h4>
                      {device.device_name || ts('gatewayDevice')}
                    </h4>
                  </div>
                  <p>
                    {ts('idLabel')}: {device.id}
                  </p>
                </div>

                {/* API Key Section */}
                <div className="gateway-key-box">
                  <p className="gateway-key-label">
                    {ts('apiKey')}
                  </p>
                  <div className="gateway-key-row">
                    <code className="gateway-key-value">
                      {device.api_key.substring(0, 20)}...
                    </code>
                    <button
                      onClick={() => copyToClipboard(device.api_key, device.id)}
                      className={`gateway-copy-btn ${copied === device.id ? 'copied' : ''}`}
                      title={ts('copyApiKey')}
                    >
                      <i className={`fa-solid ${copied === device.id ? 'fa-check' : 'fa-copy'}`}></i>
                      {copied === device.id ? ` ${ts('copied')}` : ` ${ts('copy')}`}
                    </button>
                  </div>
                </div>

                {/* Setup Instructions */}
                <details className="gateway-setup">
                  <summary>
                    <i className="fa-solid fa-code"></i> {ts('setupInstructions')}
                  </summary>
                  <div className="gateway-setup-body">
                    <p>{ts('setupStep1')}</p>
                    <code>
                      #define API_BASE_URL "your-backend-url"
                    </code>
                    <code>
                      #define DEVICE_API_KEY "{device.api_key}"
                    </code>
                    <p>{ts('setupStep2')}</p>
                  </div>
                </details>

                {/* Action Buttons */}
                <div className="gateway-actions">
                  <button
                    onClick={() => handleRegenerateKey(device.id)}
                    className="gateway-action-btn"
                    title={ts('generateNewApiKey')}
                  >
                    <i className="fa-solid fa-rotate-right"></i> {ts('regenerate')}
                  </button>
                  <button
                    onClick={() => handleDeleteDevice(device.id)}
                    className="gateway-action-btn danger"
                    title={ts('removeGateway')}
                  >
                    <i className="fa-solid fa-trash"></i> {ts('remove')}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

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

      {/* Data Synchronization */}
      <div className="settings-section settings-card">
        <SectionIntro iconClass="fa-solid fa-rotate" title={ts('dataSync')} />

        <label className="settings-field-label">{ts('autoRefreshInterval')}</label>

        <div className="settings-choice-grid three-up">
          {REFRESH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSettingChange('autoRefreshInterval', opt.value)}
              className={`settings-option-card compact centered ${localSettings.autoRefreshInterval === opt.value ? 'selected accent-blue' : ''}`}
            >
              <div className="settings-option-icon-wrap small">
                <i className={opt.iconClass} aria-hidden="true"></i>
              </div>
              <span className="settings-option-caption strong">{opt.dynamicLabelKey ? ts(opt.dynamicLabelKey) : opt.label}</span>
            </button>
          ))}
        </div>
        <p className="settings-selection-note">
          {ts('current')}: <strong>{selectedRefreshLabel}</strong>
        </p>
      </div>

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

