import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { getApiBaseUrl } from '../utils/apiBase';

export const SettingsContext = createContext();
const API_BASE_URL = getApiBaseUrl();
const DEFAULT_SETTINGS = {
  enableNotifications: true,
  diseaseConfidenceThreshold: 70,
  temperatureUnit: 'celsius',
  timeFormat: 'relative',
  autoRefreshInterval: 5
};

function loadStoredSettings() {
  const saved = localStorage.getItem('mangaguard-settings');
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
}

export function SettingsProvider({ children }) {
  const { token, user, updateUser } = useContext(AuthContext);
  const [settings, setSettings] = useState(loadStoredSettings);
  const apiHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  useEffect(() => {
    if (!user) return;

    setSettings((prev) => {
      const nextSettings = {
        ...prev,
        enableNotifications: user.notification_emails_enabled ?? prev.enableNotifications,
        diseaseConfidenceThreshold: user.disease_confidence_threshold ?? prev.diseaseConfidenceThreshold
      };
      localStorage.setItem('mangaguard-settings', JSON.stringify(nextSettings));
      return nextSettings;
    });
  }, [user]);

  const updateSettings = async (newSettings) => {
    const previousSettings = settings;
    setSettings(newSettings);
    localStorage.setItem('mangaguard-settings', JSON.stringify(newSettings));

    if (!token) return newSettings;

    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PUT',
      headers: apiHeaders,
      body: JSON.stringify({
        notification_emails_enabled: newSettings.enableNotifications,
        disease_confidence_threshold: newSettings.diseaseConfidenceThreshold
      })
    });

    if (!response.ok) {
      setSettings(previousSettings);
      localStorage.setItem('mangaguard-settings', JSON.stringify(previousSettings));
      throw new Error('Failed to save settings');
    }

    const updatedProfile = await response.json();
    updateUser(updatedProfile);
    return newSettings;
  };

  const formatTemp = (celsiusValue) => {
    if (celsiusValue === undefined || celsiusValue === null) return '-';
    if (settings.temperatureUnit === 'fahrenheit') {
      return ((celsiusValue * 9/5) + 32).toFixed(1);
    }
    return celsiusValue.toFixed(1);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, formatTemp }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
