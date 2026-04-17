import React, { useContext } from 'react';
import { useAPI } from '../hooks/useAPI';
import { useLanguage } from '../context/LanguageContext';
import { SettingsContext } from '../context/SettingsContext';

export default function AnalysisPage() {
  const { t, lang } = useLanguage();
  const { settings, formatTemp } = useContext(SettingsContext);
  const { data: analysis, loading, error } = useAPI('/analysis/summary');

  const tempUnitString = settings?.temperatureUnit === 'fahrenheit' ? 'F' : 'C';
  const noDataText = t('analysis', 'notAvailable');

  const formatNumber = (value, digits = 1) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return noDataText;
    return value.toFixed(digits);
  };

  const riskLevelText = (level) => {
    if (level === 'HIGH') return t('analysis', 'high');
    if (level === 'MEDIUM') return t('analysis', 'medium');
    return t('analysis', 'low');
  };

  const translateDiseaseName = (diseaseName) => {
    if (!diseaseName) return noDataText;
    const lowerName = diseaseName.toLowerCase().trim();

    if (lowerName === 'healthy') return t('disease', 'healthy');
    if (lowerName === 'anthracnose') return t('disease', 'anthracnose');
    if (lowerName === 'powdery mildew' || lowerName === 'powderymildew') return t('disease', 'powderyMildew');

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

  return (
    <div className="analysis-page">
      <div className="section-header">
        <span className="section-title">{t('analysis', 'title')}</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="analysis-loading">{t('analysis', 'loading')}</div>
      ) : (
        <>
          <div className="analysis-kpi-grid">
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'totalScans')}</span>
              <span className="kpi-value">{summary.total_scans}</span>
            </div>
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'healthyRate')}</span>
              <span className="kpi-value">{formatNumber(summary.healthy_rate)}%</span>
            </div>
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'riskLevel')}</span>
              <span className={`kpi-value risk-${summary.risk_level.toLowerCase()}`}>{riskLevelText(summary.risk_level)}</span>
            </div>
            <div className="analysis-kpi-card">
              <span className="kpi-label">{t('analysis', 'topDisease')}</span>
              <span className="kpi-value compact">{translateDiseaseName(summary.top_disease_label)}</span>
            </div>
          </div>

          <div className="analysis-content">
            <div className="analysis-card">
              <h4>{t('analysis', 'diseasePatterns')}</h4>
              <p>{t('analysis', 'diseasePatternsDesc')}</p>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'healthyDetections')}</span>
                <strong>{summary.healthy_count}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'diseaseDetections')}</span>
                <strong>{summary.disease_count}</strong>
              </div>
              <div className="analysis-progress-track">
                <div className="analysis-progress-fill healthy" style={{ width: `${Math.max(0, Math.min(100, summary.healthy_rate))}%` }}></div>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'diseaseBreakdown')}</span>
                {summary.disease_breakdown.length === 0 ? (
                  <span className="mini-empty">{noDataText}</span>
                ) : (
                  <div className="analysis-breakdown-list">
                    {summary.disease_breakdown.map((item) => (
                      <div key={item.name} className="analysis-breakdown-item">
                        <span>{translateDiseaseName(item.name)}</span>
                        <strong>{item.pct}%</strong>
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
                <strong>{summary.healthy_temp_avg != null ? `${formatTemp(summary.healthy_temp_avg)} °${tempUnitString}` : noDataText}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'diseaseAvgTemp')}</span>
                <strong>{summary.diseased_temp_avg != null ? `${formatTemp(summary.diseased_temp_avg)} °${tempUnitString}` : noDataText}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'healthyAvgHumidity')}</span>
                <strong>{formatNumber(summary.healthy_humidity_avg)}%</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'diseaseAvgHumidity')}</span>
                <strong>{formatNumber(summary.diseased_humidity_avg)}%</strong>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'temperatureTrend')}</span>
                {renderMiniBars(summary.temperature_trend, 'temp', noDataText)}
              </div>
            </div>

            <div className="analysis-card">
              <h4>{t('analysis', 'riskAssessment')}</h4>
              <p>{t('analysis', 'riskAssessmentDesc')}</p>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'compositeRiskScore')}</span>
                <strong>{summary.risk_score}/100</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'recentDiseaseRatio')}</span>
                <strong>{formatNumber(summary.disease_rate)}%</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'averageConfidence')}</span>
                <strong>{formatNumber(summary.average_confidence)}%</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'forecastHighRiskDays')}</span>
                <strong>{summary.high_risk_days}</strong>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'recentConfidenceTrend')}</span>
                {renderMiniBars(summary.confidence_trend, 'confidence', noDataText)}
              </div>
            </div>

            <div className="analysis-card">
              <h4>{t('analysis', 'recSummary')}</h4>
              <p>{t('analysis', 'recSummaryDesc')}</p>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'totalRecommendations')}</span>
                <strong>{summary.recommendation_count}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'latestRecommendation')}</span>
                <strong className="metric-compact">{localizeRecommendation(summary.latest_recommendation) || noDataText}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'forecastStableDays')}</span>
                <strong>{summary.stable_days}</strong>
              </div>
              <div className="analysis-metric-row">
                <span>{t('analysis', 'sensorSamples30d')}</span>
                <strong>{summary.sensor_sample_count}</strong>
              </div>
              <div className="analysis-mini-chart">
                <span className="mini-label">{t('analysis', 'forecastOutlook')}</span>
                {renderMiniBars(summary.forecast_risk_trend, 'risk', noDataText)}
              </div>
              <div className="analysis-recommendation-list">
                <span className="mini-label">{t('analysis', 'topRecommendations')}</span>
                {summary.top_recommendations.length === 0 ? (
                  <span className="mini-empty">{noDataText}</span>
                ) : (
                  <ul>
                    {summary.top_recommendations.map((recommendation, idx) => (
                      <li key={`${localizeRecommendation(recommendation) || 'recommendation'}-${idx}`}>
                        {localizeRecommendation(recommendation)}
                      </li>
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
