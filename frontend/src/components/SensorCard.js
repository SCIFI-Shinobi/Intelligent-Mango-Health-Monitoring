import React from 'react';
import { calculateTrend } from '../utils/formatTime';
import { MdOutlineThermostat, MdOpacity, MdWaterDrop } from 'react-icons/md';

export default function SensorCard({ name, value, unit, previousValue, icon, loading, subtitle, updatedAt, statusLabel, statusClass = 'live' }) {
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

  const getProgressValue = () => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 0;
    if (icon === 'temp') return Math.min(50, numValue);
    return Math.min(100, numValue);
  };

  const hasMeta = Boolean(subtitle || updatedAt);

  return (
    <div className={`sensor-card sensor-card-${icon === 'precip' ? 'moisture' : icon}`}>
      <div className="card-header">
        <div className="sensor-icon-container">
          {getIcon()}
        </div>
        <span className="sensor-name">{name}</span>
        {statusLabel && <span className={`mini-status-pill ${statusClass}`}>{statusLabel}</span>}
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
        </div>
      )}
    </div>
  );
}
