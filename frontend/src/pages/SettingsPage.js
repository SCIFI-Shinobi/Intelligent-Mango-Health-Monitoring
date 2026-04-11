import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();

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

  const headers = React.useMemo(() => ({
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

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
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

  return (
    <div className="settings-page">
      {/* Device Management - Redesigned */}
      <div className="settings-section gateway-section">
        <div className="gateway-header-row" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
          <div>
            <h2 style={{margin: '0 0 4px 0', color: '#c9d1d9', fontSize: '24px', fontWeight: 600}}>
              <i className="fa-solid fa-microchip" style={{marginRight: '12px', color: '#2f81f7'}}></i>{ts('hardwareGateways')}
            </h2>
            <p style={{margin: 0, fontSize: '13px', color: '#8b949e'}}>{ts('hardwareGatewaysDesc')}</p>
          </div>
          <button
            className="gateway-add-btn"
            onClick={handleRegisterDevice}
            disabled={deviceLoading}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #2f81f7 0%, #1f61d7 100%)',
              color: '#fff',
              cursor: deviceLoading ? 'not-allowed' : 'pointer',
              opacity: deviceLoading ? 0.7 : 1,
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(47, 129, 247, 0.3)',
            }}
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
            <span>⚠️ {error}</span>
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
              ✕
            </button>
          </div>
        )}

        {devices.length === 0 ? (
          <div style={{
            padding: '32px 24px',
            background: 'linear-gradient(135deg, rgba(47, 129, 247, 0.08) 0%, rgba(47, 129, 247, 0.02) 100%)',
            borderRadius: '12px',
            border: '2px solid #2f81f7',
            textAlign: 'center',
          }}>
            <div style={{marginBottom: '16px'}}>
              <i className="fa-solid fa-wifi" style={{fontSize: '40px', color: '#2f81f7', opacity: 0.6}}></i>
            </div>
            <h3 style={{margin: '0 0 8px 0', color: '#c9d1d9'}}>{ts('noGatewaysConnectedYet')}</h3>
            <p style={{margin: '0 0 16px 0', color: '#8b949e', fontSize: '14px'}}>
              {ts('addGatewayHelp')}
            </p>
            {error && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'rgba(248, 81, 73, 0.1)',
                border: '1px solid #f85149',
                borderRadius: '6px',
                color: '#f85149',
                fontSize: '12px'
              }}>
                ⚠️ {error}
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
              const lastSeenDate = device.last_seen ? new Date(device.last_seen.endsWith('Z') ? device.last_seen : device.last_seen + 'Z') : null;
              const isOnline = lastSeenDate && (new Date() - lastSeenDate) < 5 * 60 * 1000;
              const statusColor = isOnline ? '#3fb950' : '#8b949e';
              const statusBg = isOnline ? 'rgba(63, 185, 80, 0.15)' : 'rgba(139, 148, 158, 0.15)';
              const statusText = isOnline ? ts('online') : (lastSeenDate ? ts('offline') : ts('ready'));

              return (
              <div
                key={device.id}
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
                  border: '1px solid #30363d',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2f81f7';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(47, 129, 247, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#30363d';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Status Badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: statusBg,
                  border: `1px solid ${statusColor}`,
                  borderRadius: '20px',
                  fontSize: '12px',
                  color: statusColor
                }} title={lastSeenDate ? `${ts('lastSeen')} ${lastSeenDate.toLocaleString()}` : ''}>
                  <span style={{width: '6px', height: '6px', borderRadius: '50%', background: statusColor, display: 'inline-block'}}></span>
                  {statusText}
                </div>

                {/* Device Header */}
                <div style={{marginBottom: '16px', paddingRight: '80px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                    <i className="fa-solid fa-server" style={{color: '#2f81f7', fontSize: '16px'}}></i>
                    <h4 style={{margin: 0, color: '#c9d1d9', fontSize: '16px', fontWeight: 600}}>
                      {device.device_name || ts('gatewayDevice')}
                    </h4>
                  </div>
                  <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e'}}>
                    {ts('idLabel')}: {device.id}
                  </p>
                </div>

                {/* API Key Section */}
                <div style={{
                  background: '#0d1117',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #21262d',
                  marginBottom: '16px',
                }}>
                  <p style={{margin: '0 0 8px 0', fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600}}>
                    {ts('apiKey')}
                  </p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <code style={{
                      color: '#58a6ff',
                      flex: 1,
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      fontSize: '12px',
                      background: '#161b22',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #30363d'
                    }}>
                      {device.api_key.substring(0, 20)}...
                    </code>
                    <button
                      onClick={() => copyToClipboard(device.api_key, device.id)}
                      style={{
                        background: copied === device.id ? '#3fb950' : 'transparent',
                        border: `1px solid ${copied === device.id ? '#3fb950' : '#8b949e'}`,
                        color: copied === device.id ? '#fff' : '#8b949e',
                        cursor: 'pointer',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        transition: 'all 0.2s ease',
                        fontWeight: 500
                      }}
                      title={ts('copyApiKey')}
                    >
                      <i className={`fa-solid ${copied === device.id ? 'fa-check' : 'fa-copy'}`}></i>
                      {copied === device.id ? ` ${ts('copied')}` : ` ${ts('copy')}`}
                    </button>
                  </div>
                </div>

                {/* Setup Instructions */}
                <details style={{
                  marginBottom: '16px',
                  fontSize: '12px'
                }}>
                  <summary style={{
                    cursor: 'pointer',
                    padding: '8px 0',
                    color: '#58a6ff',
                    fontWeight: 500,
                    userSelect: 'none'
                  }}>
                    <i className="fa-solid fa-code"></i> {ts('setupInstructions')}
                  </summary>
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#161b22',
                    borderRadius: '6px',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}>
                    <p style={{margin: '0 0 8px 0'}}>{ts('setupStep1')}</p>
                    <code style={{display: 'block', margin: '0 0 8px 0', color: '#58a6ff'}}>
                      #define API_BASE_URL "your-backend-url"
                    </code>
                    <code style={{display: 'block', margin: '0 0 8px 0', color: '#58a6ff'}}>
                      #define DEVICE_API_KEY "{device.api_key}"
                    </code>
                    <p style={{margin: '8px 0 0 0'}}>{ts('setupStep2')}</p>
                  </div>
                </details>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  borderTop: '1px solid #30363d',
                  paddingTop: '16px'
                }}>
                  <button
                    onClick={() => handleRegenerateKey(device.id)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: '1px solid #8b949e',
                      color: '#c9d1d9',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    title={ts('generateNewApiKey')}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#2f81f7';
                      e.currentTarget.style.borderColor = '#2f81f7';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = '#8b949e';
                    }}
                  >
                    <i className="fa-solid fa-rotate-right"></i> {ts('regenerate')}
                  </button>
                  <button
                    onClick={() => handleDeleteDevice(device.id)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: '1px solid #f85149',
                      color: '#f85149',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    title={ts('removeGateway')}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f85149';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#f85149';
                    }}
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
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
          <div style={{fontSize: '24px', color: '#2f81f7'}}>
            <i className="fa-solid fa-globe"></i>
          </div>
          <div>
            <h3 style={{margin: 0, color: '#c9d1d9', fontSize: '18px', fontWeight: 600}}>{ts('language')}</h3>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e'}}>{ts('chooseLanguage')}</p>
          </div>
        </div>

        {/* Language Toggle Buttons */}
        <div style={{display: 'flex', gap: '12px', background: '#161b22', padding: '8px', borderRadius: '8px', border: '1px solid #30363d'}}>
          {[
            {value: 'en', label: ts('english'), flag: '🇺🇸'},
            {value: 'am', label: ts('amharic'), flag: '🇪🇹'}
          ].map(option => (
            <button
              key={option.value}
              onClick={() => switchLang(option.value)}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: lang === option.value ? '#2f81f7' : 'transparent',
                border: `2px solid ${lang === option.value ? '#2f81f7' : '#30363d'}`,
                color: lang === option.value ? '#fff' : '#8b949e',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (lang !== option.value) {
                  e.currentTarget.style.background = 'rgba(47, 129, 247, 0.1)';
                  e.currentTarget.style.borderColor = '#2f81f7';
                }
              }}
              onMouseLeave={(e) => {
                if (lang !== option.value) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = '#30363d';
                }
              }}
            >
              <span style={{fontSize: '18px'}}>{option.flag}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Display Preferences */}
      <div className="settings-section settings-card">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
          <div style={{fontSize: '24px', color: '#2f81f7'}}>
            <i className="fa-solid fa-paintbrush"></i>
          </div>
          <div>
            <h3 style={{margin: 0, color: '#c9d1d9', fontSize: '18px', fontWeight: 600}}>{ts('displayPreferences')}</h3>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e'}}>{ts('displayPreferencesDesc')}</p>
          </div>
        </div>

        {/* Temperature Unit */}
        <div style={{marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #30363d'}}>
          <label style={{fontSize: '13px', color: '#8b949e', fontWeight: 600, marginBottom: '12px', display: 'block'}}>{ts('temperatureUnit')}</label>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            {[
              {value: 'celsius', label: ts('celsius'), icon: '°C', color: '#58acff'},
              {value: 'fahrenheit', label: ts('fahrenheit'), icon: '°F', color: '#ff9158'}
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSettingChange('temperatureUnit', opt.value)}
                style={{
                  padding: '14px',
                  background: localSettings.temperatureUnit === opt.value
                    ? `linear-gradient(135deg, rgba(${opt.color === '#58acff' ? '88, 172, 255' : '255, 145, 88'}, 0.15) 0%, transparent 100%)`
                    : '#161b22',
                  border: `2px solid ${localSettings.temperatureUnit === opt.value ? opt.color : '#30363d'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: localSettings.temperatureUnit === opt.value ? opt.color : '#8b949e',
                  textAlign: 'center',
                  fontWeight: 600,
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (localSettings.temperatureUnit !== opt.value) {
                    e.currentTarget.style.borderColor = opt.color;
                    e.currentTarget.style.color = opt.color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (localSettings.temperatureUnit !== opt.value) {
                    e.currentTarget.style.borderColor = '#30363d';
                    e.currentTarget.style.color = '#8b949e';
                  }
                }}
              >
                <div style={{fontSize: '20px', marginBottom: '4px'}}>{opt.icon}</div>
                <div style={{fontSize: '13px'}}>{opt.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time Format */}
        <div>
          <label style={{fontSize: '13px', color: '#8b949e', fontWeight: 600, marginBottom: '12px', display: 'block'}}>{ts('timeFormat')}</label>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            {[
              {value: 'relative', label: ts('relative'), example: ts('relativeExample'), iconClass: 'fa-solid fa-clock-rotate-left'},
              {value: 'absolute', label: ts('absolute'), example: ts('absoluteExample'), iconClass: 'fa-solid fa-calendar-check'}
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSettingChange('timeFormat', opt.value)}
                style={{
                  padding: '14px',
                  background: localSettings.timeFormat === opt.value
                    ? 'linear-gradient(135deg, rgba(63, 185, 80, 0.15) 0%, transparent 100%)'
                    : '#161b22',
                  border: `2px solid ${localSettings.timeFormat === opt.value ? '#3fb950' : '#30363d'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (localSettings.timeFormat !== opt.value) {
                    e.currentTarget.style.borderColor = '#3fb950';
                  }
                }}
                onMouseLeave={(e) => {
                  if (localSettings.timeFormat !== opt.value) {
                    e.currentTarget.style.borderColor = '#30363d';
                  }
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    margin: '0 auto 8px auto',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: localSettings.timeFormat === opt.value ? 'rgba(63, 185, 80, 0.18)' : '#0d1117',
                    border: `1px solid ${localSettings.timeFormat === opt.value ? '#3fb950' : '#30363d'}`,
                    color: localSettings.timeFormat === opt.value ? '#3fb950' : '#8b949e',
                    fontSize: '14px'
                  }}
                >
                  <i className={opt.iconClass} aria-hidden="true"></i>
                </div>
                <div style={{fontSize: '13px', fontWeight: 600, color: localSettings.timeFormat === opt.value ? '#3fb950' : '#c9d1d9'}}>
                  {opt.label}
                </div>
                <div style={{fontSize: '11px', color: '#8b949e', marginTop: '4px'}}>
                  {opt.example}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Synchronization */}
      <div className="settings-section settings-card">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
          <div style={{fontSize: '24px', color: '#2f81f7'}}>
            <i className="fa-solid fa-rotate"></i>
          </div>
          <div>
            <h3 style={{margin: 0, color: '#c9d1d9', fontSize: '18px', fontWeight: 600}}>{ts('dataSync')}</h3>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e'}}>{ts('dataSyncDesc')}</p>
          </div>
        </div>

        <label style={{fontSize: '13px', color: '#8b949e', fontWeight: 600, marginBottom: '12px', display: 'block'}}>{ts('autoRefreshInterval')}</label>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px'}}>
          {[
            {value: 1, label: '1m', iconClass: 'fa-solid fa-stopwatch'},
            {value: 5, label: '5m', iconClass: 'fa-solid fa-clock'},
            {value: 15, label: '15m', iconClass: 'fa-solid fa-rotate'},
            {value: 30, label: '30m', iconClass: 'fa-solid fa-hourglass-half'},
            {value: 60, label: '1h', iconClass: 'fa-solid fa-business-time'},
            {value: 0, label: ts('manual'), iconClass: 'fa-solid fa-hand-pointer'}
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSettingChange('autoRefreshInterval', opt.value)}
              style={{
                padding: '12px 8px',
                background: localSettings.autoRefreshInterval === opt.value
                  ? 'linear-gradient(135deg, #2f81f7 0%, #1f61d7 100%)'
                  : '#161b22',
                border: `1px solid ${localSettings.autoRefreshInterval === opt.value ? '#2f81f7' : '#30363d'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                color: localSettings.autoRefreshInterval === opt.value ? '#fff' : '#8b949e',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                if (localSettings.autoRefreshInterval !== opt.value) {
                  e.currentTarget.style.borderColor = '#2f81f7';
                  e.currentTarget.style.background = 'rgba(47, 129, 247, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (localSettings.autoRefreshInterval !== opt.value) {
                  e.currentTarget.style.borderColor = '#30363d';
                  e.currentTarget.style.background = '#161b22';
                }
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: localSettings.autoRefreshInterval === opt.value ? 'rgba(255,255,255,0.2)' : '#0d1117',
                  border: `1px solid ${localSettings.autoRefreshInterval === opt.value ? 'rgba(255,255,255,0.35)' : '#30363d'}`,
                  fontSize: '12px'
                }}
              >
                <i className={opt.iconClass} aria-hidden="true"></i>
              </div>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        <p style={{fontSize: '12px', color: '#8b949e', margin: '0', fontStyle: 'italic'}}>
          {ts('current')}: <strong style={{color: '#c9d1d9'}}>{localSettings.autoRefreshInterval ? `${ts('every')} ${localSettings.autoRefreshInterval}m` : ts('manual')}</strong>
        </p>
      </div>

      {/* Notifications */}
      <div className="settings-section settings-card">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
          <div style={{fontSize: '24px', color: '#2f81f7'}}>
            <i className="fa-solid fa-bell"></i>
          </div>
          <div>
            <h3 style={{margin: 0, color: '#c9d1d9', fontSize: '18px', fontWeight: 600}}>{ts('notificationsAlerts')}</h3>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e'}}>{ts('notificationsAlertsDesc')}</p>
          </div>
        </div>

        {/* Enable Notifications Toggle */}
        <div style={{padding: '16px', background: '#161b22', borderRadius: '8px', border: '1px solid #30363d', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div>
            <p style={{margin: 0, color: '#c9d1d9', fontWeight: 600, fontSize: '14px'}}>{ts('pushNotifications')}</p>
            <p style={{margin: '4px 0 0 0', fontSize: '12px', color: '#8b949e'}}>{ts('pushNotificationsDesc')}</p>
          </div>
          <button
            onClick={() => handleSettingChange('enableNotifications', !localSettings.enableNotifications)}
            style={{
              width: '50px',
              height: '28px',
              borderRadius: '14px',
              border: 'none',
              background: localSettings.enableNotifications ? '#3fb950' : '#30363d',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}
          >
            <span style={{
              position: 'absolute',
              top: '2px',
              left: localSettings.enableNotifications ? '26px' : '2px',
              width: '24px',
              height: '24px',
              background: '#fff',
              borderRadius: '50%',
              transition: 'left 0.3s ease'
            }}></span>
          </button>
        </div>

        {/* Confidence Threshold */}
        <div>
          <label style={{fontSize: '13px', color: '#8b949e', fontWeight: 600, marginBottom: '12px', display: 'block'}}>{ts('confidenceThreshold')}</label>
          <p style={{fontSize: '12px', color: '#8b949e', margin: '0 0 16px 0'}}>{ts('confidenceHint')}</p>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 60px', gap: '12px', alignItems: 'center'}}>
            <div style={{position: 'relative'}}>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={localSettings.diseaseConfidenceThreshold}
                onChange={(e) => handleSettingChange('diseaseConfidenceThreshold', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #f85149 0%, #ff9128 50%, #3fb950 100%)`,
                  outline: 'none',
                  WebkitAppearance: 'none',
                  appearanceNone: 'none'
                }}
              />
              <style>{`
                input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  borderRadius: '50%';
                  background: #2f81f7;
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.4);
                  border: 2px solid #fff;
                }
                input[type="range"]::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  borderRadius: 50%;
                  background: #2f81f7;
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.4);
                  border: 2px solid #fff;
                }
              `}</style>
            </div>
            <div style={{
              padding: '10px 12px',
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '6px',
              textAlign: 'center',
              fontWeight: 600,
              color: '#2f81f7',
              fontSize: '14px'
            }}>
              {localSettings.diseaseConfidenceThreshold}%
            </div>
          </div>

          <div style={{marginTop: '12px', display: 'flex', gap: '16px', fontSize: '12px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#f85149'}}>
              <i className="fa-solid fa-circle"></i> {ts('low')} ({50}%)
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#ff9128'}}>
              <i className="fa-solid fa-circle"></i> {ts('medium')} ({75}%)
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '6px', color: '#3fb950'}}>
              <i className="fa-solid fa-circle"></i> {ts('high')} ({95}%)
            </div>
          </div>
        </div>
      </div>

      <div className="settings-actions" style={{position: 'sticky', bottom: 0, paddingBottom: 20, paddingTop: 10, background: 'linear-gradient(transparent, #161b22 30%)'}}>
        <button
          className="primary-btn"
          onClick={handleSaveSettings}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            padding: '16px',
            fontSize: '16px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #2f81f7 0%, #1f61d7 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(47, 129, 247, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(47, 129, 247, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(47, 129, 247, 0.3)';
          }}
        >
          <i className="fa-solid fa-floppy-disk"></i> {ts('saveChanges')}
        </button>
        {saved && (
          <div style={{
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '12px',
            color: '#3fb950',
            fontSize: '14px',
            fontWeight: 600,
            animation: 'slideInUp 0.3s ease'
          }}>
            <i className="fa-solid fa-check-circle"></i> {ts('allChangesSaved')}
          </div>
        )}
        <style>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
