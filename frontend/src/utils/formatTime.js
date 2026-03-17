/**
 * Format time utilities for Ethiopian local time (EAT, UTC+3)
 */

export function formatTimeAgo(timestamp) {
  if (!timestamp) return 'N/A';

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date; // milliseconds
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  // For older times, show formatted date
  return formatDateEAT(date);
}

export function formatDateEAT(date) {
  if (!date) return 'N/A';

  const d = new Date(date);
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Addis_Ababa' // EAT timezone
  };

  return d.toLocaleString('en-US', options);
}

export function formatDateFullEAT(date) {
  if (!date) return 'N/A';

  const d = new Date(date);
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Africa/Addis_Ababa'
  };

  return d.toLocaleString('en-US', options);
}

export function calculateTrend(currentValue, previousValue) {
  if (!previousValue || previousValue === 0) return { direction: 'stable', percentage: 0 };

  const change = currentValue - previousValue;
  const percentage = Math.abs((change / previousValue) * 100).toFixed(1);
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

  return { direction, percentage };
}
