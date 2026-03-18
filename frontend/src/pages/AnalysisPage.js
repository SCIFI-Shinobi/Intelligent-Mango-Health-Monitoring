import React, { useMemo } from 'react';
import { useAPI } from '../hooks/useAPI';
import { useLanguage } from '../context/LanguageContext';

export default function AnalysisPage() {
  const { t, lang } = useLanguage();

  const { data: detectionData, loading: detectionLoading, error: detectionError } = useAPI('/detection/history?page=1&limit=200');
  const { data: sensorHistoryData, loading: sensorLoading } = useAPI('/sensors/history?range=30d');
  const { data: recommendationData, loading: recommendationLoading } = useAPI('/recommendations/latest?limit=50');
  const { data: forecastData, loading: forecastLoading } = useAPI('/forecast/latest');

  const analysis = useMemo(() => {
    const detections = detectionData?.data || [];
    const sensors = sensorHistoryData?.data || [];
    const recommendations = recommendationData?.data || [];
    const localizedRecommendations = recommendations.map((r) => {
      if (lang === 'am') {
        return r.title_am || r.title || '';
      }
      return r.title || '';
    }).filter(Boolean);
    const forecastDays = forecastData?.days || [];

    if (detections.length === 0) {
      return {
        totalScans: 0,
        healthyRate: 0,
        topDiseaseLabel: null,
        diseaseCount: 0,
        healthyCount: 0,
        healthyTempAvg: null,
        healthyHumidityAvg: null,
        diseasedTempAvg: null,
        diseasedHumidityAvg: null,
        riskLevel: 'LOW',
        riskScore: 0,
        diseaseRate: 0,
        averageConfidence: 0,
        recommendationCount: recommendations.length,
        latestRecommendation: localizedRecommendations[0] || null,
        highRiskDays: 0,
        stableDays: 0,
        sensorSampleCount: sensors.length,
        confidenceTrend: [],
        temperatureTrend: [],
        diseaseBreakdown: [],
        forecastRiskTrend: [],
        topRecommendations: localizedRecommendations.slice(0, 3),
      };
    }

    const diseaseFrequency = {};
    let healthyCount = 0;
    let diseaseCount = 0;
    let healthyTempTotal = 0;
    let healthyHumidityTotal = 0;
    let healthyWithEnvCount = 0;
    let diseasedTempTotal = 0;
    let diseasedHumidityTotal = 0;
    let diseasedWithEnvCount = 0;
    let confidenceTotal = 0;

    detections.forEach((entry) => {
      const diseaseType = entry.disease_type || 'Unknown';
      const isHealthy = diseaseType.toLowerCase() === 'healthy';
      const hasTemperature = typeof entry.temperature === 'number';
      const hasHumidity = typeof entry.humidity === 'number';

      confidenceTotal += Number(entry.confidence_score || 0);

      if (isHealthy) {
        healthyCount += 1;
        if (hasTemperature && hasHumidity) {
          healthyTempTotal += entry.temperature;
          healthyHumidityTotal += entry.humidity;
          healthyWithEnvCount += 1;
        }
        return;
      }

      diseaseCount += 1;
      diseaseFrequency[diseaseType] = (diseaseFrequency[diseaseType] || 0) + 1;
      if (hasTemperature && hasHumidity) {
        diseasedTempTotal += entry.temperature;
        diseasedHumidityTotal += entry.humidity;
        diseasedWithEnvCount += 1;
      }
    });

    let topDiseaseLabel = null;
    let maxCount = 0;
    Object.entries(diseaseFrequency).forEach(([disease, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topDiseaseLabel = disease;
      }
    });

    const healthyRate = (healthyCount / detections.length) * 100;
    const recentWindow = detections.slice(0, Math.min(25, detections.length));
    const recentDiseased = recentWindow.filter((d) => (d.disease_type || '').toLowerCase() !== 'healthy').length;
    const diseaseRate = recentWindow.length ? (recentDiseased / recentWindow.length) * 100 : 0;
    const averageConfidence = detections.length ? (confidenceTotal / detections.length) * 100 : 0;

    const riskScore = Math.round(diseaseRate * 0.7 + averageConfidence * 0.3);
    let riskLevel = 'LOW';
    if (riskScore >= 65) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 40) {
      riskLevel = 'MEDIUM';
    }

    const highRiskDays = forecastDays.filter((d) => (d.risk_level || '').toUpperCase().includes('HIGH')).length;
    const stableDays = Math.max(0, forecastDays.length - highRiskDays);

    const confidenceTrend = detections
      .slice(0, 12)
      .reverse()
      .map((d) => Math.max(0, Math.min(100, Math.round((d.confidence_score || 0) * 100))));

    const temperatureTrend = sensors
      .slice(-12)
      .map((s) => (typeof s.temperature === 'number' ? s.temperature : null))
      .filter((v) => v != null);

    let normalizedTemperatureTrend = [];
    if (temperatureTrend.length > 0) {
      const minTemp = Math.min(...temperatureTrend);
      const maxTemp = Math.max(...temperatureTrend);
      const range = Math.max(1, maxTemp - minTemp);
      normalizedTemperatureTrend = temperatureTrend.map((v) => Math.round(((v - minTemp) / range) * 100));
    }

    const totalDiseased = Math.max(1, diseaseCount);
    const diseaseBreakdown = Object.entries(diseaseFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / totalDiseased) * 100),
      }));

    const forecastRiskTrend = forecastDays.map((d) => {
      const risk = (d.risk_level || '').toUpperCase();
      if (risk.includes('HIGH')) return 90;
      if (risk.includes('MEDIUM')) return 60;
      return 30;
    });

    return {
      totalScans: detections.length,
      healthyRate,
      topDiseaseLabel,
      diseaseCount,
      healthyCount,
      healthyTempAvg: healthyWithEnvCount ? healthyTempTotal / healthyWithEnvCount : null,
      healthyHumidityAvg: healthyWithEnvCount ? healthyHumidityTotal / healthyWithEnvCount : null,
      diseasedTempAvg: diseasedWithEnvCount ? diseasedTempTotal / diseasedWithEnvCount : null,
      diseasedHumidityAvg: diseasedWithEnvCount ? diseasedHumidityTotal / diseasedWithEnvCount : null,
      riskLevel,
      riskScore,
      diseaseRate,
      averageConfidence,
      recommendationCount: recommendations.length,
      latestRecommendation: localizedRecommendations[0] || null,
      highRiskDays,
      stableDays,
      sensorSampleCount: sensors.length,
      confidenceTrend,
      temperatureTrend: normalizedTemperatureTrend,
      diseaseBreakdown,
      forecastRiskTrend,
      topRecommendations: localizedRecommendations.slice(0, 3),
    };
  }, [detectionData, sensorHistoryData, recommendationData, forecastData, lang]);

  const formatNumber = (value, digits = 1) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return t('analysis', 'notAvailable');
    return value.toFixed(digits);
  };

  const isLoading = detectionLoading || sensorLoading || recommendationLoading || forecastLoading;
  const noDataText = t('analysis', 'notAvailable');

  const riskLevelText = (level) => {
    if (level === 'HIGH') return t('analysis', 'high');
    if (level === 'MEDIUM') return t('analysis', 'medium');
    return t('analysis', 'low');
  };

  const translateDiseaseName = (diseaseName) => {
    if (!diseaseName) return noDataText;
    const lowerName = diseaseName.toLowerCase().trim();
    
    // Map disease names to translation keys
    if (lowerName === 'healthy') return t('disease', 'healthy');
    if (lowerName === 'anthracnose') return t('disease', 'anthracnose');
    if (lowerName === 'powdery mildew' || lowerName === 'powderymildew') return t('disease', 'powderyMildew');
    
    // Fallback to original name if translation not found
    return diseaseName;
  };

  const renderMiniBars = (values, barClass, emptyLabel) => {
    if (!values || values.length === 0) {
      return <span className="mini-empty">{emptyLabel}</span>;
    }

    return (
      <div className="mini-bars">
        {values.map((v, idx) => (
          <span key={`${barClass}-${idx}`} className={`mini-bar ${barClass}`} style={{ height: `${Math.max(6, v)}%` }}></span>
        ))}
      </div>
    );
  };

  return (
    <div className="analysis-page">
      <div className="section-header">
        <span className="section-title">{t('analysis', 'title')}</span>
      </div>

      {detectionError && <div className="error-message">{detectionError}</div>}

      {isLoading ? (
        <div className="analysis-loading">{t('analysis', 'loading')}</div>
      ) : (
        <>
          <div className="analysis-kpi-grid">
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'totalScans')}</span>
              <span className="kpi-value">{analysis.totalScans}</span>
            </div>
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'healthyRate')}</span>
              <span className="kpi-value">{formatNumber(analysis.healthyRate)}%</span>
            </div>
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'riskLevel')}</span>
              <span className={`kpi-value risk-${analysis.riskLevel.toLowerCase()}`}>{riskLevelText(analysis.riskLevel)}</span>
            </div>
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'topDisease')}</span>
              <span className="kpi-value compact">{translateDiseaseName(analysis.topDiseaseLabel)}</span>
            </div>
          </div>

          <div className="analysis-content">
            <div className="analysis-card">
              <h4>{t('analysis', 'diseasePatterns')}</h4>
              <p>{t('analysis', 'diseasePatternsDesc')}</p>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'healthyDetections')}</span>
                <strong>{analysis.healthyCount}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'diseaseDetections')}</span>
                <strong>{analysis.diseaseCount}</strong>
              </div>
              <div className="analysis-progress-track">
                <div className="analysis-progress-fill healthy" style={{ width: `${Math.max(0, Math.min(100, analysis.healthyRate))}%` }}></div>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'diseaseBreakdown')}</span>
                {analysis.diseaseBreakdown.length === 0 ? (
                  <span className="mini-empty">{noDataText}</span>
                ) : (
                  <div className="analysis-breakdown-list">
                    {analysis.diseaseBreakdown.map((item) => (
                      <div className="breakdown-row" key={item.name}>
                        <span className="breakdown-name">{translateDiseaseName(item.name)}</span>
                        <div className="breakdown-track">
                          <span className="breakdown-fill" style={{ width: `${item.pct}%` }}></span>
                        </div>
                        <span className="breakdown-value">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="analysis-card">
              <h4>{t('analysis', 'envCorrelations')}</h4>
              <p>{t('analysis', 'envCorrelationsDesc')}</p>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'healthyAvgTemp')}</span>
                <strong>{formatNumber(analysis.healthyTempAvg)} degC</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'diseaseAvgTemp')}</span>
                <strong>{formatNumber(analysis.diseasedTempAvg)} degC</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'healthyAvgHumidity')}</span>
                <strong>{formatNumber(analysis.healthyHumidityAvg)}%</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'diseaseAvgHumidity')}</span>
                <strong>{formatNumber(analysis.diseasedHumidityAvg)}%</strong>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'temperatureTrend')}</span>
                {renderMiniBars(analysis.temperatureTrend, 'temp', noDataText)}
              </div>
            </div>

            <div className="analysis-card">
              <h4>{t('analysis', 'riskAssessment')}</h4>
              <p>{t('analysis', 'riskAssessmentDesc')}</p>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'compositeRiskScore')}</span>
                <strong>{analysis.riskScore}/100</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'recentDiseaseRatio')}</span>
                <strong>{formatNumber(analysis.diseaseRate)}%</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'averageConfidence')}</span>
                <strong>{formatNumber(analysis.averageConfidence)}%</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'forecastHighRiskDays')}</span>
                <strong>{analysis.highRiskDays}</strong>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'recentConfidenceTrend')}</span>
                {renderMiniBars(analysis.confidenceTrend, 'confidence', noDataText)}
              </div>
            </div>

            <div className="analysis-card">
              <h4>{t('analysis', 'recSummary')}</h4>
              <p>{t('analysis', 'recSummaryDesc')}</p>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'totalRecommendations')}</span>
                <strong>{analysis.recommendationCount}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'latestRecommendation')}</span>
                <strong className="metric-compact">{analysis.latestRecommendation || noDataText}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'forecastStableDays')}</span>
                <strong>{analysis.stableDays}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'sensorSamples30d')}</span>
                <strong>{analysis.sensorSampleCount}</strong>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'forecastOutlook')}</span>
                {renderMiniBars(analysis.forecastRiskTrend, 'risk', noDataText)}
              </div>
              <div className="analysis-recommendation-list">
                <span className="mini-label">{t('analysis', 'topRecommendations')}</span>
                {analysis.topRecommendations.length === 0 ? (
                  <span className="mini-empty">{noDataText}</span>
                ) : (
                  <ul>
                    {analysis.topRecommendations.map((rec, idx) => (
                      <li key={`${rec}-${idx}`}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <p className="analysis-note">{t('analysis', 'insightsLive')}</p>
        </>
      )}
    </div>
  );
}
