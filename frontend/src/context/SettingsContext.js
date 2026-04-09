import React, { createContext, useState, useContext, useEffect } from 'react';

export const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('mangaguard-settings');
    return saved ? JSON.parse(saved) : {
      enableNotifications: true,
      diseaseConfidenceThreshold: 70,
      temperatureUnit: 'celsius',
      timeFormat: 'relative',
      autoRefreshInterval: 5
    };
  });

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('mangaguard-settings', JSON.stringify(newSettings));
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
