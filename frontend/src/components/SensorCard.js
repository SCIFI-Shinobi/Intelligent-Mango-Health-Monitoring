import React from 'react';
import { calculateTrend, formatDateEAT } from '../utils/formatTime';
import { MdOutlineThermostat, MdOpacity, MdWaterDrop } from 'react-icons/md';

export default function SensorCard({ name, value, unit, previousValue, icon, loading, subtitle, updatedAt, statusLabel, statusClass = 'live', lastScanTimestamp, lang = 'en' }) {
  if (loading) {
    return (
      <div className={`sensor-card sensor-card-${icon === 'precip' ? 'moisture' : icon}`}>
        <div className="card-header">
          <div className="sensor-icon-container skeleton-box"></div>
          <div className="skeleton-line skeleton-label"></div>
        </div>
        <div className="sensor-value">
          <div className="skeleton-line skeleton-value"></div>
        </div>
        <div className="progress-bar">
          <div className="skeleton-fill"></div>
        </div>
        <div className="skeleton-line skeleton-subline short"></div>
      </div>
    );
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const hasValue = numValue !== null && numValue !== undefined && !isNaN(numValue) && value !== '-';
  
  const getIcon = () => {
    switch (icon) {
      case 'temp':
        return <MdOutlineThermostat className="sensor-icon-svg temp" />;
      case 'humidity':
        return <MdOpacity className="sensor-icon-svg humidity" />;
      case 'moisture':
      case 'precip':
        return <MdWaterDrop className="sensor-icon-svg moisture" />;
      default:
        return <MdWaterDrop className="sensor-icon-svg" />;
    }
  };
  
  // If no data ever received, show waiting state
  if (!hasValue && !lastScanTimestamp) {
    return (
      <div className={`sensor-card sensor-card-${icon === 'precip' ? 'moisture' : icon} no-data`}>
        <div className="card-header">
          <div className="sensor-icon-container">
            {getIcon()}
          </div>
          <span className="sensor-name">{name}</span>
        </div>
        <div className="sensor-value waiting">
          <span className="waiting-text">Waiting for sensor data</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '0%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  const trend = calculateTrend(value, previousValue);

  const getTrendArrow = () => {
    if (trend.direction === 'up') return '↑';
    if (trend.direction === 'down') return '↓';
    return '→';
  };

  const getTrendClass = () => {
    if (trend.direction === 'up') return 'trend-up';
    if (trend.direction === 'down') return 'trend-down';
    return 'trend-stable';
  };

  const getProgressValue = () => {
    if (isNaN(numValue)) return 0;
    if (icon === 'temp') return Math.min(50, numValue);
    return Math.min(100, numValue);
  };

  const displayTimestamp = lastScanTimestamp ? formatDateEAT(lastScanTimestamp, lang) : null;
  const hasMeta = Boolean(subtitle || updatedAt || displayTimestamp);

  return (
    <div className={`sensor-card sensor-card-${icon === 'precip' ? 'moisture' : icon}`}>
      <div className="card-header">
        <div className="sensor-icon-container">
          {getIcon()}
        </div>
        <span className="sensor-name">{name}</span>
        {statusLabel && statusClass === 'live' && <span className={`mini-status-pill ${statusClass}`}>{statusLabel}</span>}
      </div>

      <div className="sensor-value">
        <span className="value">{value}</span>
        <span className="unit">{unit}</span>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar">
          <div
            className={`progress-fill progress-fill-${icon === 'precip' ? 'moisture' : icon}`}
            style={{ width: `${getProgressValue()}%` }}
          ></div>
        </div>
      </div>

      {previousValue !== undefined && previousValue !== null && (
        <div className={`sensor-trend ${getTrendClass()}`}>
          <span className="arrow">{getTrendArrow()}</span>
          <span className="change">{trend.percentage}%</span>
        </div>
      )}

      {hasMeta && (
        <div className="sensor-meta">
          {subtitle && <span>{subtitle}</span>}
          {updatedAt && <span>{updatedAt}</span>}
          {displayTimestamp && <span className="last-scan">Last updated: {displayTimestamp}</span>}
        </div>
      )}
    </div>
  );
}
