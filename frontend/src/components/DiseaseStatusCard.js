import React from 'react';
import { formatDateEAT, formatTimeAgo } from '../utils/formatTime';
import { useLanguage } from '../context/LanguageContext';
import { MdShield, MdCheckCircle } from 'react-icons/md';

const DISEASE_NAMES = {
  'Healthy': 'healthy',
  'Anthracnose': 'anthracnose',
  'Powdery Mildew': 'powderyMildew',
};

export default function DiseaseStatusCard({ detection, loading, freshness }) {
  const { lang, t } = useLanguage();

  if (loading) {
    return (
      <div className="disease-status-card loading">
        <div className="disease-status-content">
          <div className="disease-status-text">
            <div className="skeleton-line skeleton-chip"></div>
            <div className="skeleton-line skeleton-heading"></div>
            <div className="skeleton-line skeleton-subline"></div>
            <div className="skeleton-line skeleton-subline short"></div>
          </div>
          <div className="skeleton-circle"></div>
        </div>
      </div>
    );
  }

  if (!detection) {
    return (
      <div className="disease-status-card status-unknown">
        <div className="disease-status-content">
          <div className="disease-status-text">
            <h4 className="disease-status-title">{t('disease', 'healthStatus')}</h4>
            <p className="disease-status-value">{t('disease', 'waitingForDevice')}</p>
            <div className="disease-status-note">{t('disease', 'noRecentDeviceData')}</div>
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

  const isHealthy = detection.disease_type === 'Healthy';
  
  let statusClass = 'optimal';
  if (detection.disease_type === 'Powdery Mildew' || (detection.disease_type && detection.disease_type.toLowerCase().includes('powdery'))) {
    statusClass = 'mildew';
  } else if (detection.disease_type === 'Anthracnose' || (detection.disease_type && detection.disease_type.toLowerCase().includes('anthracnose'))) {
    statusClass = 'anthracnose';
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
          <div className={`status-pill ${freshnessClass}`}>{freshnessLabel}</div>
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
          {freshness?.isStale && (
            <div className="disease-status-note">{t('disease', 'noRecentDeviceData')}</div>
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
