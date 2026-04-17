import React, { useState } from 'react';
import { apiCall, useAPI } from '../hooks/useAPI';
import { formatTimeAgo, formatDateEAT } from '../utils/formatTime';
import { exportDetectionLogs } from '../utils/exportCSV';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';

export default function LogsPage() {
  const { lang, t } = useLanguage();
  const { settings, formatTemp } = useSettings();
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const limit = 10;

  const { data, loading, error } = useAPI(`/detection/history?page=${page}&limit=${limit}`);

  const handleExport = async () => {
    try {
      setExporting(true);
      const allData = await apiCall('/detection/history?page=1&limit=1000');
      if (!allData || !allData.data) return;

      const headers = [
        t('logs', 'timestamp'),
        t('logs', 'diseaseClass'),
        t('logs', 'confidence'),
        t('logs', 'temperature'),
        t('logs', 'humidity')
      ];
      exportDetectionLogs(allData.data, headers);
    } catch (exportError) {
      console.error('Failed to export logs:', exportError);
    } finally {
      setExporting(false);
    }
  };

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
        {data && data.data && data.data.length > 0 && (
          <button className="export-btn" onClick={handleExport} disabled={exporting}>
            <i className="fa-solid fa-file-csv"></i>
            {exporting ? t('common', 'loading') : t('logs', 'exportCSV')}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {t('common', 'error')}: {error}
        </div>
      )}

      {loading ? (
        <div className="loading-message logs-loading-state">
          <div className="skeleton-line skeleton-subline"></div>
          <div className="table-skeleton">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="table-skeleton-row"></div>
            ))}
          </div>
        </div>
      ) : !data || !data.data || data.data.length === 0 ? (
        <div className="empty-message">
          <strong>{t('logs', 'empty')}</strong>
          <div className="message-hint">{t('logs', 'emptyHint')}</div>
        </div>
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
                {data.data.map((detection, index) => {
                  const dtype = (detection.disease_type || '').toLowerCase();
                  const isHealthy = dtype === 'healthy';
                  const badgeClass = isHealthy ? 'healthy' : dtype.includes('powdery') ? 'mildew' : 'anthracnose';
                  const diseaseKey = isHealthy ? 'healthy' : dtype.includes('powdery') ? 'powderyMildew' : 'anthracnose';
                  const iconClass = isHealthy ? 'fa-seedling' : dtype.includes('powdery') ? 'fa-smog' : 'fa-bug';
                  return (
                    <tr key={index}>
                      <td>{settings.timeFormat === 'relative' ? formatTimeAgo(detection.timestamp, lang) : formatDateEAT(detection.timestamp, lang)}</td>
                      <td>
                        <span className={`disease-chip ${badgeClass}`}>
                          <i className={`fa-solid ${iconClass}`}></i>
                          {t('disease', diseaseKey)}
                        </span>
                      </td>
                      <td>
                        <div className="confidence-cell">
                          <div className="confidence-bar">
                            <div
                              className={`confidence-fill ${badgeClass}`}
                              style={{ width: `${(detection.confidence_score * 100).toFixed(0)}%` }}
                            ></div>
                          </div>
                          <span className="confidence-text">{(detection.confidence_score * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>{detection.temperature ? `${formatTemp(detection.temperature)}${settings.temperatureUnit === 'fahrenheit' ? '°F' : '°C'}` : 'N/A'}</td>
                      <td>{detection.humidity ? `${detection.humidity.toFixed(1)}%` : 'N/A'}</td>
                    </tr>
                  );
                })}
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
