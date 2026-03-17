import React, { useState } from 'react';
import { useAPI } from '../hooks/useAPI';
import { formatDateEAT } from '../utils/formatTime';
import { useLanguage } from '../context/LanguageContext';

export default function LogsPage() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, loading, error } = useAPI(`/detection/history?page=${page}&limit=${limit}`);

  const handleNextPage = () => {
    if (data && page < data.total_pages) setPage(page + 1);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  return (
    <div className="logs-page">
      <div className="section-header">
        <span className="section-title">{t('logs', 'title')}</span>
      </div>

      {error && (
        <div className="error-message">
          {t('common', 'error')}: {error}
        </div>
      )}

      {loading ? (
        <div className="loading-message">{t('logs', 'loading')}</div>
      ) : !data || !data.data || data.data.length === 0 ? (
        <div className="empty-message">{t('logs', 'empty')}</div>
      ) : (
        <>
          <div className="table-container">
            <table className="detection-table">
              <thead>
                <tr>
                  <th>{t('logs', 'timestamp')}</th>
                  <th>{t('logs', 'diseaseClass')}</th>
                  <th>{t('logs', 'confidence')}</th>
                  <th>{t('logs', 'temperature')}</th>
                  <th>{t('logs', 'humidity')}</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((detection, index) => (
                  <tr key={index}>
                    <td>{formatDateEAT(detection.timestamp)}</td>
                    <td>
                      <span className={`disease-badge ${detection.disease_type.toLowerCase()}`}>
                        {detection.disease_type}
                      </span>
                    </td>
                    <td>{(detection.confidence_score * 100).toFixed(1)}%</td>
                    <td>{detection.temperature ? `${detection.temperature.toFixed(1)}°C` : 'N/A'}</td>
                    <td>{detection.humidity ? `${detection.humidity.toFixed(1)}%` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button className="pagination-btn" onClick={handlePreviousPage} disabled={page === 1}>
              {t('logs', 'previous')}
            </button>
            <span className="page-info">
              {t('logs', 'pageOf')} {data.page} {t('logs', 'of')} {data.total_pages} ({data.total} {t('logs', 'total')})
            </span>
            <button className="pagination-btn" onClick={handleNextPage} disabled={page >= data.total_pages}>
              {t('logs', 'next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
