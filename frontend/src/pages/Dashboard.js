import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useAPI } from '../hooks/useAPI';
import { useTimeRange } from '../hooks/useTimeRange';
import { useLanguage } from '../context/LanguageContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export default function Dashboard() {
  const { logout } = useContext(AuthContext);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Tab state
  const [activeTab, setActiveTab] = useState('home');

  // Data states
  const [detection, setDetection] = useState(null);
  const [sensorLatest, setSensorLatest] = useState(null);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Time range management
  const { range, setRange, data: historyData, loading: historyLoading } = useTimeRange();

  // WebSocket for real-time updates
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const connectWebSocket = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(`ws://${API_BASE_URL.replace(/^https?:\/\//, '')}/ws?token=${token}`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        if (incoming.disease_type) {
          setDetection({
            disease_type: incoming.disease_type,
            confidence_score: incoming.confidence_score,
            timestamp: new Date().toISOString()
          });
        }
        if (incoming.temperature !== undefined) {
          setSensorLatest({
            temperature: incoming.temperature,
            humidity: incoming.humidity,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      reconnectTimer.current = setTimeout(connectWebSocket, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

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

        // Fetch latest detection
        const detectionRes = await fetch(`${API_BASE_URL}/detection/latest`, { headers });
        if (detectionRes.ok) {
          setDetection(await detectionRes.json());
        }

        // Fetch latest sensor data
        const sensorRes = await fetch(`${API_BASE_URL}/sensors/latest`, { headers });
        if (sensorRes.ok) {
          setSensorLatest(await sensorRes.json());
        }

        // Fetch sensor history (will be updated by useTimeRange)
        setSensorHistory(historyData);

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
    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [token, historyData]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get window size for responsive behavior
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
            {/* Top Grid: Disease Status + Sensors */}
            <div className={isDesktop ? "top-grid" : ""}>
              <DiseaseStatusCard detection={detection} loading={loading} />
              <div className={isDesktop ? "sensor-grid-desktop" : "sensor-row"}>
                <SensorCard
                  name={t('sensor', 'temperature')}
                  value={sensorLatest?.temperature?.toFixed(1) || '-'}
                  unit="°C"
                  icon="temp"
                />
                <SensorCard
                  name={t('sensor', 'humidity')}
                  value={sensorLatest?.humidity?.toFixed(1) || '-'}
                  unit="%"
                  icon="humidity"
                />
                <SensorCard
                  name={t('sensor', 'precipitation')}
                  value={sensorLatest?.precipitation != null ? sensorLatest.precipitation.toFixed(1) : '0.0'}
                  unit="mm"
                  icon="precip"
                />
              </div>
            </div>

            {/* Chart + Recommendations */}
            <div className={isDesktop ? "middle-grid" : ""}>
              <HistoricalChart
                data={historyData}
                loading={historyLoading}
                onRangeChange={setRange}
                currentRange={range}
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
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
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
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />

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
