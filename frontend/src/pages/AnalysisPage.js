import React, { useContext, useEffect, useState } from 'react';
import { useAPI } from '../hooks/useAPI';
import { useLanguage } from '../context/LanguageContext';
import { SettingsContext } from '../context/SettingsContext';
import { formatDateEAT, formatTimeAgo } from '../utils/formatTime';
import { MdChecklist, MdInsights, MdOutlineThermostat, MdWarningAmber } from 'react-icons/md';

export default function AnalysisPage() {
  const { t, lang } = useLanguage();
  const { settings, formatTemp } = useContext(SettingsContext);
  const [analysisRefreshKey, setAnalysisRefreshKey] = useState(0);
  const { data: analysis, loading, error } = useAPI(`/analysis/summary?refresh=${analysisRefreshKey}`);

  const tempUnitString = settings?.temperatureUnit === 'fahrenheit' ? 'F' : 'C';
  const noDataText = t('analysis', 'notAvailable');

  const formatPercent = (value, digits = 1) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return noDataText;
    return `${value.toFixed(digits)}%`;
  };

  const formatTempReading = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return noDataText;
    return `${formatTemp(value)} °${tempUnitString}`;
  };

  const formatHumidityReading = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return noDataText;
    return `${value.toFixed(1)}%`;
  };

  const formatTempGap = (diseasedValue, healthyValue) => {
    if (typeof diseasedValue !== 'number' || typeof healthyValue !== 'number') return noDataText;
    const deltaCelsius = diseasedValue - healthyValue;
    const deltaValue = settings?.temperatureUnit === 'fahrenheit' ? (deltaCelsius * 9) / 5 : deltaCelsius;
    const sign = deltaValue > 0 ? '+' : '';
    return `${sign}${deltaValue.toFixed(1)} °${tempUnitString}`;
  };

  const formatHumidityGap = (diseasedValue, healthyValue) => {
    if (typeof diseasedValue !== 'number' || typeof healthyValue !== 'number') return noDataText;
    const delta = diseasedValue - healthyValue;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
  };

  const riskLevelText = (level) => {
    if (level === 'HIGH') return t('analysis', 'high');
    if (level === 'MEDIUM') return t('analysis', 'medium');
    return t('analysis', 'low');
  };

  const translateDiseaseName = (diseaseName) => {
    if (!diseaseName) return noDataText;
    const lowerName = diseaseName
      .toLowerCase()
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (lowerName === 'healthy') return t('disease', 'healthy');
    if (lowerName === 'anthracnose') return t('disease', 'anthracnose');
    if (lowerName === 'powdery mildew' || lowerName === 'powderymildew') return t('disease', 'powderyMildew');
    if (lowerName === 'die back' || lowerName === 'dieback') return t('disease', 'dieBack');

    return diseaseName;
  };

  const localizeRecommendation = (recommendation) => {
    if (!recommendation) return null;
    if (lang === 'am') {
      return recommendation.title_am || recommendation.title || null;
    }
    return recommendation.title || recommendation.title_am || null;
  };

  const renderMiniBars = (values, barClass, emptyLabel) => {
    if (!values || values.length === 0) {
      return <span className="mini-empty">{emptyLabel}</span>;
    }

    return (
      <div className="mini-bars">
        {values.map((value, idx) => (
          <span key={`${barClass}-${idx}`} className={`mini-bar ${barClass}`} style={{ height: `${Math.max(6, value)}%` }}></span>
        ))}
      </div>
    );
  };

  const formatTimestampLabel = (value) => {
    if (!value) return noDataText;
    return settings?.timeFormat === 'relative'
      ? formatTimeAgo(value, lang)
      : formatDateEAT(value, lang);
  };

  useEffect(() => {
    const handleCloudScanComplete = () => {
      setAnalysisRefreshKey((current) => current + 1);
    };

    window.addEventListener('mangoguard-cloud-scan-complete', handleCloudScanComplete);
    return () => window.removeEventListener('mangoguard-cloud-scan-complete', handleCloudScanComplete);
  }, []);



  const summary = analysis || {
    total_scans: 0,
    healthy_rate: 0,
    top_disease_label: null,
    disease_count: 0,
    healthy_count: 0,
    healthy_temp_avg: null,
    healthy_humidity_avg: null,
    diseased_temp_avg: null,
    diseased_humidity_avg: null,
    risk_level: 'LOW',
    risk_score: 0,
    disease_rate: 0,
    average_confidence: 0,
    recommendation_count: 0,
    latest_recommendation: null,
    high_risk_days: 0,
    stable_days: 0,
    sensor_sample_count: 0,
    confidence_trend: [],
    temperature_trend: [],
    disease_breakdown: [],
    forecast_risk_trend: [],
    top_recommendations: [],
  };

  const riskClass = `risk-${(summary.risk_level || 'LOW').toLowerCase()}`;
  const hasAnalysisData = summary.total_scans > 0 || summary.sensor_sample_count > 0 || summary.recommendation_count > 0;
  const healthyShare = summary.total_scans > 0 ? summary.healthy_rate : 0;
  const diseaseShare = summary.total_scans > 0
    ? (summary.disease_count / summary.total_scans) * 100
    : 0;
  const topDiseaseDisplay = summary.top_disease_label
    ? translateDiseaseName(summary.top_disease_label)
    : (summary.total_scans > 0 && summary.disease_count === 0 ? t('disease', 'healthy') : noDataText);
  const topDriver = summary.disease_breakdown[0]
    ? `${translateDiseaseName(summary.disease_breakdown[0].name)} · ${summary.disease_breakdown[0].pct}%`
    : topDiseaseDisplay;
  const latestRecommendationText = localizeRecommendation(summary.latest_recommendation) || t('analysis', 'noRecommendationYet');

  let overviewHeadline = t('analysis', 'overviewStableTitle');
  let overviewBody = t('analysis', 'overviewStableBody');
  if (summary.risk_level === 'HIGH') {
    overviewHeadline = t('analysis', 'overviewHighRiskTitle');
    overviewBody = t('analysis', 'overviewHighRiskBody');
  } else if (summary.risk_level === 'MEDIUM') {
    overviewHeadline = t('analysis', 'overviewWatchTitle');
    overviewBody = t('analysis', 'overviewWatchBody');
  }

  const overviewMetrics = [
    { label: t('analysis', 'healthyRate'), value: formatPercent(summary.healthy_rate) },
    { label: t('analysis', 'topDisease'), value: topDiseaseDisplay, compact: true },
    { label: t('analysis', 'highRiskDays'), value: summary.high_risk_days },
    { label: t('analysis', 'confidenceSignal'), value: formatPercent(summary.average_confidence) },
  ];

  const detectionHighlights = [
    {
      label: t('analysis', 'healthyRate'),
      value: formatPercent(summary.healthy_rate),
      hint: `${summary.healthy_count} / ${summary.total_scans || 0}`,
    },
    {
      label: t('analysis', 'diseaseShare'),
      value: formatPercent(diseaseShare),
      hint: `${summary.disease_count} / ${summary.total_scans || 0}`,
    },
    {
      label: t('analysis', 'topDriver'),
      value: topDriver,
      hint: t('analysis', 'diseaseBreakdown'),
      compact: true,
    },
    {
      label: t('analysis', 'dataCoverage'),
      value: summary.sensor_sample_count,
      hint: t('analysis', 'sensorSamples30d'),
    },
  ];

  const riskMetrics = [
    {
      label: t('analysis', 'compositeRiskScore'),
      value: `${summary.risk_score}/100`,
    },
    {
      label: t('analysis', 'recentDiseaseRatio'),
      value: formatPercent(summary.disease_rate),
    },
    {
      label: t('analysis', 'averageConfidence'),
      value: formatPercent(summary.average_confidence),
    },
    {
      label: t('analysis', 'forecastHighRiskDays'),
      value: summary.high_risk_days,
    },
  ];

  const recommendationMetrics = [
    {
      label: t('analysis', 'totalRecommendations'),
      value: summary.recommendation_count,
    },
    {
      label: t('analysis', 'forecastStableDays'),
      value: summary.stable_days,
    },
    {
      label: t('analysis', 'totalScans'),
      value: summary.total_scans,
    },
    {
      label: t('analysis', 'sensorSamples30d'),
      value: summary.sensor_sample_count,
    },
  ];

  return (
    <div className="analysis-page">
      <div className="section-header analysis-header">
        <div className="analysis-title-group">
          <span className="section-title">{t('analysis', 'title')}</span>
          <p className="analysis-subtitle">{t('analysis', 'insightsLive')}</p>
        </div>
        <div className="analysis-header-actions">
          <div className="analysis-live-pill">
            <span className="analysis-live-dot"></span>
            {t('analysis', 'liveOverview')}
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="analysis-loading">{t('analysis', 'loading')}</div>
      ) : !hasAnalysisData ? (
        <div className="analysis-empty-state">
          <div className="analysis-empty-icon">
            <MdInsights />
          </div>
          <h3>{t('analysis', 'noAnalysisDataTitle')}</h3>
          <p>{t('analysis', 'noAnalysisDataBody')}</p>
        </div>
      ) : (
        <>
          <section className={`analysis-overview-card ${riskClass}`}>
            <div className="analysis-overview-main">
              <div className="analysis-overview-badges">
                <span className={`analysis-risk-badge ${riskClass}`}>{riskLevelText(summary.risk_level)}</span>
                <span className="analysis-meta-chip">{summary.total_scans} {t('analysis', 'totalScans')}</span>
                <span className="analysis-meta-chip">{summary.sensor_sample_count} {t('analysis', 'sensorSamples30d')}</span>
              </div>
              <h3 className="analysis-overview-title">{overviewHeadline}</h3>
              <p className="analysis-overview-copy">{overviewBody}</p>

              <div className="analysis-score-row">
                <div className="analysis-score-display">
                  <span className="analysis-score-label">{t('analysis', 'compositeRiskScore')}</span>
                  <strong className="analysis-score-value">
                    {summary.risk_score}
                    <small>/100</small>
                  </strong>
                </div>
                <div className="analysis-score-meter" aria-hidden="true">
                  <span
                    className={`analysis-score-fill ${riskClass}`}
                    style={{ width: `${Math.max(0, Math.min(100, summary.risk_score))}%` }}
                  ></span>
                </div>
              </div>
            </div>

            <div className="analysis-overview-side">
              <div className="analysis-kpi-grid">
                {overviewMetrics.map((metric) => (
                  <div key={metric.label} className="analysis-kpi-card">
                    <span className="kpi-label">{metric.label}</span>
                    <span className={`kpi-value ${metric.compact ? 'compact' : ''}`}>{metric.value}</span>
                  </div>
                ))}
              </div>

              <div className="analysis-balance-card">
                <div className="analysis-balance-header">
                  <span>{t('analysis', 'scanBalance')}</span>
                  <strong>{formatPercent(healthyShare)}</strong>
                </div>
                <div className="analysis-balance-track">
                  <span
                    className="analysis-balance-fill healthy"
                    style={{ width: `${Math.max(0, Math.min(100, healthyShare))}%` }}
                  ></span>
                  <span
                    className="analysis-balance-fill disease"
                    style={{ width: `${Math.max(0, Math.min(100, diseaseShare))}%` }}
                  ></span>
                </div>
                <div className="analysis-balance-legend">
                  <span>{t('analysis', 'healthyDetections')}: {summary.healthy_count}</span>
                  <span>{t('analysis', 'diseaseDetections')}: {summary.disease_count}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="analysis-content">
            <section className="analysis-card analysis-card-wide">
              <div className="analysis-card-heading">
                <div className="analysis-card-icon">
                  <MdInsights />
                </div>
                <div>
                  <h4>{t('analysis', 'diseasePatterns')}</h4>
                  <p>{t('analysis', 'diseasePatternsDesc')}</p>
                </div>
              </div>

              <div className="analysis-breakdown-layout">
                <div className="analysis-breakdown-list">
                  {summary.disease_breakdown.length === 0 ? (
                    <span className="mini-empty">
                      {summary.total_scans > 0 && summary.disease_count === 0
                        ? t('analysis', 'healthyOnlyBreakdown')
                        : noDataText}
                    </span>
                  ) : (
                    summary.disease_breakdown.map((item) => (
                      <div key={item.name} className="analysis-breakdown-item">
                        <div className="analysis-breakdown-top">
                          <span>{translateDiseaseName(item.name)}</span>
                          <strong>{item.pct}%</strong>
                        </div>
                        <div className="breakdown-track">
                          <span className="breakdown-fill" style={{ width: `${item.pct}%` }}></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="analysis-side-facts">
                  {detectionHighlights.map((item) => (
                    <div key={item.label} className="analysis-stat-tile">
                      <span>{item.label}</span>
                      <strong className={item.compact ? 'analysis-stat-compact' : ''}>{item.value}</strong>
                      <small>{item.hint}</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="analysis-card">
              <div className="analysis-card-heading">
                <div className="analysis-card-icon">
                  <MdOutlineThermostat />
                </div>
                <div>
                  <h4>{t('analysis', 'environmentSnapshot')}</h4>
                  <p>{t('analysis', 'envCorrelationsDesc')}</p>
                </div>
              </div>

              <div className="analysis-signal-grid">
                <div className="analysis-signal-panel healthy">
                  <div className="analysis-signal-header">
                    <span className="signal-dot"></span>
                    {t('analysis', 'healthyBaseline')}
                  </div>
                  <div className="analysis-signal-metrics">
                    <div className="analysis-signal-metric">
                      <span>{t('sensor', 'temperature')}</span>
                      <strong>{formatTempReading(summary.healthy_temp_avg)}</strong>
                    </div>
                    <div className="analysis-signal-metric">
                      <span>{t('sensor', 'humidity')}</span>
                      <strong>{formatHumidityReading(summary.healthy_humidity_avg)}</strong>
                    </div>
                  </div>
                </div>

                <div className="analysis-signal-panel disease">
                  <div className="analysis-signal-header">
                    <span className="signal-dot"></span>
                    {t('analysis', 'diseaseBaseline')}
                  </div>
                  <div className="analysis-signal-metrics">
                    <div className="analysis-signal-metric">
                      <span>{t('sensor', 'temperature')}</span>
                      <strong>{formatTempReading(summary.diseased_temp_avg)}</strong>
                    </div>
                    <div className="analysis-signal-metric">
                      <span>{t('sensor', 'humidity')}</span>
                      <strong>{formatHumidityReading(summary.diseased_humidity_avg)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="analysis-gap-grid">
                <div className="analysis-gap-card">
                  <span>{t('sensor', 'temperature')}</span>
                  <strong>{formatTempGap(summary.diseased_temp_avg, summary.healthy_temp_avg)}</strong>
                  <small>{t('analysis', 'gapVsHealthy')}</small>
                </div>
                <div className="analysis-gap-card">
                  <span>{t('sensor', 'humidity')}</span>
                  <strong>{formatHumidityGap(summary.diseased_humidity_avg, summary.healthy_humidity_avg)}</strong>
                  <small>{t('analysis', 'gapVsHealthy')}</small>
                </div>
              </div>

              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'temperatureTrend')}</span>
                {renderMiniBars(summary.temperature_trend, 'temp', noDataText)}
              </div>
            </section>

            <section className="analysis-card">
              <div className="analysis-card-heading">
                <div className="analysis-card-icon">
                  <MdWarningAmber />
                </div>
                <div>
                  <h4>{t('analysis', 'riskSignals')}</h4>
                  <p>{t('analysis', 'riskAssessmentDesc')}</p>
                </div>
              </div>

              <div className="analysis-metric-grid">
                {riskMetrics.map((item) => (
                  <div key={item.label} className="analysis-stat-tile">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="analysis-mini-duo">
                <div className="analysis-mini-panel">
                  <span className="mini-label">{t('analysis', 'recentConfidenceTrend')}</span>
                  {renderMiniBars(summary.confidence_trend, 'confidence', noDataText)}
                </div>
                <div className="analysis-mini-panel">
                  <span className="mini-label">{t('analysis', 'forecastOutlook')}</span>
                  {renderMiniBars(summary.forecast_risk_trend, 'risk', noDataText)}
                </div>
              </div>
            </section>

            <section className="analysis-card">
              <div className="analysis-card-heading">
                <div className="analysis-card-icon">
                  <MdChecklist />
                </div>
                <div>
                  <h4>{t('analysis', 'recommendationFocus')}</h4>
                  <p>{t('analysis', 'recSummaryDesc')}</p>
                </div>
              </div>

              <div className="analysis-spotlight">
                <span className="mini-label">{t('analysis', 'recommendationSpotlight')}</span>
                <strong>{latestRecommendationText}</strong>
              </div>

              <div className="analysis-metric-grid">
                {recommendationMetrics.map((item) => (
                  <div key={item.label} className="analysis-stat-tile">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="analysis-recommendation-list">
                <span className="mini-label">{t('analysis', 'topRecommendations')}</span>
                {summary.top_recommendations.length === 0 ? (
                  <span className="mini-empty">{t('analysis', 'noRecommendationYet')}</span>
                ) : (
                  <ol>
                    {summary.top_recommendations.map((recommendation, idx) => (
                      <li key={`${localizeRecommendation(recommendation) || 'recommendation'}-${idx}`}>
                        {localizeRecommendation(recommendation)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          </div>

          <p className="analysis-note">{t('analysis', 'insightsLive')}</p>
        </>
      )}
    </div>
  );
}
