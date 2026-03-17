import React from 'react';
import { formatTimeAgo } from '../utils/formatTime';
import { useLanguage } from '../context/LanguageContext';

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
      <div className="disease-status-card">
        <span className="section-title">{t('disease', 'diseaseStatus')}</span>
        <span className="status-text">{t('disease', 'noData')}</span>
      </div>
    );
  }

  const isHealthy = detection.disease_type === 'Healthy';
  const statusColor = isHealthy ? 'green' : 'red';
  const diseaseKey = DISEASE_NAMES[detection.disease_type];
  const diseaseName = diseaseKey ? t('disease', diseaseKey) : detection.disease_type;

  return (
    <div className={`disease-status-card status-${statusColor}`}>
      <div className="status-header">
        <div className={`status-dot ${statusColor}`}></div>
        <span className="section-title">{t('disease', 'healthStatus')}</span>
      </div>

      <div className="disease-info">
        <span className="disease-name">{diseaseName}</span>
        <span className="confidence">
          {(detection.confidence_score * 100).toFixed(1)}% {t('disease', 'confidence')}
        </span>
      </div>

      <div className="status-timestamp">
        <span className="label">{t('disease', 'lastScan')}</span>
        <span className="time">{formatTimeAgo(detection.timestamp, lang)}</span>
      </div>
    </div>
  );
}
