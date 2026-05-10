import React from 'react';
import { formatDateEAT, formatTimeAgo } from '../utils/formatTime';
import { useLanguage } from '../context/LanguageContext';
import { MdShield, MdCheckCircle } from 'react-icons/md';

const DISEASE_NAMES = {
  'Healthy': 'healthy',
  'Anthracnose': 'anthracnose',
  'Powdery Mildew': 'powderyMildew',
  'Die Back': 'dieBack',
};

export default function DiseaseStatusCard({ detection, loading, freshness, scanRecommendation }) {
  const { lang, t } = useLanguage();

  if (loading) {
    return (
      <div className="disease-status-card skeleton-state">
        <div className="disease-status-content">
          <div className="disease-status-text">
            <div className="skeleton-line skeleton-chip"></div>
            <div className="skeleton-line skeleton-heading skeleton-delay-1"></div>
            <div className="skeleton-line skeleton-subline skeleton-delay-2"></div>
            <div className="skeleton-line skeleton-subline short skeleton-delay-3"></div>
          </div>
          <div className="skeleton-circle skeleton-delay-1"></div>
        </div>
      </div>
    );
  }

  if (!detection) {
    return (
      <div className="disease-status-card skeleton-state">
        <div className="disease-status-content">
          <div className="disease-status-text">
            <div className="skeleton-line skeleton-chip skeleton-delay-1"></div>
            <div className="skeleton-line skeleton-heading skeleton-delay-2"></div>
            <div className="skeleton-line skeleton-subline skeleton-delay-3"></div>
            <div className="skeleton-line skeleton-subline short skeleton-delay-4"></div>
          </div>
          <div className="skeleton-circle skeleton-delay-2"></div>
        </div>
      </div>
    );
  }

  const isHealthy = detection.disease_type === 'Healthy';

  // Only show the Nano's scan recommendation when there is an active disease detection
  const activeRec = !isHealthy && scanRecommendation ? scanRecommendation : null;
  const recTitle = activeRec
    ? (lang === 'am' && activeRec.title_am ? activeRec.title_am : activeRec.title)
    : null;
  const recDesc = activeRec
    ? (lang === 'am' && activeRec.description_am ? activeRec.description_am : activeRec.description)
    : null;
  
  let statusClass = 'optimal';
  if (detection.disease_type === 'Powdery Mildew' || (detection.disease_type && detection.disease_type.toLowerCase().includes('powdery'))) {
    statusClass = 'mildew';
  } else if (detection.disease_type === 'Anthracnose' || (detection.disease_type && detection.disease_type.toLowerCase().includes('anthracnose'))) {
    statusClass = 'anthracnose';
  } else if (detection.disease_type === 'Die Back' || (detection.disease_type && detection.disease_type.toLowerCase().includes('die'))) {
    statusClass = 'warning';
  } else if (!isHealthy) {
    statusClass = 'warning';
  }

  const diseaseKey = DISEASE_NAMES[detection.disease_type];
  const diseaseName = diseaseKey ? t('disease', diseaseKey) : detection.disease_type;
  const freshnessLabel = freshness?.statusLabel || t('common', 'live');
  const freshnessClass = freshness?.statusClass || 'live';
  const lastUpdatedText = detection.timestamp ? formatDateEAT(detection.timestamp, lang) : null;

  return (
    <div className={`disease-status-card status-${statusClass}`}>
      <div className="disease-status-content">
        <div className="disease-status-text">
          <h4 className="disease-status-title">{t('disease', 'healthStatus')}</h4>
          <p className="disease-status-value">{diseaseName}</p>
          {freshnessClass === 'live' && <div className={`status-pill ${freshnessClass}`}>{freshnessLabel}</div>}
          <div className="disease-status-details">
            <span className="confidence">
              {(detection.confidence_score * 100).toFixed(1)}% {t('disease', 'confidence')}
            </span>
            <span className="time-ago">
              {t('disease', 'lastScan')}: {formatTimeAgo(detection.timestamp, lang)}
            </span>
          </div>
          {lastUpdatedText && (
            <div className="card-updated-label">
              {t('common', 'lastUpdated')}: {lastUpdatedText}
            </div>
          )}
          {activeRec && (
            <div className="scan-rec-banner">
              {recTitle && <span className="scan-rec-title">{recTitle}</span>}
              {recDesc && <span className="scan-rec-desc">{recDesc}</span>}
            </div>
          )}
        </div>
        <div className="disease-status-icon-wrapper">
          <MdShield className="disease-status-icon" />
          <div className="disease-status-checkmark">
            <MdCheckCircle className="disease-checkmark-icon" />
          </div>
        </div>
      </div>
    </div>
  );
}
