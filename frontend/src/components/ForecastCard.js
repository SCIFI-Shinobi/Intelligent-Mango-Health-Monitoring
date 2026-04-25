import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function ForecastCard({ forecast, loading }) {
  const { t, lang } = useLanguage();
  const forecastLocale = lang === 'am' ? 'am-ET' : 'en-US';

  if (loading) {
    return (
      <div className="forecast-section">
        <div className="section-header">
          <span className="section-title">{t('forecast', 'title')}</span>
        </div>
        <div className="forecast-grid skeleton">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="forecast-day-card loading">
              <div className="skeleton-line skeleton-label"></div>
              <div className="skeleton-line skeleton-heading"></div>
              <div className="skeleton-box forecast-pill-skeleton"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!forecast || !forecast.days || forecast.days.length === 0) {
    return (
      <div className="forecast-section">
        <div className="section-header">
          <span className="section-title">{t('forecast', 'title')}</span>
        </div>
        <div className="forecast-empty">
          <strong>{t('forecast', 'noData')}</strong>
          <div className="message-hint">{t('forecast', 'waitingForForecast')}</div>
        </div>
      </div>
    );
  }

  const normalizeRisk = (riskLevel) => {
    const r = (riskLevel || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (r.includes('anthracnose')) return 'anthracnose';
    if (r.includes('mildew') || r.includes('powdery')) return 'mildew';
    if (r === 'stable' || r === 'safe' || r === 'healthy' || r === 'low') return 'stable';
    if (r.includes('high') || r.includes('risk')) return 'anthracnose';
    return 'stable';
  };

  const RISK_MAP = {
    stable:      { color: '#3fb950', icon: 'fa-seedling',        labelKey: 'stable' },
    anthracnose: { color: '#f85149', icon: 'fa-bug',   labelKey: 'anthracnoseRisk' },
    mildew:      { color: '#d29922', icon: 'fa-smog', labelKey: 'mildewRisk' },
  };

  const getRisk = (riskLevel) => RISK_MAP[normalizeRisk(riskLevel)] || RISK_MAP.stable;

  const rawForecastDate = forecast?.created_at || forecast?.context?.timestamp;

  const getForecastBaseDate = () => {
    if (rawForecastDate) {
      const parsed = new Date(rawForecastDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  };

  const getDayLabel = (day, index) => {
    if (day?.date) {
      const parsed = new Date(day.date);
      if (!Number.isNaN(parsed.getTime())) {
        const dayName = parsed.toLocaleDateString(forecastLocale, { weekday: 'short' });
        const dayNum = parsed.getDate();
        return { dayName, dayNum };
      }
    }

    const baseDate = getForecastBaseDate();
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index + 1);
    const dayName = date.toLocaleDateString(forecastLocale, { weekday: 'short' });
    const dayNum = date.getDate();
    return { dayName, dayNum };
  };

  let forecastDateText = null;
  if (rawForecastDate) {
    const parsedDate = new Date(rawForecastDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      forecastDateText = parsedDate.toLocaleDateString(forecastLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  return (
    <div className="forecast-section">
      <div className="forecast-header">
        <div className="forecast-title-row">
          <i className="fa-solid fa-cloud-sun forecast-title-icon"></i>
          <span className="section-title">{t('forecast', 'title')}</span>
        </div>
      </div>

      <div className="forecast-grid">
        {forecast.days.map((day, index) => {
          const { dayName, dayNum } = getDayLabel(day, index);
          const risk = getRisk(day.risk_level);
          return (
            <div key={index} className="forecast-day-card">
              <div className="forecast-day-label">
                <span className="forecast-day-name">{dayName}</span>
                <span className="forecast-day-num">{dayNum}</span>
              </div>
              <div
                className="forecast-risk-pill"
                style={{ backgroundColor: `${risk.color}18`, borderColor: `${risk.color}40` }}
              >
                <i className={`fa-solid ${risk.icon}`} style={{ color: risk.color, fontSize: '18px' }}></i>
                <span className="risk-text" style={{ color: risk.color }}>
                  {t('forecast', risk.labelKey)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="forecast-footer">
        <div className="forecast-legend-row">
          <span className="legend-item"><span className="legend-dot" style={{ background: '#3fb950' }}></span> {t('forecast', 'stable')}</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#f85149' }}></span> {t('forecast', 'anthracnoseRisk')}</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#d29922' }}></span> {t('forecast', 'mildewRisk')}</span>
        </div>
        <span className="forecast-source">{t('forecast', 'source')}</span>
      </div>

      {forecastDateText && (
        <div className="forecast-generated-date">
          {t('forecast', 'forecastDate')} {forecastDateText}
        </div>
      )}
    </div>
  );
}
