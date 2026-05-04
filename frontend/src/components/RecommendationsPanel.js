import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { formatDateEAT, formatTimeAgo } from '../utils/formatTime';

export default function RecommendationsPanel({ recommendations, loading }) {
  const { lang, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const getTitle = (rec) => {
    if (lang === 'am' && rec.title_am) return rec.title_am;
    return rec.title;
  };

  const getDescription = (rec) => {
    if (lang === 'am' && rec.description_am) return rec.description_am;
    return rec.description;
  };

  const getRecommendationIcon = (rec) => {
    const s = ((rec.title || '') + ' ' + (rec.description || '') + ' ' + (rec.title_am || '') + ' ' + (rec.description_am || '')).toLowerCase();
    
    // Explicit matches from ESP32 Firmware profiles
    if (s.includes('anthracnose') || s.includes('አንትራክኖዝ')) return 'fa-bug';
    if (s.includes('powdery') || s.includes('mildew') || s.includes('ሻጋታ')) return 'fa-smog';
    if (s.includes('healthy') || s.includes('ጤናማ')) return 'fa-seedling';
    
    // Action matches
    if (s.includes('copper') || s.includes('sulfur') || s.includes('fungicide') || s.includes('ማጥፊያ') || s.includes('መርጨት') || s.includes('spray')) return 'fa-bottle-droplet';
    if (s.includes('prune') || s.includes('branches') || s.includes('ቅርንጫፎች') || s.includes('መግረዝ')) return 'fa-scissors';
    if (s.includes('sanitation') || s.includes('ጽዳት') || s.includes('maintenance')) return 'fa-broom';
    if (s.includes('monitor') || s.includes('ክትትል')) return 'fa-eye';

    return 'fa-lightbulb';
  };

  const getIconColor = (rec) => {
    const s = ((rec.title || '') + ' ' + (rec.description || '') + ' ' + (rec.title_am || '') + ' ' + (rec.description_am || '')).toLowerCase();
    
    // Disease specific colors
    if (s.includes('anthracnose') || s.includes('አንትራክኖዝ')) return '#f85149';
    if (s.includes('powdery') || s.includes('mildew') || s.includes('ሻጋታ')) return '#d29922';
    
    // Status
    if (s.includes('healthy') || s.includes('ጤናማ')) return '#3fb950';
    if (s.includes('risk') || s.includes('ስጋት')) return '#d29922';
    if (s.includes('monitor') || s.includes('ክትትል')) return '#2f81f7';
    
    return '#2f81f7';
  };

  if (loading) {
    return (
      <div className="recommendation-container">
        <div className="section-header">
          <span className="section-title">{t('rec', 'title')}</span>
        </div>
        <div className="recommendation-skeleton-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="recommendation-card loading">
              <div className="recommendation-header">
                <div className="rec-icon-circle skeleton-box"></div>
                <div className="rec-content">
                  <div className="skeleton-line skeleton-subline"></div>
                  <div className="skeleton-line skeleton-label"></div>
                </div>
              </div>
              <div className="skeleton-line skeleton-body"></div>
              <div className="skeleton-line skeleton-body short"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const latestTimestamp = recommendations[0]?.timestamp ? formatDateEAT(recommendations[0].timestamp, lang) : null;
  const visibleRecs = expanded ? recommendations : recommendations.slice(0, 3);

  return (
    <div className="recommendation-container">
      <div className="section-header">
        <span className="section-title">{t('rec', 'title')}</span>
        <span className="recommendation-count">
          {recommendations.length} {recommendations.length === 1 ? t('rec', 'tip') : t('rec', 'tips')}
        </span>
      </div>
      {latestTimestamp && (
        <div className="card-updated-label">
          {t('common', 'lastUpdated')}: {latestTimestamp}
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="recommendation-card">
          <span className="recommendation-title">{t('rec', 'allHealthy')}</span>
          <span className="recommendation-desc">{t('rec', 'allHealthyDesc')}</span>
          <span className="recommendation-help">{t('rec', 'noRecentAdvice')}</span>
        </div>
      ) : (
        <>
          {visibleRecs.map((rec, index) => {
            const title = getTitle(rec);
            return (
              <div key={index} className="recommendation-card">
                <div className="recommendation-header">
                  <div className="rec-icon-circle" style={{ background: `${getIconColor(rec)}15` }}>
                    <i
                      className={`fa-solid ${getRecommendationIcon(rec)}`}
                      style={{ color: getIconColor(rec) }}
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
          })}
          {recommendations.length > 3 && (
            <div className="recommendation-view-all" style={{ textAlign: 'center', marginTop: '12px' }}>
              <button 
                className="auth-link" 
                onClick={() => setExpanded(!expanded)}
                style={{ fontSize: '13px', padding: '4px 8px' }}
              >
                {expanded ? (t('rec', 'showLess') || 'Show less') : (t('rec', 'viewAll') || 'View all')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
