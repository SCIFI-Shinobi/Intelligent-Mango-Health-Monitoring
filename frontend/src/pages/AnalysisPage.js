import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function AnalysisPage() {
  const { t } = useLanguage();

  return (
    <div className="analysis-page">
      <div className="section-header">
        <span className="section-title">{t('analysis', 'title')}</span>
      </div>

      <div className="analysis-content">
        <div className="analysis-card">
          <h4>{t('analysis', 'diseasePatterns')}</h4>
          <p>{t('analysis', 'diseasePatternsDesc')}</p>
        </div>

        <div className="analysis-card">
          <h4>{t('analysis', 'envCorrelations')}</h4>
          <p>{t('analysis', 'envCorrelationsDesc')}</p>
        </div>

        <div className="analysis-card">
          <h4>{t('analysis', 'riskAssessment')}</h4>
          <p>{t('analysis', 'riskAssessmentDesc')}</p>
        </div>

        <div className="analysis-card">
          <h4>{t('analysis', 'recSummary')}</h4>
          <p>{t('analysis', 'recSummaryDesc')}</p>
        </div>
      </div>

      <p className="analysis-note">{t('analysis', 'comingSoon')}</p>
    </div>
  );
}
