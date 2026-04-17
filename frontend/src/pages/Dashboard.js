import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MobileNav from '../components/MobileNav';
import DiseaseStatusCard from '../components/DiseaseStatusCard';
import SensorCard from '../components/SensorCard';
import HistoricalChart from '../components/HistoricalChart';
import RecommendationsPanel from '../components/RecommendationsPanel';
import ForecastCard from '../components/ForecastCard';
import LogsPage from './LogsPage';
import SettingsPage from './SettingsPage';
import AnalysisPage from './AnalysisPage';
import { useTimeRange } from '../hooks/useTimeRange';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { getApiBaseUrl, getWsBaseUrl } from '../utils/apiBase';
import { formatDateEAT, formatTimeAgo } from '../utils/formatTime';

const API_BASE_URL = getApiBaseUrl();
const WS_BASE_URL = getWsBaseUrl();

export default function Dashboard() {
  const { token } = useContext(AuthContext);
  const { t, lang } = useLanguage();
  const { settings, formatTemp } = useSettings();

  // Tab state
  const [activeTab, setActiveTab] = useState('home');

  // Data states
  const [detection, setDetection] = useState(null);
  const [sensorLatest, setSensorLatest] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastBackendCheck, setLastBackendCheck] = useState(null);

  // Time range management
  const { range, setRange, data: historyData, loading: historyLoading } = useTimeRange();

  // WebSocket for real-time updates
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const connectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(`${WS_BASE_URL}/ws?token=${token}`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        if (incoming.disease_type) {
          setDetection({
            disease_type: incoming.disease_type,
            confidence_score: incoming.confidence_score,
            timestamp: incoming.timestamp || new Date().toISOString(),
          });
        }
        if (incoming.temperature !== undefined) {
          setSensorLatest({
            temperature: incoming.temperature,
            humidity: incoming.humidity,
            timestamp: incoming.timestamp || new Date().toISOString()
          });
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      setWsConnected(false);
      reconnectTimer.current = setTimeout(() => connectWebSocket(), 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
  }, [token]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const healthData = await res.json();
      setBackendHealth(healthData);
      setLastBackendCheck(new Date().toISOString());
    } catch (healthError) {
      console.error('Health check failed:', healthError);
      setBackendHealth(null);
      setLastBackendCheck(new Date().toISOString());
    }
  }, []);

  // Fetch all data on mount and when tab changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // Fetch latest detection (now includes matching sensor data)
        const detectionRes = await fetch(`${API_BASE_URL}/detection/latest`, { headers });
        if (detectionRes.ok) {
          const detectionData = await detectionRes.json();
          setDetection(detectionData);
          // Use sensor data from detection to keep them in sync
          setSensorLatest({
            temperature: detectionData.temperature,
            humidity: detectionData.humidity,
            timestamp: detectionData.timestamp
          });
        }

        // Fetch recommendations
        const recsRes = await fetch(`${API_BASE_URL}/recommendations/latest?limit=5`, { headers });
        if (recsRes.ok) {
          const recsData = await recsRes.json();
          setRecommendations(recsData.data || []);
        }

        // Fetch forecast
        const forecastRes = await fetch(`${API_BASE_URL}/forecast/latest`, { headers });
        if (forecastRes.ok) {
          setForecast(await forecastRes.json());
        }
      } catch (err) {
        setError(err.message);
        console.error('Data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchHealth();
    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [token, connectWebSocket, fetchHealth]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        fetchHealth();
      }
    }, 120000);

    return () => window.clearInterval(intervalId);
  }, [fetchHealth]);

  // Get window size for responsive behavior
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatUpdated = useCallback((timestamp) => (
    timestamp ? formatDateEAT(timestamp, lang) : null
  ), [lang]);

  const getFreshness = useCallback((timestamp) => {
    if (!timestamp) {
      return {
        statusLabel: t('common', 'offline'),
        statusClass: 'offline',
        isStale: true,
      };
    }

    const diffMs = Date.now() - new Date(timestamp).getTime();
    if (diffMs < 5 * 60 * 1000) {
      return { statusLabel: t('common', 'live'), statusClass: 'live', isStale: false };
    }
    if (diffMs < 15 * 60 * 1000) {
      return { statusLabel: t('common', 'delayed'), statusClass: 'delayed', isStale: true };
    }
    return { statusLabel: t('common', 'offline'), statusClass: 'offline', isStale: true };
  }, [t]);

  const latestTimestamp = detection?.timestamp || sensorLatest?.timestamp || null;
  const freshness = getFreshness(latestTimestamp);
  const chartUpdated = historyData[historyData.length - 1]?.timestamp || null;

  const backendStatus = backendHealth?.status === 'ok'
    ? (backendHealth?.database?.duration_ms > 250 ? t('common', 'delayed') : t('common', 'healthy'))
    : t('common', 'unavailable');
  const backendStatusClass = backendHealth?.status === 'ok'
    ? (backendHealth?.database?.duration_ms > 250 ? 'delayed' : 'healthy')
    : 'offline';
  const databaseStatusClass = backendHealth?.database?.ok
    ? (backendHealth?.database?.duration_ms > 250 ? 'delayed' : 'healthy')
    : 'offline';
  const deviceStatusClass = wsConnected && !freshness.isStale ? 'healthy' : (wsConnected || latestTimestamp ? 'delayed' : 'offline');

  const systemCards = [
    {
      label: 'Backend',
      value: backendStatus,
      helper: lastBackendCheck ? `${t('common', 'lastUpdated')}: ${formatTimeAgo(lastBackendCheck, lang)}` : null,
      statusClass: backendStatusClass,
    },
    {
      label: 'Database',
      value: backendHealth?.database?.ok
        ? `${Math.round(backendHealth.database.duration_ms)} ms`
        : t('common', 'unavailable'),
      helper: backendHealth?.database?.ok ? t('common', 'healthy') : t('common', 'offline'),
      statusClass: databaseStatusClass,
    },
    {
      label: 'Device',
      value: freshness.statusLabel,
      helper: latestTimestamp ? `${t('common', 'lastUpdated')}: ${formatTimeAgo(latestTimestamp, lang)}` : t('disease', 'waitingForDevice'),
      statusClass: deviceStatusClass,
    },
    {
      label: 'Forecast',
      value: forecast?.days?.length ? `${forecast.days.length} days` : t('common', 'unavailable'),
      helper: forecast?.created_at ? `${t('common', 'lastUpdated')}: ${formatTimeAgo(forecast.created_at, lang)}` : t('forecast', 'waitingForForecast'),
      statusClass: forecast?.days?.length ? 'healthy' : 'delayed',
    },
  ];

  // Render content based on active tab
  const renderContent = () => {
    // Settings, Analysis, Logs work on both desktop and mobile
    switch (activeTab) {
      case 'settings':
      case 'analysis':
      case 'logs':
        return (
          <div className="subpage-wrapper">
            {activeTab === 'settings' && <SettingsPage />}
            {activeTab === 'analysis' && <AnalysisPage />}
            {activeTab === 'logs' && <LogsPage />}
          </div>
        );

      case 'home':
      default:
        return (
          <div className="dashboard-content">
            <div className="system-health-strip">
              {systemCards.map((card) => (
                <div key={card.label} className="system-health-card">
                  <div className="system-health-label-row">
                    <span className="system-health-label">{card.label}</span>
                    <span className={`status-pill ${card.statusClass}`}>{card.value}</span>
                  </div>
                  <span className="system-health-helper">{card.helper}</span>
                </div>
              ))}
            </div>

            {/* Top Grid: Disease Status + Sensors */}
            <div className={isDesktop ? "top-grid" : "mobile-top-section"}>
              <DiseaseStatusCard detection={detection} loading={loading} freshness={freshness} />
              <div className={isDesktop ? "sensor-grid-desktop" : "sensor-row"}>
                <SensorCard
                  name={t('sensor', 'temperature')}
                  value={formatTemp(sensorLatest?.temperature)}
                  unit={settings.temperatureUnit === 'fahrenheit' ? '°F' : '°C'}
                  icon="temp"
                  loading={loading}
                  subtitle={freshness.isStale ? t('disease', 'noRecentDeviceData') : t('common', 'live')}
                  updatedAt={formatUpdated(sensorLatest?.timestamp)}
                  statusLabel={freshness.statusLabel}
                  statusClass={freshness.statusClass}
                />
                <SensorCard
                  name={t('sensor', 'humidity')}
                  value={sensorLatest?.humidity?.toFixed(1) || '-'}
                  unit="%"
                  icon="humidity"
                  loading={loading}
                  subtitle={freshness.isStale ? t('disease', 'noRecentDeviceData') : t('common', 'live')}
                  updatedAt={formatUpdated(sensorLatest?.timestamp)}
                  statusLabel={freshness.statusLabel}
                  statusClass={freshness.statusClass}
                />
              </div>
            </div>

            {/* Chart + Recommendations */}
            <div className={isDesktop ? "middle-grid" : "mobile-middle-section"}>
              <HistoricalChart
                data={historyData}
                loading={historyLoading}
                onRangeChange={setRange}
                currentRange={range}
                lastUpdatedText={formatUpdated(chartUpdated)}
              />
              <RecommendationsPanel recommendations={recommendations} loading={loading} />
            </div>

            {/* Forecast */}
            <ForecastCard forecast={forecast} loading={loading} />
          </div>
        );
    }
  };

  if (error && !detection) {
    return (
      <div className="dashboard">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="error-message">
          <p>{t('common', 'errorLoading')}: {error}</p>
          <button onClick={() => window.location.reload()}>{t('common', 'retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Navbar */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div className="dashboard-wrapper">
        {renderContent()}
      </div>

      {/* Mobile Navigation (hidden on desktop) */}
      {!isDesktop && (
        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Footer */}
      <div className="footer">
        {t('footer', 'text')}
      </div>
    </div>
  );
}
