import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';

ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler);

export default function HistoricalChart({ data, loading, onRangeChange, currentRange, lastUpdatedText }) {
  const { lang, t } = useLanguage();
  const { settings } = useSettings();

  if (loading || !data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="section-header">
          <span className="section-title">{t('chart', 'title')}</span>
          <div className="chart-tabs">
            <button className={`tab-btn ${currentRange === '24h' ? 'active' : ''}`} onClick={() => onRangeChange('24h')}>24h</button>
            <button className={`tab-btn ${currentRange === '7d' ? 'active' : ''}`} onClick={() => onRangeChange('7d')}>7d</button>
            <button className={`tab-btn ${currentRange === '30d' ? 'active' : ''}`} onClick={() => onRangeChange('30d')}>30d</button>
          </div>
        </div>
        {loading ? (
          <div className="chart-skeleton">
            <div className="skeleton-line skeleton-subline"></div>
            <div className="chart-skeleton-bars">
              {Array.from({ length: 10 }).map((_, index) => (
                <span key={index} className="chart-skeleton-bar"></span>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-message">
            <strong>{t('chart', 'noData')}</strong>
            <div className="message-hint">{t('chart', 'waitingForHistory')}</div>
          </div>
        )}
      </div>
    );
  }

const labels = data.map((d) => {
    const date = new Date(d.timestamp);
    if (settings.timeFormat === 'relative') {
      // For charts, relative doesn't make as much sense on multiple points, but let's honor the spirit:
      // Actually standardizing to EAT options:
      return date.toLocaleTimeString(lang === 'am' ? 'am-ET' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' });
    }
    // Absolute could include date or just standard time:
    return date.toLocaleTimeString(lang === 'am' ? 'am-ET' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' });
  });

  const temps = data.map((d) => settings.temperatureUnit === 'fahrenheit' ? parseFloat(((d.temperature * 9) / 5 + 32).toFixed(1)) : parseFloat(d.temperature.toFixed(1)));
  const humidities = data.map((d) => d.humidity);

  const chartData = {
    labels,
    datasets: [
      {
        label: settings.temperatureUnit === 'fahrenheit' ? t('chart', 'tempLabel').replace('(°C)', '(°F)') : t('chart', 'tempLabel'),
        data: temps,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointBackgroundColor: '#f97316',
        yAxisID: 'y'
      },
      {
        label: t('chart', 'humidityLabel'),
        data: humidities,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointBackgroundColor: '#3b82f6',
        yAxisID: 'y'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { color: '#7b8bbd', font: { size: 12 } } },
      tooltip: { backgroundColor: '#1a233a', titleColor: '#fff', bodyColor: '#7b8bbd', borderColor: '#30363d', borderWidth: 1 }
    },
    scales: {
      y: {
        type: 'linear', position: 'left',
        grid: { color: '#30363d', drawBorder: false },
        ticks: { color: '#7b8bbd' },
        title: { display: true, text: settings.temperatureUnit === 'fahrenheit' ? t('chart', 'tempAxis').replace('(°C)', '(°F)') : t('chart', 'tempAxis'), color: '#7b8bbd', font: { size: 11 } }
      },
      x: { grid: { display: false }, ticks: { color: '#7b8bbd' } }
    }
  };

  return (
    <div className="chart-container">
      <div className="section-header">
        <span className="section-title">{t('chart', 'title')}</span>
        <div className="chart-tabs">
          <button className={`tab-btn ${currentRange === '24h' ? 'active' : ''}`} onClick={() => onRangeChange('24h')}>24h</button>
          <button className={`tab-btn ${currentRange === '7d' ? 'active' : ''}`} onClick={() => onRangeChange('7d')}>7d</button>
          <button className={`tab-btn ${currentRange === '30d' ? 'active' : ''}`} onClick={() => onRangeChange('30d')}>30d</button>
        </div>
      </div>
      {lastUpdatedText && (
        <div className="card-updated-label chart-updated-label">
          {t('common', 'lastUpdated')}: {lastUpdatedText}
        </div>
      )}
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}
