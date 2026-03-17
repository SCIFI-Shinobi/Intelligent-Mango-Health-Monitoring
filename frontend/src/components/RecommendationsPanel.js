import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/formatTime';

export default function RecommendationsPanel({ recommendations, loading }) {
  const { lang, t } = useLanguage();

  const getTitle = (rec) => {
    if (lang === 'am' && rec.title_am) return rec.title_am;
    return rec.title;
  };

  const getDescription = (rec) => {
    if (lang === 'am' && rec.description_am) return rec.description_am;
    return rec.description;
  };

  const getRecommendationIcon = (title) => {
    const s = (title || '').toLowerCase();
    if (s.includes('anthracnose') || s.includes('አንትራክኖዝ')) return 'fa-virus';
    if (s.includes('powdery') || s.includes('mildew') || s.includes('ሻጋታ') || s.includes('ዱቄት')) return 'fa-cloud';
    if (s.includes('humidity') || s.includes('እርጥበት')) return 'fa-droplet';
    if (s.includes('temperature') || s.includes('ሙቀት')) return 'fa-temperature-high';
    if (s.includes('prune') || s.includes('pruning') || s.includes('መግረዝ')) return 'fa-scissors';
    if (s.includes('fungicide') || s.includes('ማጥፊያ') || s.includes('መርጨት')) return 'fa-spray-can-sparkles';
    if (s.includes('soil') || s.includes('drainage') || s.includes('አፈር')) return 'fa-water';
    if (s.includes('harvest') || s.includes('መከር')) return 'fa-apple-whole';
    if (s.includes('healthy') || s.includes('ጤናማ') || s.includes('monitor') || s.includes('ክትትል')) return 'fa-heart-pulse';
    return 'fa-lightbulb';
  };

  const getIconColor = (title) => {
    const s = (title || '').toLowerCase();
    if (s.includes('anthracnose') || s.includes('አንትራክኖዝ')) return '#f85149';
    if (s.includes('powdery') || s.includes('mildew') || s.includes('ሻጋታ')) return '#d29922';
    if (s.includes('humidity') || s.includes('እርጥበት')) return '#3b82f6';
    if (s.includes('healthy') || s.includes('ጤናማ')) return '#3fb950';
    return '#2f81f7';
  };

  if (loading) {
    return (
      <div className="recommendation-container">
        <div className="section-header">
          <span className="section-title">{t('rec', 'title')}</span>
        </div>
        <div className="loading-message">{t('rec', 'loading')}</div>
      </div>
    );
  }

  return (
    <div className="recommendation-container">
      <div className="section-header">
        <span className="section-title">{t('rec', 'title')}</span>
        <span className="recommendation-count">
          {recommendations.length} {recommendations.length === 1 ? t('rec', 'tip') : t('rec', 'tips')}
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="recommendation-card">
          <span className="recommendation-title">{t('rec', 'allHealthy')}</span>
          <span className="recommendation-desc">{t('rec', 'allHealthyDesc')}</span>
        </div>
      ) : (
        recommendations.map((rec, index) => {
          const title = getTitle(rec);
          return (
            <div key={index} className="recommendation-card">
              <div className="recommendation-header">
                <div className="rec-icon-circle" style={{ background: `${getIconColor(title)}15` }}>
                  <i
                    className={`fa-solid ${getRecommendationIcon(title)}`}
                    style={{ color: getIconColor(title) }}
                  ></i>
                </div>
                <div className="rec-content">
                  <span className="recommendation-title">{title}</span>
                  {rec.timestamp && (
                    <span className="rec-time">{formatTimeAgo(rec.timestamp)}</span>
                  )}
                </div>
              </div>
              <span className="recommendation-desc">{getDescription(rec)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
