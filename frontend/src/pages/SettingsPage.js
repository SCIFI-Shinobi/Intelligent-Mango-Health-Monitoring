import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/formatTime';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export default function SettingsPage() {
  const { lang, t } = useLanguage();
  const token = localStorage.getItem('token');

  const [settings, setSettings] = useState({
    minTemperature: 15,
    maxTemperature: 35,
    minHumidity: 30,
    maxHumidity: 90,
    enableNotifications: true
  });

  const [saved, setSaved] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

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
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

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

  const handleRegisterDevice = async () => {
    setDeviceLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ device_name: 'ESP32 Gateway' })
      });
      if (res.ok) {
        await fetchDevices();
      }
    } catch (e) {
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

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const apiUrl = `${API_BASE_URL}/data/ingest`;

  return (
    <div className="settings-page">
      {/* Device Connection Section */}
      <div className="settings-section">
        <h3 className="settings-title">
          <i className="fa-solid fa-microchip"></i> {t('settings', 'deviceConnection')}
        </h3>

        <div className="device-api-info">
          <div className="device-field">
            <label>{t('settings', 'apiEndpoint')}</label>
            <div className="copyable-field">
              <code>{apiUrl}</code>
              <button className="copy-btn" onClick={() => copyToClipboard(apiUrl, 'url')}>
                <i className={`fa-solid ${copied === 'url' ? 'fa-check' : 'fa-copy'}`}></i>
              </button>
            </div>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="no-devices">
            <i className="fa-solid fa-plug-circle-xmark"></i>
            <p>{t('settings', 'noDevices')}</p>
            <button className="primary-btn" onClick={handleRegisterDevice} disabled={deviceLoading}>
              <i className="fa-solid fa-plus"></i> {t('settings', 'generateKey')}
            </button>
          </div>
        ) : (
          <div className="device-list">
            {devices.map((device) => (
              <div key={device.id} className="device-card">
                <div className="device-card-header">
                  <div className="device-name-row">
                    <i className="fa-solid fa-microchip device-chip-icon"></i>
                    <span className="device-card-name">{device.device_name}</span>
                  </div>
                  <div className={`device-status ${device.last_seen ? 'online' : 'offline'}`}>
                    <span className="status-indicator"></span>
                    {device.last_seen ? t('settings', 'connected') : t('settings', 'neverConnected')}
                  </div>
                </div>

                <div className="device-field">
                  <label>{t('settings', 'deviceApiKey')}</label>
                  <div className="copyable-field key-field">
                    <code>{device.api_key}</code>
                    <button className="copy-btn" onClick={() => copyToClipboard(device.api_key, `key-${device.id}`)}>
                      <i className={`fa-solid ${copied === `key-${device.id}` ? 'fa-check' : 'fa-copy'}`}></i>
                    </button>
                  </div>
                </div>

                {device.last_seen && (
                  <div className="device-last-seen">
                    <i className="fa-solid fa-clock"></i>
                    {t('settings', 'lastSeen')}: {formatTimeAgo(device.last_seen, lang)}
                  </div>
                )}

                <div className="device-config-hint">
                  <label>{t('settings', 'esp32Config')}</label>
                  <pre className="config-snippet">
{`#define API_URL    "${apiUrl}"
#define DEVICE_KEY "${device.api_key}"

// Add header in HTTP POST:
// http.addHeader("X-Device-Key", DEVICE_KEY);`}
                  </pre>
                </div>

                <div className="device-actions">
                  <button className="secondary-btn small" onClick={() => handleRegenerateKey(device.id)}>
                    <i className="fa-solid fa-rotate"></i> {t('settings', 'regenerateKey')}
                  </button>
                  <button className="danger-btn small" onClick={() => handleDeleteDevice(device.id)}>
                    <i className="fa-solid fa-trash"></i> {t('settings', 'removeDevice')}
                  </button>
                </div>
              </div>
            ))}

            <button className="secondary-btn add-device-btn" onClick={handleRegisterDevice} disabled={deviceLoading}>
              <i className="fa-solid fa-plus"></i> {t('settings', 'addAnother')}
            </button>
          </div>
        )}
      </div>

      {/* Alert Thresholds */}
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

      {/* Notifications */}
      <div className="settings-section">
        <h3 className="settings-title">{t('settings', 'notifications')}</h3>
        <div className="setting-group">
          <label className="checkbox-label">
            <input type="checkbox" checked={settings.enableNotifications} onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)} className="checkbox" />
            <span>{t('settings', 'enablePush')}</span>
          </label>
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
