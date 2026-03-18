import React from 'react';
import { formatTimeAgo } from '../utils/formatTime';
import { useLanguage } from '../context/LanguageContext';
import { MdShield, MdCheckCircle } from 'react-icons/md';

const DISEASE_NAMES = {
  'Healthy': 'healthy',
  'Anthracnose': 'anthracnose',
  'Powdery Mildew': 'powderyMildew',
};

export default function DiseaseStatusCard({ detection, loading }) {
  const { lang, t } = useLanguage();

  if (loading) {
    return (
      <div className="disease-status-card">
        <div className="card-skeleton">{t('disease', 'loading')}</div>
      </div>
    );
  }

  if (!detection) {
    return (
      <div className="disease-status-card status-unknown">
        <div className="disease-status-content">
          <div className="disease-status-text">
            <h4 className="disease-status-title">{t('disease', 'healthStatus')}</h4>
            <p className="disease-status-value">{t('disease', 'noData')}</p>
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
  const statusClass = isHealthy ? 'optimal' : 'warning';
  const diseaseKey = DISEASE_NAMES[detection.disease_type];
  const diseaseName = diseaseKey ? t('disease', diseaseKey) : detection.disease_type;

  return (
    <div className={`disease-status-card status-${statusClass}`}>
      <div className="disease-status-content">
        <div className="disease-status-text">
          <h4 className="disease-status-title">{t('disease', 'healthStatus')}</h4>
          <p className="disease-status-value">{diseaseName}</p>
          <div className="disease-status-details">
            <span className="confidence">
              {(detection.confidence_score * 100).toFixed(1)}% {t('disease', 'confidence')}
            </span>
            <span className="time-ago">
              {t('disease', 'lastScan')}: {formatTimeAgo(detection.timestamp, lang)}
            </span>
          </div>
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
