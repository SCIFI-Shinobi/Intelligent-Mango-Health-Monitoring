/**
 * Format time utilities for Ethiopian local time (EAT, UTC+3)
 * All functions accept an optional `lang` parameter ('en' or 'am')
 */

const LOCALE_MAP = { en: 'en-US', am: 'am-ET' };
const getLocale = (lang) => LOCALE_MAP[lang] || LOCALE_MAP.en;

const TIME_AGO = {
  en: { justNow: 'just now', m: 'm ago', h: 'h ago', d: 'd ago' },
  am: { justNow: 'አሁን', m: 'ደቂቃ በፊት', h: 'ሰዓት በፊት', d: 'ቀን በፊት' },
};

export function formatTimeAgo(timestamp, lang = 'en', timeFormat = 'relative') {
  if (!timestamp) return 'N/A';

  if (timeFormat === 'absolute') {
    const d = new Date(timestamp);
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Addis_Ababa'
    };
    return d.toLocaleString(getLocale(lang), options);
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const labels = TIME_AGO[lang] || TIME_AGO.en;

  if (seconds < 60) return labels.justNow;
  if (minutes < 60) return `${minutes} ${labels.m}`;
  if (hours < 24) return `${hours} ${labels.h}`;
  if (days < 7) return `${days} ${labels.d}`;

  return formatDateEAT(date, lang);
}

export function formatDateEAT(date, lang = 'en') {
  if (!date) return 'N/A';

  const d = new Date(date);
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Addis_Ababa'
  };

  return d.toLocaleString(getLocale(lang), options);
}

export function formatDateFullEAT(date, lang = 'en') {
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

  return d.toLocaleString(getLocale(lang), options);
}

export function calculateTrend(currentValue, previousValue) {
  if (!previousValue || previousValue === 0) return { direction: 'stable', percentage: 0 };

  const change = currentValue - previousValue;
  const percentage = Math.abs((change / previousValue) * 100).toFixed(1);
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

  return { direction, percentage };
}
