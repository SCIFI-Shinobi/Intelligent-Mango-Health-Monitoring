import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import SensorCard from '../components/SensorCard';
import HistoricalChart from '../components/HistoricalChart';
import RecommendationsPanel from '../components/RecommendationsPanel';
import ForecastCard from '../components/ForecastCard';
import DiseaseStatusCard from '../components/DiseaseStatusCard';
import ScanUploadModal from '../components/ScanUploadModal';
import { useTimeRange } from '../hooks/useTimeRange';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';
import { getApiBaseUrl } from '../utils/apiBase';
import { formatDateEAT } from '../utils/formatTime';

const API_BASE_URL = getApiBaseUrl();

export default function Home() {
  const { token } = useContext(AuthContext);
  const { t, lang } = useLanguage();
  const { settings, formatTemp } = useSettings();

  const [showQuickScan, setShowQuickScan] = useState(false);
  const [detection, setDetection] = useState(null);
  const [sensorLatest, setSensorLatest] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forecast, setForecast] = useState(null);

  const { range, setRange, data: historyData, loading: historyLoading } = useTimeRange();

  const normalizeRecommendations = useCallback((items = []) => (
    items.map((item) => ({
      ...item,
      description: item.description || item.desc || '',
      desc: item.description || item.desc || '',
    }))
  ), []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      let detectionData = null;

      const detectionRes = await fetch(`${API_BASE_URL}/detection/latest`, { headers });
      if (detectionRes.ok) {
        detectionData = await detectionRes.json();
        setDetection(detectionData);
        setSensorLatest({
          temperature: detectionData.temperature,
          humidity: detectionData.humidity,
          timestamp: detectionData.timestamp
        });
        setForecast(detectionData.forecast || null);
      }

      const recsRes = await fetch(`${API_BASE_URL}/recommendations/latest?limit=5`, { headers });
      if (recsRes.ok) {
        const recsData = await recsRes.json();
        setRecommendations(normalizeRecommendations(recsData.data || []));
      }

      if (!detectionData?.forecast) {
        const forecastRes = await fetch(`${API_BASE_URL}/forecast/latest`, { headers });
        if (forecastRes.ok) {
          const forecastData = await forecastRes.json();
          setForecast(forecastData);
        } else {
          setForecast(null);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, normalizeRecommendations]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleLiveUpdate = (e) => {
      const incoming = e.detail;
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
      if (incoming.recommendations !== undefined) {
        setRecommendations(normalizeRecommendations(incoming.recommendations || []));
      }
      if (incoming.forecast) {
        setForecast(incoming.forecast);
      }
    };

    const handleCloudScanComplete = () => fetchDashboardData();

    window.addEventListener('mangoguard-live-update', handleLiveUpdate);
    window.addEventListener('mangoguard-cloud-scan-complete', handleCloudScanComplete);
    
    return () => {
      window.removeEventListener('mangoguard-live-update', handleLiveUpdate);
      window.removeEventListener('mangoguard-cloud-scan-complete', handleCloudScanComplete);
    };
  }, [fetchDashboardData, normalizeRecommendations]);

  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatUpdated = useCallback((timestamp) => (
    timestamp ? formatDateEAT(timestamp, lang) : null
  ), [lang]);

  const getFreshness = useCallback((timestamp) => {
    if (!timestamp) return { statusLabel: t('common', 'offline'), statusClass: 'offline', isStale: true };
    const diffMs = Date.now() - new Date(timestamp).getTime();
    if (diffMs < 5 * 60 * 1000) return { statusLabel: t('common', 'live'), statusClass: 'live', isStale: false };
    if (diffMs < 15 * 60 * 1000) return { statusLabel: t('common', 'delayed'), statusClass: 'delayed', isStale: true };
    return { statusLabel: t('common', 'offline'), statusClass: 'offline', isStale: true };
  }, [t]);

  const latestTimestamp = detection?.timestamp || sensorLatest?.timestamp || null;
  const freshness = getFreshness(latestTimestamp);
  const chartUpdated = historyData[historyData.length - 1]?.timestamp || null;

  if (error && !detection) {
    return (
      <div className="error-message">
        <p>{t('common', 'errorLoading')}: {error}</p>
        <button onClick={() => window.location.reload()}>{t('common', 'retry')}</button>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      {isDesktop && (
        <button className="dashboard-scan-button" onClick={() => setShowQuickScan(true)}>
          <i className="fa-solid fa-microscope"></i>
          {t('nav', 'scanForDisease') || 'Scan for Disease'}
        </button>
      )}
      
      <div className={isDesktop ? "top-cards-grid" : "mobile-top-section"}>
        <DiseaseStatusCard detection={detection} loading={loading} freshness={freshness} />
        <SensorCard
          name={t('sensor', 'temperature')}
          value={formatTemp(sensorLatest?.temperature)}
          unit={settings.temperatureUnit === 'fahrenheit' ? '°F' : '°C'}
          icon="temp"
          loading={loading}
          statusLabel={freshness.statusLabel}
          statusClass={freshness.statusClass}
          lastScanTimestamp={sensorLatest?.timestamp || null}
          lang={lang}
        />
        <SensorCard
          name={t('sensor', 'humidity')}
          value={sensorLatest?.humidity?.toFixed(1) || '-'}
          unit="%"
          icon="humidity"
          loading={loading}
          statusLabel={freshness.statusLabel}
          statusClass={freshness.statusClass}
          lastScanTimestamp={sensorLatest?.timestamp || null}
          lang={lang}
        />
      </div>

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

      <ForecastCard forecast={forecast} loading={loading} />
      {showQuickScan && <ScanUploadModal onClose={() => setShowQuickScan(false)} />}
    </div>
  );
}
