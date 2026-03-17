import React from 'react';
import { calculateTrend } from '../utils/formatTime';

export default function SensorCard({ name, value, unit, previousValue, icon }) {
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

  return (
    <div className="sensor-card">
      <div className="card-header">
        <span className={`icon sensor-icon ${icon}`}></span>
        <span className="sensor-name">{name}</span>
      </div>

      <div className="sensor-value">
        <span className="value">{value}</span>
        <span className="unit">{unit}</span>
      </div>

      {previousValue !== undefined && previousValue !== null && (
        <div className={`sensor-trend ${getTrendClass()}`}>
          <span className="arrow">{getTrendArrow()}</span>
          <span className="change">{trend.percentage}%</span>
        </div>
      )}
    </div>
  );
}
