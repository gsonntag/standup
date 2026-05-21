export function isOverdue(yyyyMmDd) {
  if (!yyyyMmDd) return false;
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const timestamp = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

export function timeAgo(value) {
  const date = parseTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function daysUntil(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}
