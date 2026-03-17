import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const SEASON_MAP = {
  'dry': { name: 'Bega', icon: 'fa-sun' },
  'bega': { name: 'Bega', icon: 'fa-sun' },
  'belg': { name: 'Belg', icon: 'fa-cloud-sun-rain' },
  'wet': { name: 'Kiremt', icon: 'fa-cloud-showers-heavy' },
  'kiremt': { name: 'Kiremt', icon: 'fa-cloud-showers-heavy' },
};

const SEASON_DESC_KEY = {
  'dry': 'bega', 'bega': 'bega',
  'belg': 'belg',
  'wet': 'kiremt', 'kiremt': 'kiremt',
};

export default function ForecastCard({ forecast, loading }) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="forecast-section">
        <div className="section-header">
          <span className="section-title">{t('forecast', 'title')}</span>
        </div>
        <div className="forecast-loading">{t('forecast', 'loading')}</div>
      </div>
    );
  }

  if (!forecast || !forecast.days || forecast.days.length === 0) {
    return (
      <div className="forecast-section">
        <div className="section-header">
          <span className="section-title">{t('forecast', 'title')}</span>
        </div>
        <div className="forecast-empty">{t('forecast', 'noData')}</div>
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
    stable:      { color: '#3fb950', icon: 'fa-shield-halved',        labelKey: 'stable' },
    anthracnose: { color: '#f85149', icon: 'fa-circle-exclamation',   labelKey: 'anthracnoseRisk' },
    mildew:      { color: '#d29922', icon: 'fa-triangle-exclamation', labelKey: 'mildewRisk' },
  };

  const getRisk = (riskLevel) => RISK_MAP[normalizeRisk(riskLevel)] || RISK_MAP.stable;

  const getDayLabel = (index) => {
    const today = new Date();
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    return { dayName, dayNum, isFirst: index === 0 };
  };

  const seasonRaw = forecast.context?.season?.toLowerCase() || 'dry';
  const season = SEASON_MAP[seasonRaw] || SEASON_MAP['dry'];
  const seasonDescKey = SEASON_DESC_KEY[seasonRaw] || 'bega';

  return (
    <div className="forecast-section">
      <div className="forecast-header">
        <div className="forecast-title-row">
          <i className="fa-solid fa-chart-line forecast-title-icon"></i>
          <span className="section-title">{t('forecast', 'title')}</span>
        </div>
        <div className="forecast-season-badge">
          <i className={`fa-solid ${season.icon}`}></i>
          <span>{season.name}</span>
        </div>
      </div>

      <div className="forecast-context-strip">
        <div className="context-item">
          <i className="fa-solid fa-calendar-day"></i>
          <span>{t('forecast', 'season')}: <strong>{season.name}</strong> ({t('forecast', seasonDescKey)})</span>
        </div>
        <div className="context-item">
          <i className="fa-solid fa-droplet"></i>
          <span>{t('forecast', 'precipitation')}: <strong>{forecast.context.precipitation}mm</strong></span>
        </div>
      </div>

      <div className="forecast-grid">
        {forecast.days.map((day, index) => {
          const { dayName, dayNum, isFirst } = getDayLabel(index);
          const risk = getRisk(day.risk_level);
          return (
            <div key={index} className="forecast-day-card">
              <div className="forecast-day-label">
                <span className="forecast-day-name">{isFirst ? t('forecast', 'tomorrow') : dayName}</span>
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
    </div>
  );
}
